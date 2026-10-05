/**
 * The parts of a backup that live outside the main database: the short notes
 * and the Current Affairs reading state (both in localStorage), and the
 * publisher metadata of the articles that state refers to (a small IndexedDB
 * store of its own).
 *
 * They are carried in a backup's optional `extras` (backup version 3). A backup
 * without `extras` – every backup made before – restores exactly as it always
 * did and leaves these untouched, in either mode: it never covered them, so it
 * must not erase them.
 *
 * Everything read from a file goes back through the same parsers that guard
 * the live storage (allowlisted fields, length limits, active publishers only),
 * so a backup can add nothing those rules would not have accepted.
 *
 * Merging (a backup into a device that already has data):
 *   notes          union by id. A note's text never changes; a note deleted on
 *                  either side is deleted (the later deletion time is kept).
 *   reading state  per article: a mark (read, saved, removed) made on either
 *                  side is kept, with the later time. An "unmark" has no time
 *                  of its own, so it cannot win over a mark – the cost of a
 *                  merge that never loses a save. A local article note is kept;
 *                  the backup's fills a blank.
 *   articles       added where missing or newer; never removed.
 */
import { ARCHIVE_DB, readArchive, restoreArticles, type ArchivedArticle } from '@/current-affairs/archive'
import { CA_NOTES_KEY, parseStickyNotes, type StickyNotes } from './compatibility/notes'
import { CA_STATE_KEY, parsePersonalState, type PersonalEntry, type PersonalState } from '@/current-affairs/personal-state'

export interface BackupExtras {
  notes?: StickyNotes
  currentAffairs?: {
    state: PersonalState
    /** Publisher metadata (title, link, date – never article text) for the articles in `state`. */
    articles: ArchivedArticle[]
  }
}

export interface ExtrasStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface ExtrasEnv {
  storage?: ExtrasStorage
  indexedDB?: IDBFactory
}

export interface ExtrasReport {
  /** Notes now present that were not before (or, replacing, the notes loaded). */
  notes: number
  /** Articles whose reading state was added or changed (or, replacing, loaded). */
  articles: number
  /** Parts left alone because what is stored on this device could not be read; nothing was overwritten. */
  preserved: Array<'notes' | 'currentAffairs'>
}

const env = (e: ExtrasEnv = {}) => ({
  storage: e.storage ?? (typeof localStorage === 'undefined' ? undefined : (localStorage as ExtrasStorage)),
  factory: e.indexedDB ?? (typeof indexedDB === 'undefined' ? undefined : indexedDB),
})

const live = (notes: StickyNotes) => Object.values(notes.entries).filter((n) => !n.deletedAt).length

/** Everything outside the main database, as it is now. A part that cannot be read is left out rather than failing the backup. */
export async function collectExtras(e?: ExtrasEnv): Promise<BackupExtras> {
  const { storage, factory } = env(e)
  const extras: BackupExtras = {}
  if (!storage) return extras
  try {
    const notes = parseStickyNotes(storage.getItem(CA_NOTES_KEY))
    if (Object.keys(notes.entries).length) extras.notes = notes
  } catch {
    /* unreadable: not included */
  }
  try {
    const state = parsePersonalState(storage.getItem(CA_STATE_KEY))
    const tracked = new Set(Object.keys(state.entries))
    if (tracked.size) {
      let articles: ArchivedArticle[] = []
      try {
        if (factory) articles = (await readArchive(factory)).filter((a) => tracked.has(a.url))
      } catch {
        /* the archive is a convenience: the state is still worth keeping without it */
      }
      extras.currentAffairs = { state, articles }
    }
  } catch {
    /* unreadable: not included */
  }
  return extras
}

/** Check and clean the `extras` of a backup file. Throws with a readable message when a part is not in a known format. */
export function parseExtras(raw: unknown): BackupExtras | undefined {
  if (raw === undefined || raw === null) return undefined
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('The notes and reading state in this backup are malformed.')
  const r = raw as { notes?: unknown; currentAffairs?: { state?: unknown; articles?: unknown } }
  const out: BackupExtras = {}
  if (r.notes !== undefined) {
    try {
      out.notes = parseStickyNotes(JSON.stringify(r.notes))
    } catch {
      throw new Error('The notes in this backup are in a format this version cannot read.')
    }
  }
  if (r.currentAffairs !== undefined) {
    if (!r.currentAffairs || typeof r.currentAffairs !== 'object') throw new Error('The Current Affairs reading state in this backup is malformed.')
    let state: PersonalState
    try {
      state = parsePersonalState(JSON.stringify(r.currentAffairs.state))
    } catch {
      throw new Error('The Current Affairs reading state in this backup is in a format this version cannot read.')
    }
    const tracked = new Set(Object.keys(state.entries))
    const rows = Array.isArray(r.currentAffairs.articles) ? r.currentAffairs.articles : []
    // Only rows shaped like article metadata, and only for articles the state mentions. They are cleaned again when written.
    const articles = rows.filter((a): a is ArchivedArticle => !!a && typeof a === 'object' && typeof (a as ArchivedArticle).url === 'string' && typeof (a as ArchivedArticle).title === 'string' && tracked.has((a as ArchivedArticle).url))
    out.currentAffairs = { state, articles }
  }
  return out
}

export function mergeNotes(local: StickyNotes, incoming: StickyNotes): StickyNotes {
  const entries = { ...local.entries }
  for (const [id, note] of Object.entries(incoming.entries)) {
    const mine = entries[id]
    if (!mine) entries[id] = note
    else if (note.deletedAt && (!mine.deletedAt || note.deletedAt > mine.deletedAt)) entries[id] = { ...mine, deletedAt: note.deletedAt }
  }
  return { version: 1, entries }
}

const later = (a?: number, b?: number) => (a && b ? Math.max(a, b) : (a ?? b))

export function mergePersonalState(local: PersonalState, incoming: PersonalState): PersonalState {
  const entries: Record<string, PersonalEntry> = { ...local.entries }
  for (const [url, theirs] of Object.entries(incoming.entries)) {
    const mine = entries[url] ?? {}
    const readAt = later(mine.readAt, theirs.readAt)
    const savedAt = later(mine.savedAt, theirs.savedAt)
    const ignoredAt = later(mine.ignoredAt, theirs.ignoredAt)
    const note = mine.note || theirs.note
    const next: PersonalEntry = { ...(readAt && { readAt }), ...(savedAt && { savedAt }), ...(ignoredAt && { ignoredAt }), ...(note && { note }) }
    if (Object.keys(next).length) entries[url] = next
  }
  return { version: 1, entries }
}

/** Write a backup's extras to this device. `undefined` extras (an older backup) change nothing. */
export async function restoreExtras(extras: BackupExtras | undefined, mode: 'merge' | 'replace', e?: ExtrasEnv): Promise<ExtrasReport> {
  const report: ExtrasReport = { notes: 0, articles: 0, preserved: [] }
  const { storage, factory } = env(e)
  if (!extras || !storage) return report

  if (extras.notes || mode === 'replace') {
    const incoming = extras.notes ?? { version: 1 as const, entries: {} }
    if (mode === 'replace') {
      storage.setItem(CA_NOTES_KEY, JSON.stringify(incoming))
      report.notes = live(incoming)
    } else {
      try {
        const local = parseStickyNotes(storage.getItem(CA_NOTES_KEY))
        const merged = mergeNotes(local, incoming)
        storage.setItem(CA_NOTES_KEY, JSON.stringify(merged))
        report.notes = Object.keys(merged.entries).length - Object.keys(local.entries).length
      } catch {
        report.preserved.push('notes')
      }
    }
  }

  if (extras.currentAffairs || mode === 'replace') {
    const incoming = extras.currentAffairs?.state ?? { version: 1 as const, entries: {} }
    let written = false
    if (mode === 'replace') {
      storage.setItem(CA_STATE_KEY, JSON.stringify(incoming))
      report.articles = Object.keys(incoming.entries).length
      written = true
    } else {
      try {
        const local = parsePersonalState(storage.getItem(CA_STATE_KEY))
        const merged = mergePersonalState(local, incoming)
        storage.setItem(CA_STATE_KEY, JSON.stringify(merged))
        report.articles = Object.keys(merged.entries).filter((url) => JSON.stringify(merged.entries[url]) !== JSON.stringify(local.entries[url])).length
        written = true
      } catch {
        report.preserved.push('currentAffairs')
      }
    }
    // The metadata is what lets a restored "Saved" list show titles and dates on a device that never fetched them.
    if (written && factory && extras.currentAffairs?.articles.length) {
      try {
        await restoreArticles(extras.currentAffairs.articles, factory)
      } catch {
        /* the reading state is restored; rows without metadata are shown as such until the feed returns them */
      }
    }
  }
  return report
}

/** Remove the notes, the reading state and the article archive ("Erase all data"). */
export async function eraseExtras(e?: ExtrasEnv): Promise<void> {
  const { storage, factory } = env(e)
  storage?.removeItem(CA_NOTES_KEY)
  storage?.removeItem(CA_STATE_KEY)
  if (!factory) return
  await new Promise<void>((resolve) => {
    const request = factory.deleteDatabase(ARCHIVE_DB)
    request.onsuccess = request.onerror = request.onblocked = () => resolve()
  })
}
