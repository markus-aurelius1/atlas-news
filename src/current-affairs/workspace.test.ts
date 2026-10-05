/** Focused tests cover persistence failure/identity, priority boundaries, date and reading-plan behavior. */
import { describe, expect, it } from 'vitest'
import { buildWorkspace, dailyGroups, editionProgress, filterWorkspace, MUST_READ_THRESHOLD, mustReadEvidence, publicationDay, readingMinutes, shiftDay, timeBudgetSelection, UNDATED, type WorkspaceEvent, type WorkspaceFilters } from './workspace'
import { CA_STATE_KEY, eventPersonalState, NOTE_LIMIT, parsePersonalState, patchPersonalState, readPersonalState, writePersonalPatch, type PersonalState, type StateStorage } from './personal-state'
import type { ClassifiedItem, NewsEvent, RelevanceIndex } from './types'
const empty = (): PersonalState => ({ version: 1, entries: {} })
const event = (id = 'one', overrides: Partial<ClassifiedItem> = {}): NewsEvent => {
  const primary: ClassifiedItem = { title: 'RBI monetary regulation framework', url: `https://example.org/${id}`, publisher: 'Indian Express', sourceId: 'ie-economy', section: 'Economy', description: '', publishedAt: '2026-10-01T09:00:00Z', relevance: { accepted: true, score: 7, exam: 'both', subjects: ['Economy'], topics: ['Monetary policy'], staticAnchors: ['RBI'], signals: ['RBI · CSE P20/M3'] }, ...overrides }
  return { id: primary.url, primary, members: [primary] }
}
const index: RelevanceIndex = { version: 1, provenance: {}, signals: [{ concept: 'RBI', aliases: ['rbi'], subject: 'Economy', topic: 'Monetary policy', subtopic: 'Regulators', taxonomyIds: ['eco-1'], prelimsCount: 20, mainsCount: 3, prelimsDemand: true, mainsDemand: true }] }
const workspace = (id = 'one', overrides: Partial<WorkspaceEvent> = {}): WorkspaceEvent => ({ ...buildWorkspace([event(id)], index)[0], ...overrides })
const filters: WorkspaceFilters = { day: '2026-10-01', tab: 'To be Read', exam: 'All', subject: 'All subjects', publisher: 'All sources', query: '', budget: null }
it('publisher-curated general coverage does not imply Prelims/Mains demand or Must Read', () => {
  const e = event('curated', { sourceId: 'ie-upsc', relevance: { accepted: true, score: 2, exam: 'general', subjects: ['General studies'], topics: [], staticAnchors: [], signals: [] } })
  const rows = buildWorkspace([e], index)
  expect(rows[0].mustRead).toBe(false)
  expect(filterWorkspace(rows, empty(), filters)).toHaveLength(1)
  for (const exam of ['Prelims', 'Mains', 'Both'] as const) expect(filterWorkspace(rows, empty(), { ...filters, exam })).toHaveLength(0)
})
function storage(): StateStorage { let value: string | null = null; return { getItem: () => value, setItem: (key, next) => { expect(key).toBe(CA_STATE_KEY); value = next } } }
describe('Current Affairs local state', () => {
  it('roundtrips read/save/note only, supports clearing fields independently', () => {
    const disk = storage(), e = event()
    writePersonalPatch(disk, e, { readAt: 100, savedAt: 200, note: 'Personal connection' })
    expect(readPersonalState(disk).entries[e.id]).toEqual({ readAt: 100, savedAt: 200, note: 'Personal connection' })
    writePersonalPatch(disk, e, { readAt: undefined })
    expect(eventPersonalState(e, readPersonalState(disk))).toEqual({ readAt: undefined, savedAt: 200, note: 'Personal connection' })
    writePersonalPatch(disk, e, { savedAt: undefined, note: '' })
    expect(readPersonalState(disk)).toEqual(empty())
  })
  it('preserves progress when cluster primary/id changes and applies unread to all member URLs', () => {
    const a = event('a'), b = event('b'), disk = storage()
    writePersonalPatch(disk, a, { readAt: 100, savedAt: 200, note: 'Remember this' })
    const merged = { ...b, members: [b.primary, a.primary] }
    expect(eventPersonalState(merged, readPersonalState(disk))).toMatchObject({ readAt: 100, savedAt: 200, note: 'Remember this' })
    writePersonalPatch(disk, merged, { readAt: undefined })
    expect(eventPersonalState(merged, readPersonalState(disk)).readAt).toBeUndefined()
  })
  it('reads fresh storage before patching another article or another field', () => {
    const disk = storage()
    writePersonalPatch(disk, event('a'), { readAt: 100 })
    writePersonalPatch(disk, event('b'), { savedAt: 200 })
    writePersonalPatch(disk, event('a'), { note: 'Note' })
    expect(Object.keys(readPersonalState(disk).entries)).toHaveLength(2)
    expect(readPersonalState(disk).entries[event('a').id]).toEqual({ readAt: 100, note: 'Note' })
  })
  it('bounds notes, strips unapproved fields, ignores unsafe keys and invalid timestamps', () => {
    const e = event(), row = { readAt: -1, savedAt: 'yesterday', note: 'x'.repeat(NOTE_LIMIT + 1), body: 'FULL TEXT', title: 'Metadata' }
    const parsed = parsePersonalState(JSON.stringify({ version: 1, entries: { [e.id]: row, 'javascript:alert(1)': row } }))
    expect(Object.keys(parsed.entries)).toEqual([e.id])
    expect(Object.keys(parsed.entries[e.id])).toEqual(['note'])
    expect(parsed.entries[e.id].note).toHaveLength(NOTE_LIMIT)
    expect(JSON.stringify(parsed)).not.toContain('FULL TEXT')
  })
  it('preserves corrupt/future state and propagates quota/permission failures', () => {
    for (const value of ['broken JSON', '{"version":2,"entries":{}}']) {
      let writes = 0
      expect(() => writePersonalPatch({ getItem: () => value, setItem: () => { writes++ } }, event(), { readAt: 100 })).toThrow()
      expect(writes).toBe(0)
    }
    expect(() => writePersonalPatch({ getItem: () => null, setItem: () => { throw new Error('quota') } }, event(), { readAt: 100 })).toThrow('quota')
  })
})
describe('Must Read and reading estimates', () => {
  it('centralizes an inclusive threshold and uses explainer/cross-publisher evidence without official-source boosts', () => {
    const standard = event()
    expect(mustReadEvidence(standard, index).priority).toBe(6)
    expect(mustReadEvidence(standard, index).mustRead).toBe(false)
    const explained = event('explained', { section: 'Explained' })
    expect(mustReadEvidence(explained, index).priority).toBe(MUST_READ_THRESHOLD)
    expect(mustReadEvidence(explained, index).mustRead).toBe(true)
    expect(mustReadEvidence(event('old circular', { sourceId: 'rbi-releases' }), index).priority).toBe(6)
    expect(mustReadEvidence({ ...standard, members: [standard.primary, { ...standard.primary, publisher: 'Mint' }] }, index).mustRead).toBe(true)
    expect(mustReadEvidence({ ...standard, members: [standard.primary, standard.primary] }, index).mustRead).toBe(false)
  })
  it('cannot promote rejected stories or infer PYQ recurrence without matched index evidence', () => {
    const e = event('official', { sourceId: 'rbi-releases' })
    e.primary.relevance = { ...e.primary.relevance, accepted: false }
    expect(mustReadEvidence(e, index).mustRead).toBe(false)
    expect(mustReadEvidence(event(), { ...index, signals: [] }).priority).toBe(3)
  })
  it.each([['Economy', 'ie-economy', 3], ['UPSC Current Affairs', 'ie-upsc', 4], ['Explained', 'ie-explained', 6], ['Editorial', 'ht-editorial', 7], ['Analysis', 'hindu-national', 7]])('estimates %s from source/section only', (section, sourceId, expected) => expect(readingMinutes(event('one', { section, sourceId }))).toBe(expected))
})
describe('Daily editions and filters', () => {
  it('tracks read and saved independently across selected archive days', () => {
    const a = workspace('a'), b = workspace('b', { day: '2026-09-30' }), c = workspace('c', { day: '2025-09-30' })
    const state = patchPersonalState(patchPersonalState(empty(), [a.id], { readAt: 100 }), [b.id], { savedAt: 200 })
    const selection = { ...filters, days: ['2026-09-30', '2026-10-01'] }
    expect(filterWorkspace([a, b, c], state, { ...selection, tab: 'Read' }).map(e => e.id)).toEqual([a.id])
    expect(filterWorkspace([a, b, c], state, { ...selection, tab: 'Saved' }).map(e => e.id)).toEqual([b.id])
    expect(filterWorkspace([a, b, c], state, { ...selection, tab: 'To be Read' })).toEqual([])
  })
  it('groups by IST publication date and keeps missing dates separate', () => {
    expect(publicationDay('2026-09-30T20:00:00Z')).toBe('2026-10-01')
    expect(publicationDay(null)).toBe(UNDATED)
    expect(publicationDay('invalid')).toBe(UNDATED)
    expect(shiftDay('2026-10-01', -1)).toBe('2026-09-30')
    const groups = dailyGroups([workspace(), workspace('old', { day: '2026-09-30' }), workspace('missing', { day: UNDATED })])
    expect([...groups.keys()]).toEqual(['2026-10-01', '2026-09-30', UNDATED])
  })
  it('computes progress and minutes from unread events, with no stored counters', () => {
    const a = workspace('a', { minutes: 4, mustRead: true }), b = workspace('b', { minutes: 6 })
    expect(editionProgress([a, b], patchPersonalState(empty(), [a.id], { readAt: 100 }))).toEqual({ total: 2, read: 1, unread: 1, minutesLeft: 6, mustRead: 1 })
    expect(editionProgress([], empty())).toMatchObject({ total: 0, read: 0, minutesLeft: 0 })
  })
  it('chooses highest-value unread items that fit a budget, skipping oversized rows deterministically', () => {
    const a = workspace('a', { minutes: 7, priority: 9, mustRead: true }), b = workspace('b', { minutes: 6, priority: 8, mustRead: true }), c = workspace('c', { minutes: 3, priority: 5 })
    expect(timeBudgetSelection([c, b, a], empty(), 10).map(e => e.id)).toEqual([a.id, c.id])
    expect(timeBudgetSelection([c, a, b], empty(), 10).map(e => e.id)).toEqual([a.id, c.id])
    const state = patchPersonalState(empty(), [a.id], { readAt: 100 })
    expect(timeBudgetSelection([a, b, c], state, 15).map(e => e.id)).toEqual([b.id, c.id])
    expect(timeBudgetSelection([a], empty(), 3)).toEqual([])
  })
  it('searches title/source/section/subject/topic/concept including alternate coverage', () => {
    const e = workspace(), other = event('other', { publisher: 'Mint', section: 'Explained' })
    e.members.push(other.primary)
    for (const query of ['regulation', 'mint', 'explained', 'economy', 'monetary', 'rbi', 'MONETARY RBI']) expect(filterWorkspace([e], empty(), { ...filters, query })).toHaveLength(1)
    expect(filterWorkspace([e], empty(), { ...filters, query: 'cricket' })).toEqual([])
  })
  it('combines date, read/saved, tier, exam, publisher, subject and budget', () => {
    const a = workspace('a', { mustRead: true }), b = workspace('b', { mustRead: false }), old = workspace('old', { day: '2026-09-30' })
    const events = [a, b, old], state = patchPersonalState(empty(), [a.id], { savedAt: 100, readAt: 100 })
    expect(filterWorkspace(events, state, { ...filters, tab: 'Saved', publisher: 'Indian Express', subject: 'Economy', exam: 'Both' }).map(e => e.id)).toEqual([a.id])
    expect(filterWorkspace(events, state, { ...filters, tab: 'To be Read', budget: 15 }).map(e => e.id)).toEqual([b.id])
    expect(filterWorkspace(events, state, { ...filters, tab: 'Read' })).toEqual([])
    expect(filterWorkspace(events, state, { ...filters, day: '2026-09-30' }).map(e => e.id)).toEqual([old.id])
    expect(filterWorkspace(events, state, { ...filters, subject: 'Polity' })).toEqual([])
    a.primary.relevance = { ...a.primary.relevance, exam: 'prelims' }
    expect(filterWorkspace([a], empty(), { ...filters, exam: 'Mains' })).toEqual([])
  })
})
