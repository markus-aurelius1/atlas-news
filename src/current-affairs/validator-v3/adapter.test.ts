import { expect, it } from 'vitest'
import { productionInput, evaluateProduction, validatorMode } from './adapter'
import { RUNTIME_VERSIONS } from './runtime-manifest'
import { evaluateStageC } from './stage-c'
import { readingScopes } from '../analytics'
import { groupTopics } from '../topics'
import { readSelection, retainSelection } from './history'
import { IDBFactory } from 'fake-indexeddb'
import type { FeedResponse, NewsItem, RelevanceIndex } from '../types'
const now = '2026-10-09T12:00:00.000Z', at = Date.parse(now)
const index: RelevanceIndex = { version: 2, provenance: {}, signals: [] }
const item: NewsItem = { title: 'Quantum computing new research reveals a finding', url: 'https://indianexpress.com/fixture', publisher: 'Indian Express', sourceId: 'ie-explained', section: 'Explained', description: 'The research discovers a mechanism with independent experimental evidence.', publishedAt: now }
const feed = (items = [item]): FeedResponse => ({ version: 1, fetchedAt: now, items, sources: [] })

it('safe rollback defaults to v2; shadow/v3 require explicit build switch', () => {
  expect(validatorMode('')).toBe('v2'); expect(validatorMode('arbitrary')).toBe('v2'); expect(validatorMode('shadow')).toBe('shadow'); expect(validatorMode('v3')).toBe('v3')
})
it('production adapter hashes real bounded metadata and excludes body and future fields', async () => {
  const input = await productionInput([{ ...item, body: 'PRIVATE', html: '<article>PRIVATE</article>' } as NewsItem], now)
  expect(JSON.stringify(input)).not.toContain('PRIVATE'); expect(input.versions).toEqual(RUNTIME_VERSIONS)
  expect(input.observations[0].metadataHash).toMatch(/^[a-f0-9]{64}$/)
  expect(evaluateStageC(input).articles[0].accepted).toBe(true)
  expect((await productionInput([{ ...item, publishedAt: '2026-10-10T12:00:00.000Z' }], now)).observations).toHaveLength(0)
})
it('selection survives genuine DB reopen/reload; refresh does not reselect or update chronology', async () => {
  const factory = new IDBFactory(), initial = await evaluateProduction(feed(), index, { history: [], selected: [] }, now)
  expect(initial.events).toHaveLength(1); await retainSelection(initial.snapshot, at, factory)
  const snapshot = await readSelection(factory), repeat = await evaluateProduction(feed(), index, snapshot, '2026-10-09T13:00:00.000Z')
  expect(repeat.events[0].id).toBe(initial.events[0].id); expect(repeat.snapshot.selected[0].selectedAt).toBe(at)
  expect(readingScopes(repeat.events, at + 3600000).today).toHaveLength(1)
  expect(readingScopes(repeat.events, at + 30 * 86400000).today).toHaveLength(0)
  expect(readingScopes(repeat.events, at + 30 * 86400000).archive).toHaveLength(1)
})
it('static anchors cannot fold distinct v3 reading needs or override selected representative', async () => {
  const other = { ...item, title: 'Quantum computing study reveals a new experiment', url: 'https://indianexpress.com/other' }
  const result = await evaluateProduction(feed([item, other]), index, { history: [], selected: [] }, now)
  for (const event of result.events) event.primary.relevance.staticAnchors = ['Shared static concept']
  expect(groupTopics(result.events)).toHaveLength(result.events.length)
  expect(groupTopics(result.events).map(g => g.anchor.item.url)).toEqual(result.events.map(e => e.primary.url))
})
it('only selected units become chronological Archive; undated/old accepted metadata stays out', async () => {
  const result = await evaluateProduction(feed([item, { ...item, url: 'https://indianexpress.com/old', publishedAt: '2026-10-01T12:00:00.000Z', title: 'Quantum computing research discovers a different mechanism' }]), index, { history: [], selected: [] }, now)
  expect(result.events).toHaveLength(1); expect(result.snapshot.history).toHaveLength(2)
  expect(result.events[0].primary.relevance.score).toBe(0)
  expect(result.events[0].primary.relevance.subjects).toEqual(['Sci-Tech'])
})
