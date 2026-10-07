import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, describe, expect, it } from 'vitest'
import { collectExtras, eraseExtras, parseExtras, restoreExtras } from '@/data/backup-extras'
import { TarsDB } from '@/data/db'
import { V1_STORES } from '@/data/compatibility/schema'
import { makeAnchor } from './anchors'
import { parseHighlight, type HighlightArticle } from './model'
import { HighlightRepository } from './repository'

const text = 'Introductory words. Select this quote. Another passage for selection. Final context.'
const metadata: HighlightArticle = { articleUrl: 'https://www.thehindu.com/a', title: 'Title', publisher: 'The Hindu', sourceId: 'hindu-national', publishedAt: null, subjectSnapshot: 'Polity', categorySnapshot: 'National' }
const selection = (start = 20, end = 37) => ({ quote: text.slice(start, end), anchor: makeAnchor(text, start, end) })
const opened: HighlightRepository[] = []
const device = () => { const factory = new IDBFactory(); const repo = new HighlightRepository(undefined, factory); opened.push(repo); return { repo, factory } }
afterEach(() => opened.forEach((r) => r.close()))

describe('local highlight repository', () => {
  it('survives close/reopen, keeps articles separate, and preserves metadata/identity', async () => {
    const { repo, factory } = device()
    const { record } = await repo.create(metadata, selection(), 'yellow', text)
    await repo.create({ ...metadata, articleUrl: metadata.articleUrl + '/b' }, selection(), 'blue', text)
    repo.close()
    const reopened = new HighlightRepository(undefined, factory); opened.push(reopened)
    expect(await reopened.readByArticle(metadata.articleUrl)).toEqual([record])
    expect(await reopened.readByArticle(metadata.articleUrl + '/b')).toHaveLength(1)
    expect(record).toMatchObject({ subjectSnapshot: 'Polity', version: 1, resolution: 'resolved' })
    expect(record.highlightId).toBeTruthy()
  })
  it('recolors and soft-deletes without changing identity or quote', async () => {
    const { repo } = device()
    const { record } = await repo.create(metadata, selection(), 'yellow', text)
    await repo.recolor(record.highlightId, 'pink')
    expect((await repo.readByArticle(metadata.articleUrl))[0]).toMatchObject({ highlightId: record.highlightId, quote: record.quote, color: 'pink' })
    await repo.remove(record.highlightId)
    expect(await repo.readByArticle(metadata.articleUrl)).toEqual([])
    expect(await repo.records.get(record.highlightId)).toHaveProperty('deletedAt')
  })
  it('reuses identical selection, rejects same/different-color overlap, permits adjacency', async () => {
    const { repo } = device()
    const { record } = await repo.create(metadata, selection(), 'yellow', text)
    expect((await repo.create(metadata, selection(), 'yellow', text)).record.highlightId).toBe(record.highlightId)
    expect((await repo.create(metadata, selection(), 'green', text)).reused).toBe(true)
    for (const color of ['yellow', 'blue'] as const) await expect(repo.create(metadata, selection(22, 40), color, text)).rejects.toThrow('overlaps')
    await repo.create(metadata, selection(37, 52), 'yellow', text)
    expect(await repo.readByArticle(metadata.articleUrl)).toHaveLength(2)
  })
  it('serializes concurrent duplicate creation atomically', async () => {
    const { repo } = device()
    await Promise.all([repo.create(metadata, selection(), 'yellow', text), repo.create(metadata, selection(), 'yellow', text)])
    expect(await repo.readByArticle(metadata.articleUrl)).toHaveLength(1)
  })
  it('keeps unresolved excerpts intact and preserves creation/edit times', async () => {
    const { repo } = device()
    const { record } = await repo.create(metadata, selection(), 'yellow', text)
    await repo.setResolution([{ highlightId: record.highlightId, resolution: 'unresolved' }])
    expect(await repo.records.get(record.highlightId)).toEqual({ ...record, resolution: 'unresolved' })
  })
  it('never stores HTML, article body or extraction/auth data even from arbitrary input fields', async () => {
    const { repo } = device()
    const longText = 'DISTANT_UNSELECTED_SENTINEL ' + 'before '.repeat(60) + text + ' after'.repeat(60)
    const at = longText.indexOf('Select this quote')
    const excerpt = { quote: 'Select this quote', anchor: makeAnchor(longText, at, at + 17) }
    const { record } = await repo.create({ ...metadata, body: longText, html: '<p>' + longText + '</p>', cookie: 'secret' } as HighlightArticle, excerpt, 'yellow', longText)
    expect(parseHighlight({ ...record, body: text })).toEqual(record)
    const stored = JSON.stringify(await repo.backup())
    expect(stored).not.toContain('DISTANT_UNSELECTED_SENTINEL')
    expect(record.anchor.prefix.length).toBeLessThanOrEqual(64)
    expect(record.anchor.suffix.length).toBeLessThanOrEqual(64)
    expect(stored).not.toContain('<p>')
    expect(stored).not.toContain('cookie')
    expect(Object.keys(record)).not.toContain('body')
  })
  it('notifies subscribers after create/edit/delete', async () => {
    const { repo } = device()
    const seen: number[] = []
    const stop = repo.observe(metadata.articleUrl, (rows) => seen.push(rows.length), () => {})
    const { record } = await repo.create(metadata, selection(), 'green', text)
    await new Promise((r) => setTimeout(r, 30))
    expect(seen).toContain(1)
    await repo.remove(record.highlightId)
    await new Promise((r) => setTimeout(r, 30))
    expect(seen.at(-1)).toBe(0)
    stop()
  })
  it('additive backup extras round-trip excerpts/tombstones without requiring Saved/Read', async () => {
    const one = device(), two = device()
    const map = new Map<string, string>()
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => { map.set(k, v) }, removeItem: (k: string) => { map.delete(k) } }
    const { record } = await one.repo.create(metadata, selection(), 'yellow', text)
    const extras = parseExtras(await collectExtras({ indexedDB: one.factory, storage }))
    await restoreExtras(extras, 'replace', { indexedDB: two.factory, storage })
    expect((await two.repo.readByArticle(metadata.articleUrl))[0]).toMatchObject({ highlightId: record.highlightId, quote: record.quote, resolution: 'pending' })
    // Older backups in either mode leave the H1 DB untouched.
    await restoreExtras({ notes: { version: 1, entries: {} } }, 'replace', { indexedDB: two.factory, storage })
    expect(await two.repo.readByArticle(metadata.articleUrl)).toHaveLength(1)
    await one.repo.remove(record.highlightId)
    await restoreExtras(parseExtras(await collectExtras({ indexedDB: one.factory, storage })), 'merge', { indexedDB: two.factory, storage })
    expect(await two.repo.readByArticle(metadata.articleUrl)).toHaveLength(0)
  })
  it('does not reset baseline databases or opaque historical rows', async () => {
    const name = 'lodestar-migration-h1'
    const old = new Dexie(name)
    old.version(1).stores(V1_STORES)
    await old.table('tasks').put({ id: 'opaque', payload: { future: ['keep'] }, updatedAt: 9 })
    old.close()
    const current = new TarsDB(name)
    await current.open()
    const { repo } = device()
    await repo.create(metadata, selection(), 'yellow', text)
    expect(await current.table('tasks').get('opaque')).toEqual({ id: 'opaque', payload: { future: ['keep'] }, updatedAt: 9 })
    expect(current.verno).toBe(2)
    await current.delete()
  })
  it('new empty backups deliberately replace highlights, and erase clears only the requested extras', async () => {
    const { repo, factory } = device()
    const { record } = await repo.create(metadata, selection(), 'yellow', text)
    const extras = await collectExtras({ indexedDB: new IDBFactory() })
    expect(extras.readerHighlights).toEqual([])
    await restoreExtras(extras, 'replace', { indexedDB: factory })
    expect(await repo.readByArticle(metadata.articleUrl)).toHaveLength(0)
    expect(await repo.records.get(record.highlightId)).toBeUndefined()
    await repo.create(metadata, selection(), 'blue', text)
    await eraseExtras({ indexedDB: factory })
    expect(await repo.backup()).toEqual([])
  })
  it('uses monotonic edit times even when wall clock is unchanged', async () => {
    const { repo } = device()
    const { record } = await repo.create(metadata, selection(), 'yellow', text)
    await repo.recolor(record.highlightId, 'blue')
    const edited = (await repo.records.get(record.highlightId))!
    expect(edited.updatedAt).toBeGreaterThan(record.updatedAt)
    await repo.remove(record.highlightId)
    expect((await repo.records.get(record.highlightId))!.updatedAt).toBeGreaterThan(edited.updatedAt)
  })
  it('rejects unknown schema/invalid anchors and preserves opaque future local rows', async () => {
    const { repo } = device()
    const { record } = await repo.create(metadata, selection(), 'yellow', text)
    expect(() => parseHighlight({ ...record, version: 99 })).toThrow()
    expect(() => parseHighlight({ ...record, anchor: { ...record.anchor, end: -1 } })).toThrow()
    const opaque = { highlightId: 'future', version: 99, data: 'keep' }
    await repo.records.put(opaque as never)
    await repo.restore([], 'replace')
    expect(await repo.records.get('future')).toEqual(opaque)
  })
})
