import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, describe, expect, it } from 'vitest'
import { groupHighlights } from './library'
import { makeAnchor } from './anchors'
import { parseHighlight, type ReaderHighlight } from './model'
import { HighlightRepository } from './repository'

const text = 'Before the chosen excerpt. After the selected passage with context.'
const row = (id: string, articleUrl = 'https://www.thehindu.com/a', subjectSnapshot: string | null = 'Polity', updatedAt = 100): ReaderHighlight => parseHighlight({ version: 1, highlightId: id, articleUrl, title: 'Committee report', publisher: 'The Hindu', sourceId: 'hindu-national', publishedAt: null, subjectSnapshot, categorySnapshot: 'National', quote: text.slice(11, 25), anchor: makeAnchor(text, 11, 25), color: 'yellow', createdAt: 50, updatedAt, resolution: 'pending' })
const repos: HighlightRepository[] = []
const device = () => { const factory = new IDBFactory(); const repo = new HighlightRepository(undefined, factory); repos.push(repo); return { repo, factory } }
afterEach(() => { repos.forEach((repo) => repo.close()); repos.length = 0 })

describe('Highlights library grouping', () => {
  it('groups by snapshot subject then article, using News order and Other for null/unknown', () => {
    const groups = groupHighlights([row('economy', 'https://www.thehindu.com/e', 'Economy'), row('null', 'https://www.thehindu.com/n', null), row('unknown', 'https://www.thehindu.com/u', 'Unresolved'), row('p1'), row('p2')])
    expect(groups.map((g) => [g.subject, g.count])).toEqual([['Economy', 1], ['Polity', 2], ['Other', 2]])
    expect(groups[1].articles).toHaveLength(1)
    expect(groups[1].articles[0].passages.map((r) => r.highlightId)).toEqual(['p1', 'p2'])
  })
  it('orders articles by latest edit activity and passages by anchor then creation/ID', () => {
    const early = row('early'), later = row('later')
    early.anchor = makeAnchor(text, 0, 6); later.anchor = makeAnchor(text, 28, 33)
    const groups = groupHighlights([later, row('other', 'https://www.thehindu.com/b', 'Polity', 200), early])
    expect(groups[0].articles.map((a) => a.articleUrl)).toEqual(['https://www.thehindu.com/b', 'https://www.thehindu.com/a'])
    expect(groups[0].articles[1].passages.map((r) => r.highlightId)).toEqual(['early', 'later'])
    expect(groupHighlights([later, early])).toEqual(groupHighlights([early, later]))
  })
  it('keeps duplicate excerpts as independent IDs, unresolved quotes visible, and tombstones hidden', () => {
    const rows = [row('one'), { ...row('two'), resolution: 'unresolved' as const }, { ...row('deleted'), deletedAt: 150 }]
    const passages = groupHighlights(rows)[0].articles[0].passages
    expect(passages).toHaveLength(2)
    expect(passages[1]).toMatchObject({ highlightId: 'two', resolution: 'unresolved', quote: rows[0].quote })
  })
  it('searches saved quotes and titles locally without source data', () => {
    expect(groupHighlights([row('one')], 'COMMITTEE')).toHaveLength(1)
    expect(groupHighlights([row('one')], 'chosen')).toHaveLength(1)
    expect(groupHighlights([row('one')], 'missing')).toEqual([])
  })
})

describe('cross-article repository queries', () => {
  it('reads all active excerpts independently of feed/archive/removal and after reopen', async () => {
    const { repo, factory } = device()
    await repo.restore([row('a'), row('b', 'https://www.thehindu.com/b'), { ...row('deleted'), deletedAt: 200 }], 'merge')
    expect((await repo.readAll()).map((r) => r.highlightId)).toEqual(['a', 'b'])
    repo.close()
    const reopened = new HighlightRepository(undefined, factory); repos.push(reopened)
    expect(await reopened.readAll()).toHaveLength(2)
    expect(reopened.verno).toBe(2)
  })
  it('reacts to recolor/delete from a second repository and keeps tombstones in backup/restore', async () => {
    const { repo, factory } = device()
    await repo.restore([row('a'), row('b', 'https://www.thehindu.com/b')], 'merge')
    const other = new HighlightRepository(undefined, factory); repos.push(other)
    const emissions: ReaderHighlight[][] = []
    const stop = repo.observeAll((rows) => emissions.push(rows), (error) => { throw error })
    const until = async (test: () => boolean) => { for (let i=0;i<100 && !test();i++) await new Promise((r) => setTimeout(r, 10)); expect(test()).toBe(true) }
    await until(() => emissions.length > 0)
    await other.recolor('a', 'blue')
    await until(() => emissions.at(-1)?.[0]?.color === 'blue')
    await other.remove('a')
    await until(() => emissions.at(-1)?.length === 1)
    stop()
    const restored = device().repo
    await restored.restore(await repo.backup(), 'replace')
    expect((await restored.readAll()).map((r) => r.highlightId)).toEqual(['b'])
    expect((await restored.backup()).find((r) => (r as ReaderHighlight).highlightId === 'a')).toHaveProperty('deletedAt')
  })
})
