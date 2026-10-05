import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { readArchive, retainArticles } from '@/current-affairs/archive'
import { CA_NOTES_KEY, type StickyNotes } from './compatibility/notes'
import { CA_STATE_KEY, type PersonalState } from '@/current-affairs/personal-state'
import type { NewsItem } from '@/current-affairs/types'
import { BACKUP_VERSION, BackupError, backupCounts, createBackup, eraseEverything, parseBackup, restoreBackup } from './backup'
import { mergeNotes, mergePersonalState, type ExtrasStorage } from './backup-extras'
import { db } from './db'

/** A device: its own key–value storage and its own article archive. */
function device() {
  const map = new Map<string, string>()
  const storage: ExtrasStorage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) }
  return { storage, indexedDB: new IDBFactory(), map }
}

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'
const C = '33333333-3333-4333-8333-333333333333'
const note = (id: string, text: string, createdAt: number, deletedAt?: number) => ({ id, text, createdAt, createdDate: '2026-10-01', ...(deletedAt ? { deletedAt } : {}) })
const notes = (...rows: ReturnType<typeof note>[]): StickyNotes => ({ version: 1, entries: Object.fromEntries(rows.map((r) => [r.id, r])) })
const state = (entries: PersonalState['entries']): PersonalState => ({ version: 1, entries })
const article = (url: string, title: string): NewsItem => ({ title, url, sourceId: 'dte-news', publisher: 'Down To Earth', section: 'Environment', publishedAt: '2026-10-01T04:00:00.000Z', description: 'About wetlands.' })

const U1 = 'https://example.org/ramsar'
const U2 = 'https://example.org/monsoon'

beforeEach(async () => {
  await db.delete()
  await db.open()
})

describe('backup: notes and Current Affairs reading state', () => {
  it('a backup made on one device restores on an empty one: notes, reading state and article metadata', async () => {
    const one = device()
    one.storage.setItem(CA_NOTES_KEY, JSON.stringify(notes(note(A, 'Article 21 – right to life', 1000), note(B, 'Removed', 2000, 2500))))
    one.storage.setItem(CA_STATE_KEY, JSON.stringify(state({ [U1]: { readAt: 100, savedAt: 150, note: 'Link to wetlands rules' }, [U2]: { ignoredAt: 300 } })))
    await retainArticles([article(U1, 'Ramsar sites'), article(U2, 'Monsoon withdrawal'), article('https://example.org/untracked', 'Not read')], 5000, one.indexedDB)
    await db.table('labels').put({ id: 'stored', createdAt: 1, updatedAt: 2, name: 'Environment', color: '#fff', parentId: null, kind: 'subject', archived: false, order: 0 })

    const file = JSON.stringify(await createBackup(one))
    const backup = parseBackup(file)
    expect(backup.version).toBe(BACKUP_VERSION)
    expect(backupCounts(backup)).toMatchObject({ labels: 1, notes: 1, articles: 2 })
    // Only metadata for tracked articles travels, and never anything but metadata.
    expect(backup.extras!.currentAffairs!.articles.map((a) => a.url).sort()).toEqual([U2, U1].sort())

    await db.delete()
    await db.open()
    const two = device()
    const report = await restoreBackup(backup, 'replace', two)
    expect(report.extras).toEqual({ notes: 1, articles: 2, preserved: [] })
    expect(JSON.parse(two.storage.getItem(CA_NOTES_KEY)!)).toEqual(JSON.parse(one.storage.getItem(CA_NOTES_KEY)!))
    expect(JSON.parse(two.storage.getItem(CA_STATE_KEY)!)).toEqual(JSON.parse(one.storage.getItem(CA_STATE_KEY)!))
    expect((await readArchive(two.indexedDB)).map((a) => [a.url, a.title, a.firstSeenAt]).sort()).toEqual([
      [U2, 'Monsoon withdrawal', 5000],
      [U1, 'Ramsar sites', 5000],
    ])
    expect(await db.table('labels').count()).toBe(1)
  })

  it('merging keeps both sides: union of notes, deletions respected, marks kept with the later time', async () => {
    const mine = device()
    mine.storage.setItem(CA_NOTES_KEY, JSON.stringify(notes(note(A, 'Mine', 1000), note(B, 'Shared', 2000))))
    mine.storage.setItem(CA_STATE_KEY, JSON.stringify(state({ [U1]: { readAt: 100, note: 'My note' }, [U2]: { savedAt: 50 } })))
    const theirs = device()
    theirs.storage.setItem(CA_NOTES_KEY, JSON.stringify(notes(note(B, 'Shared', 2000, 9000), note(C, 'Theirs', 3000))))
    theirs.storage.setItem(CA_STATE_KEY, JSON.stringify(state({ [U1]: { readAt: 400, savedAt: 500, note: 'Their note' } })))
    await retainArticles([article(U1, 'Ramsar sites')], 7000, theirs.indexedDB)

    const backup = parseBackup(JSON.stringify(await createBackup(theirs)))
    const report = await restoreBackup(backup, 'merge', mine)
    expect(report.extras).toEqual({ notes: 1, articles: 1, preserved: [] })
    const merged = JSON.parse(mine.storage.getItem(CA_NOTES_KEY)!) as StickyNotes
    expect(Object.keys(merged.entries).sort()).toEqual([A, B, C])
    expect(merged.entries[B].deletedAt).toBe(9000)
    expect(merged.entries[A].deletedAt).toBeUndefined()
    expect(JSON.parse(mine.storage.getItem(CA_STATE_KEY)!).entries).toEqual({ [U1]: { readAt: 400, savedAt: 500, note: 'My note' }, [U2]: { savedAt: 50 } })
    expect((await readArchive(mine.indexedDB)).map((a) => a.url)).toEqual([U1])

    // Merging the same backup again changes nothing.
    const again = await restoreBackup(backup, 'merge', mine)
    expect(again.extras).toEqual({ notes: 0, articles: 0, preserved: [] })
  })

  it('merge rules are symmetric where they should be', () => {
    const a = notes(note(A, 'x', 1, 50))
    const b = notes(note(A, 'x', 1, 90))
    expect(mergeNotes(a, b).entries[A].deletedAt).toBe(90)
    expect(mergeNotes(b, a).entries[A].deletedAt).toBe(90)
    const s1 = state({ [U1]: { readAt: 10 } })
    const s2 = state({ [U1]: { savedAt: 20 }, [U2]: {} })
    expect(mergePersonalState(s1, s2).entries).toEqual({ [U1]: { readAt: 10, savedAt: 20 } })
    expect(mergePersonalState(s2, s1).entries[U1]).toEqual({ readAt: 10, savedAt: 20 })
  })

  it('a backup from before version 3 restores as it always did and leaves notes and reading state alone, even when replacing', async () => {
    const here = device()
    here.storage.setItem(CA_NOTES_KEY, JSON.stringify(notes(note(A, 'Keep me', 1000))))
    here.storage.setItem(CA_STATE_KEY, JSON.stringify(state({ [U1]: { savedAt: 5 } })))
    const label = { id: 'l1', name: 'Polity', color: '#fff', parentId: null, kind: 'subject', archived: false, order: 0, createdAt: 1, updatedAt: 1 }
    for (const app of ['tars', 'lodestar']) {
      const v2 = JSON.stringify({ app, version: 2, exportedAt: '2026-09-01T00:00:00.000Z', settings: null, tables: { labels: [label] }, tombstones: [] })
      const backup = parseBackup(v2)
      expect(backup.extras).toBeUndefined()
      for (const mode of ['merge', 'replace'] as const) {
        const report = await restoreBackup(backup, mode, here)
        expect(report.extras).toEqual({ notes: 0, articles: 0, preserved: [] })
        expect(JSON.parse(here.storage.getItem(CA_NOTES_KEY)!).entries[A].text).toBe('Keep me')
        expect(JSON.parse(here.storage.getItem(CA_STATE_KEY)!).entries[U1]).toEqual({ savedAt: 5 })
        expect(await db.table('labels').get('l1')).toBeTruthy()
      }
    }
  })

  it('replacing with a version 3 backup that has no notes clears the notes here', async () => {
    const empty = device()
    const backup = parseBackup(JSON.stringify(await createBackup(empty)))
    expect(backup.extras).toEqual({})
    const here = device()
    here.storage.setItem(CA_NOTES_KEY, JSON.stringify(notes(note(A, 'Old device note', 1000))))
    await restoreBackup(backup, 'replace', here)
    expect(JSON.parse(here.storage.getItem(CA_NOTES_KEY)!).entries).toEqual({})
    // …while merging it leaves them.
    here.storage.setItem(CA_NOTES_KEY, JSON.stringify(notes(note(A, 'Old device note', 1000))))
    await restoreBackup(backup, 'merge', here)
    expect(Object.keys(JSON.parse(here.storage.getItem(CA_NOTES_KEY)!).entries)).toEqual([A])
  })

  it('never overwrites stored data it cannot read when merging', async () => {
    const theirs = device()
    theirs.storage.setItem(CA_NOTES_KEY, JSON.stringify(notes(note(C, 'Theirs', 3000))))
    theirs.storage.setItem(CA_STATE_KEY, JSON.stringify(state({ [U1]: { readAt: 1 } })))
    const backup = parseBackup(JSON.stringify(await createBackup(theirs)))
    const here = device()
    here.storage.setItem(CA_NOTES_KEY, '{"version":9,"entries":{}}')
    here.storage.setItem(CA_STATE_KEY, 'not json')
    const report = await restoreBackup(backup, 'merge', here)
    expect(report.extras.preserved.sort()).toEqual(['currentAffairs', 'notes'])
    expect(here.storage.getItem(CA_NOTES_KEY)).toBe('{"version":9,"entries":{}}')
    expect(here.storage.getItem(CA_STATE_KEY)).toBe('not json')
    // A backup made on a device in that condition simply leaves those parts out.
    expect((await createBackup(here)).extras).toEqual({})
  })

  it('cleans what a file brings: unknown fields, over-long text, other publishers and untracked articles are dropped', async () => {
    const file = {
      app: 'tars',
      version: 3,
      exportedAt: '2026-10-02T00:00:00.000Z',
      settings: null,
      tables: {},
      tombstones: [],
      extras: {
        notes: { version: 1, entries: { [A]: { ...note(A, 'n'.repeat(900), 1000), html: '<script>' }, 'not-a-uuid': note('not-a-uuid', 'x', 1) } },
        currentAffairs: {
          state: { version: 1, entries: { [U1]: { readAt: 5, body: 'ARTICLE TEXT' }, 'javascript:alert(1)': { readAt: 1 } } },
          articles: [
            { ...article(U1, 'Ramsar sites'), firstSeenAt: 10, lastSeenAt: 20, body: 'ARTICLE TEXT' },
            { ...article(U2, 'Untracked'), firstSeenAt: 10, lastSeenAt: 20 },
            { ...article(U1, 'Other publisher'), sourceId: 'rbi-notifications', firstSeenAt: 10, lastSeenAt: 30 },
            'nonsense',
          ],
        },
      },
    }
    const backup = parseBackup(JSON.stringify(file))
    expect(Object.keys(backup.extras!.notes!.entries)).toEqual([A])
    expect(backup.extras!.notes!.entries[A].text).toHaveLength(300)
    expect(JSON.stringify(backup.extras!.notes)).not.toContain('script')
    expect(backup.extras!.currentAffairs!.state.entries).toEqual({ [U1]: { readAt: 5 } })
    const here = device()
    await restoreBackup(backup, 'replace', here)
    const rows = await readArchive(here.indexedDB)
    expect(rows.map((a) => [a.url, a.title, a.firstSeenAt, a.lastSeenAt])).toEqual([[U1, 'Ramsar sites', 10, 20]])
    expect(JSON.stringify(rows)).not.toContain('ARTICLE TEXT')
    expect(here.storage.getItem(CA_STATE_KEY)).not.toContain('ARTICLE TEXT')
  })

  it('refuses extras in a format it does not know, and backups from a newer version', () => {
    const base = { app: 'tars', version: 3, exportedAt: '', settings: null, tables: {}, tombstones: [] }
    expect(() => parseBackup(JSON.stringify({ ...base, extras: { notes: { version: 2, entries: {} } } }))).toThrow(BackupError)
    expect(() => parseBackup(JSON.stringify({ ...base, extras: { currentAffairs: { state: { version: 7 } } } }))).toThrow(BackupError)
    expect(() => parseBackup(JSON.stringify({ ...base, extras: [] }))).toThrow(BackupError)
    expect(() => parseBackup(JSON.stringify({ ...base, version: BACKUP_VERSION + 1 }))).toThrow(/newer version/)
  })

  it('a restored article never replaces fresher metadata already here', async () => {
    const theirs = device()
    theirs.storage.setItem(CA_STATE_KEY, JSON.stringify(state({ [U1]: { savedAt: 1 } })))
    await retainArticles([article(U1, 'Old headline')], 1000, theirs.indexedDB)
    const backup = parseBackup(JSON.stringify(await createBackup(theirs)))
    const here = device()
    await retainArticles([article(U1, 'Corrected headline')], 9000, here.indexedDB)
    await restoreBackup(backup, 'merge', here)
    expect(await readArchive(here.indexedDB)).toMatchObject([{ title: 'Corrected headline', firstSeenAt: 1000, lastSeenAt: 9000 }])
  })

  it('erasing removes notes, reading state and the article archive', async () => {
    const here = device()
    here.storage.setItem(CA_NOTES_KEY, JSON.stringify(notes(note(A, 'x', 1))))
    here.storage.setItem(CA_STATE_KEY, JSON.stringify(state({ [U1]: { savedAt: 1 } })))
    here.storage.setItem('tars.theme', 'dark')
    await retainArticles([article(U1, 'Ramsar sites')], 1000, here.indexedDB)
    await eraseEverything(here)
    expect(here.storage.getItem(CA_NOTES_KEY)).toBeNull()
    expect(here.storage.getItem(CA_STATE_KEY)).toBeNull()
    expect(here.storage.getItem('tars.theme')).toBe('dark')
    expect(await readArchive(here.indexedDB)).toEqual([])
  })
})
