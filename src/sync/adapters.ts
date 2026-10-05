/**
 * One adapter per synced collection. `scan` compares what the app has stored with the rows last agreed with
 * the server and returns what changed here; `apply` writes rows that won on another device into the app's own
 * storage, through the same parsers and merge rules a backup restore uses. Nothing else in the app has to know
 * that sync exists: storage formats, keys and ids are exactly what they were.
 *
 * Not synced, by design: the RSS feed snapshot, the article archive of unsaved articles, historical tables,
 * and per-device preferences (motion, sidebar, last Atlas view).
 */
import { articleMetadata, readArchivedByUrl, restoreArticles, type ArchivedArticle } from '@/current-affairs/archive'
import { CA_STATE_KEY, NOTE_LIMIT, parsePersonalState, type PersonalEntry, type PersonalState } from '@/current-affairs/personal-state'
import { applyChanges } from '@/data/compatibility/merge'
import { CA_NOTES_KEY, parseStickyNotes, type StickyNote, type StickyNotes } from '@/data/compatibility/notes'
import { db } from '@/data/db'
import { DEFAULT_SETTINGS } from '@/data/seed'
import type { Entity, Settings, Tombstone } from '@/data/types'
import { MAP_STYLES } from '@/game/progression'
import { canon, type Collection, type SyncRow } from './protocol.ts'
import type { StoredRow } from './store.ts'

export interface LocalChange {
  k: string
  v: string | null
  d: 0 | 1
  /** When the change was made, if the data itself says. Otherwise the time it was noticed is used. */
  t?: number
}

export interface Adapter {
  c: Collection
  scan(shadow: Map<string, StoredRow>): Promise<LocalChange[]>
  apply(rows: SyncRow[]): Promise<void>
}

export interface AdapterStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface AdapterEnv {
  storage: AdapterStorage
  /** Where the article archive lives. */
  archive?: IDBFactory
  /** Tell open views that storage changed underneath them. */
  notify?: (what: 'news' | 'articles' | 'notes') => void
}

function diff(local: Map<string, { v: string; t?: number }>, shadow: Map<string, StoredRow>, absentIsDeleted: boolean): LocalChange[] {
  const changes: LocalChange[] = []
  for (const [k, cur] of local) {
    const known = shadow.get(k)
    if (!known || known.d || known.v !== cur.v) changes.push({ k, v: cur.v, d: 0, t: cur.t })
  }
  if (absentIsDeleted) for (const known of shadow.values()) if (!known.d && !local.has(known.k)) changes.push({ k: known.k, v: null, d: 1 })
  return changes
}

const parse = (text: string | null): unknown => {
  try {
    return text === null ? undefined : JSON.parse(text)
  } catch {
    return undefined
  }
}
const time = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0

// News: Read / Saved / Removed and the article note

const NEWS_FIELDS = ['readAt', 'savedAt', 'ignoredAt', 'note'] as const
type NewsField = (typeof NEWS_FIELDS)[number]

function newsKey(k: string): { field: NewsField; url: string } | null {
  const at = k.indexOf(':'), field = k.slice(0, at) as NewsField, url = k.slice(at + 1)
  return NEWS_FIELDS.includes(field) && /^https?:\/\//.test(url) ? { field, url } : null
}

function newsValue(field: NewsField, v: string | null): number | string | undefined {
  const value = parse(v)
  if (field === 'note') return typeof value === 'string' && value ? value.slice(0, NOTE_LIMIT) : undefined
  return time(value) ? value : undefined
}

function withNewsRows(state: PersonalState, rows: Iterable<SyncRow>): PersonalState {
  const entries: Record<string, PersonalEntry> = { ...state.entries }
  for (const row of rows) {
    const key = newsKey(row.k)
    if (!key) continue
    const entry: Record<string, unknown> = { ...entries[key.url] }
    const value = row.d ? undefined : newsValue(key.field, row.v)
    if (value === undefined) delete entry[key.field]
    else entry[key.field] = value
    if (Object.keys(entry).length) entries[key.url] = entry as PersonalEntry
    else delete entries[key.url]
  }
  return { version: 1, entries }
}

/**
 * One row per article and mark, so reading on one device and saving on another never collide. A mark is its
 * own timestamp; clearing it (unread, unsave, undo remove) leaves a tombstone, which is how it reaches the
 * other devices. A device that has never held a mark has no row for it, so it can never undo a save elsewhere.
 */
export function newsAdapter(env: AdapterEnv): Adapter {
  return {
    c: 'news',
    async scan(shadow) {
      const raw = env.storage.getItem(CA_STATE_KEY)
      const live = [...shadow.values()].filter((row) => !row.d)
      if (raw === null && live.length) {
        // The key is gone but nothing here cleared it mark by mark: storage was lost, not edited. Put back what was agreed.
        env.storage.setItem(CA_STATE_KEY, JSON.stringify(withNewsRows({ version: 1, entries: {} }, live)))
        env.notify?.('news')
        return []
      }
      const state = parsePersonalState(raw)
      const local = new Map<string, { v: string; t?: number }>()
      for (const [url, entry] of Object.entries(state.entries)) {
        for (const field of NEWS_FIELDS) {
          const value = entry[field]
          if (value) local.set(`${field}:${url}`, { v: JSON.stringify(value), t: typeof value === 'number' ? value : undefined })
        }
      }
      return diff(local, shadow, true)
    },
    async apply(rows) {
      // Read again at the moment of writing: an action taken while the request was in flight is kept.
      const next = withNewsRows(parsePersonalState(env.storage.getItem(CA_STATE_KEY)), rows)
      env.storage.setItem(CA_STATE_KEY, JSON.stringify(next))
      env.notify?.('news')
    },
  }
}

// Saved articles: the metadata that keeps them on the list

export function pinnedArticle(row: Pick<SyncRow, 'k' | 'v' | 'd'>): ArchivedArticle | null {
  if (row.d) return null
  const value = parse(row.v) as Partial<ArchivedArticle> | undefined
  if (!value || typeof value !== 'object' || !time(value.lastSeenAt)) return null
  const clean = articleMetadata(value as ArchivedArticle, value.lastSeenAt)
  if (!clean || clean.url !== row.k) return null
  return { ...clean, firstSeenAt: time(value.firstSeenAt) ? Math.min(value.firstSeenAt, clean.lastSeenAt) : clean.lastSeenAt }
}

/**
 * Follows the Saved mark: saving pins the article's publisher metadata (title, link, date – never its text),
 * unsaving removes the pin. The pinned copy lives in the sync store, independent of the feed and the archive,
 * so a Saved article stays listed after its source is dropped from the registry or stops carrying it.
 */
export function articleAdapter(env: AdapterEnv): Adapter {
  return {
    c: 'article',
    async scan(shadow) {
      const state = parsePersonalState(env.storage.getItem(CA_STATE_KEY))
      const saved = new Set(Object.entries(state.entries).filter(([, entry]) => entry.savedAt).map(([url]) => url))
      const changes: LocalChange[] = []
      const missing = [...saved].filter((url) => { const known = shadow.get(url); return !known || known.d })
      if (missing.length && env.archive) {
        for (const article of await readArchivedByUrl(missing, env.archive)) {
          const clean = articleMetadata(article, article.lastSeenAt)
          if (clean && saved.has(clean.url)) changes.push({ k: clean.url, v: canon({ ...clean, firstSeenAt: time(article.firstSeenAt) ? article.firstSeenAt : clean.firstSeenAt }), d: 0 })
        }
      }
      for (const known of shadow.values()) if (!known.d && !saved.has(known.k)) changes.push({ k: known.k, v: null, d: 1 })
      if (changes.length) env.notify?.('articles')
      return changes
    },
    async apply(rows) {
      const articles = rows.flatMap((row) => pinnedArticle(row) ?? [])
      // Also into the archive where its rules allow, so the article sits in its edition and travels in backups.
      if (articles.length && env.archive) await restoreArticles(articles, env.archive).catch(() => 0)
      env.notify?.('articles')
    },
  }
}

// Short notes

const noteValue = (note: StickyNote) => canon({ id: note.id, text: note.text, createdAt: note.createdAt, createdDate: note.createdDate })

/** A note's text never changes: it exists, or it has been deleted. Deletion wins, as it does when backups merge. */
export function noteAdapter(env: AdapterEnv): Adapter {
  return {
    c: 'note',
    async scan(shadow) {
      const raw = env.storage.getItem(CA_NOTES_KEY)
      const live = [...shadow.values()].filter((row) => !row.d)
      if (raw === null && live.length) {
        const entries = Object.fromEntries(live.flatMap((row) => { const note = parse(row.v) as StickyNote | undefined; return note ? [[row.k, note]] : [] }))
        env.storage.setItem(CA_NOTES_KEY, JSON.stringify(parseStickyNotes(JSON.stringify({ version: 1, entries }))))
        env.notify?.('notes')
        return []
      }
      const changes: LocalChange[] = []
      for (const note of Object.values(parseStickyNotes(raw).entries)) {
        const known = shadow.get(note.id)
        if (note.deletedAt) { if (!known?.d) changes.push({ k: note.id, v: null, d: 1, t: note.deletedAt }) }
        else if (!known || known.d || known.v !== noteValue(note)) changes.push({ k: note.id, v: noteValue(note), d: 0, t: note.createdAt })
      }
      return changes
    },
    async apply(rows) {
      const notes: StickyNotes = parseStickyNotes(env.storage.getItem(CA_NOTES_KEY))
      const entries: Record<string, unknown> = { ...notes.entries }
      for (const row of rows) {
        const mine = notes.entries[row.k]
        if (row.d) { if (mine) entries[row.k] = { ...mine, deletedAt: Math.max(mine.deletedAt ?? 0, row.t) } }
        else if (!mine) entries[row.k] = { ...(parse(row.v) as object), id: row.k }
        // A note deleted here stays deleted; the next scan sends the deletion.
      }
      // The parser drops anything that is not a well-formed note.
      env.storage.setItem(CA_NOTES_KEY, JSON.stringify(parseStickyNotes(JSON.stringify({ version: 1, entries }))))
      env.notify?.('notes')
    },
  }
}

// Atlas recall attempts and reward claims

const isEntity = (r: unknown): r is Entity => !!r && typeof r === 'object' && typeof (r as Entity).id === 'string' && time((r as Entity).updatedAt)
const text = (v: unknown) => typeof v === 'string' && v.length > 0
const VALID: Record<'recalls' | 'claims', (r: Record<string, unknown>) => boolean> = {
  recalls: (r) => text(r.placeId) && text(r.type) && (r.correct === 0 || r.correct === 1) && time(r.at) && text(r.date) && text(r.source),
  claims: (r) => text(r.challengeId) && text(r.period) && typeof r.reward === 'number' && Number.isFinite(r.reward),
}

/**
 * Records keep their ids and `updatedAt`; deletions travel as the tombstones the database already keeps.
 * Incoming rows go through `applyChanges`, the merge a backup restore uses.
 */
export function tableAdapter(c: 'recall' | 'claim'): Adapter {
  const name = c === 'recall' ? 'recalls' : 'claims'
  return {
    c,
    async scan(shadow) {
      const records = (await db.table(name).toArray()) as Entity[]
      const local = new Map<string, { v: string; t?: number }>()
      for (const record of records) if (isEntity(record)) local.set(record.id, { v: canon(record), t: record.updatedAt })
      const changes = diff(local, shadow, false)
      for (const tomb of await db.tombstones.where('table').equals(name).toArray()) {
        if (local.has(tomb.entityId) || shadow.get(tomb.entityId)?.d || !time(tomb.deletedAt)) continue
        changes.push({ k: tomb.entityId, v: null, d: 1, t: tomb.deletedAt })
      }
      return changes
    },
    async apply(rows) {
      const records: Entity[] = [], tombstones: Tombstone[] = []
      for (const row of rows) {
        if (row.d) { tombstones.push({ id: `${name}:${row.k}`, table: name, entityId: row.k, deletedAt: row.t }); continue }
        const record = parse(row.v)
        if (isEntity(record) && record.id === row.k && VALID[name](record as unknown as Record<string, unknown>)) records.push(record)
      }
      if (records.length || tombstones.length) await applyChanges({ records: { [name]: records }, tombstones })
    },
  }
}

// Settings

const SETTINGS: Record<string, (v: unknown) => boolean> = {
  theme: (v) => v === 'system' || v === 'light' || v === 'dark',
  weekStartsOn: (v) => v === 0 || v === 1,
  haptics: (v) => typeof v === 'boolean',
  atlasStyle: (v) => MAP_STYLES.some((style) => style.id === v),
  atlasLayers: (v) => !!v && typeof v === 'object' && typeof (v as { undiscovered?: unknown }).undiscovered === 'boolean' && typeof (v as { areas?: unknown }).areas === 'boolean' && Array.isArray((v as { groups?: unknown }).groups) && (v as { groups: unknown[] }).groups.every((g) => typeof g === 'string'),
}

/**
 * One row per preference. A preference still at its default has never been chosen, so a new device's
 * defaults do not overwrite what was chosen elsewhere.
 */
export function settingsAdapter(): Adapter {
  return {
    c: 'settings',
    async scan(shadow) {
      const settings = await db.settings.get('settings')
      if (!settings) return []
      const changes: LocalChange[] = []
      for (const field of Object.keys(SETTINGS)) {
        if (settings[field] === undefined || !SETTINGS[field](settings[field])) continue
        const v = canon(settings[field]), known = shadow.get(field)
        if (known ? known.v !== v : v !== canon(DEFAULT_SETTINGS[field])) changes.push({ k: field, v, d: 0, t: time(settings.updatedAt) ? settings.updatedAt : undefined })
      }
      return changes
    },
    async apply(rows) {
      const patch: Record<string, unknown> = {}
      let newest = 0
      for (const row of rows) {
        const value = parse(row.v)
        if (row.d || !SETTINGS[row.k]?.(value)) continue
        patch[row.k] = value
        newest = Math.max(newest, row.t)
      }
      if (!Object.keys(patch).length) return
      await db.transaction('rw', db.settings, async () => {
        const current: Settings = (await db.settings.get('settings')) ?? DEFAULT_SETTINGS
        await db.settings.put({ ...current, ...patch, id: 'settings', updatedAt: Math.max(current.updatedAt, newest) })
      })
    },
  }
}

export function adapters(env: AdapterEnv): Adapter[] {
  return [newsAdapter(env), articleAdapter(env), noteAdapter(env), tableAdapter('recall'), tableAdapter('claim'), settingsAdapter()]
}
