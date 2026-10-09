import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { expect, it } from 'vitest'
import { HighlightRepository } from '../reader/highlights/repository'
import { makeAnchor } from '../reader/highlights/anchors'
import { authored } from '@/sync/highlights-protocol'
import { displayArticle } from './adapter'
import { retainSelection, readSelection } from './history'
import { storyFrame } from './stories'
import type { RelevanceIndex, NewsItem } from '../types'

it('Validator subject changes preserve existing highlight IDs, snapshots, anchors and sync payloads', async () => {
  const factory = new IDBFactory(), repo = new HighlightRepository(undefined, factory)
  try {
    const text = 'Introductory context. Preserve this quoted passage. A separate passage follows here. Final context.'
    const start = text.indexOf('Preserve'), end = start + 'Preserve this quoted passage.'.length, selection = { quote: text.slice(start, end), anchor: makeAnchor(text, start, end) }
    const article = { articleUrl: 'https://indianexpress.com/fixture', title: 'Original article', publisher: 'Indian Express', sourceId: 'ie-explained', publishedAt: null, subjectSnapshot: 'Polity', categorySnapshot: 'Explained' }
    const { record } = await repo.create(article, selection, 'yellow', text), before = authored(record)
    const item: NewsItem = { url: article.articleUrl, title: 'Defence readiness capability assessment in India', publisher: article.publisher, sourceId: article.sourceId, section: 'Explained', description: '', publishedAt: null }
    const index: RelevanceIndex = { version: 2, provenance: {}, signals: [] }, display = displayArticle(item, index)
    expect(display.relevance.subjects).toEqual(['Security'])
    const reselected = await repo.create({ ...article, subjectSnapshot: display.relevance.subjects[0], title: item.title }, selection, 'blue', text)
    expect(reselected.reused).toBe(true); expect(authored(reselected.record)).toEqual(before)
    const now = Date.now()
    await retainSelection({ history: [{ item, observedAt: now, firstSeenAt: now }], selected: [{ id: 'new-reading-identity', selectedAt: now, lastSelectedAt: now, representative: item, members: [item.url], frame: storyFrame(item) }] }, now, factory)
    expect((await readSelection(factory)).selected).toHaveLength(1)
    expect(authored((await repo.readByArticle(item.url))[0])).toEqual(before)
    const backup = await repo.backup(); await repo.restore(backup, 'merge')
    expect(authored((await repo.readByArticle(item.url))[0])).toEqual(before)
    expect((await repo.readByArticle(item.url))[0].subjectSnapshot).toBe('Polity')
  } finally { repo.close() }
})
