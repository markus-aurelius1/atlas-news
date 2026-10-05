/** Queue exclusivity, rolling-time boundaries, persistent removals and evidence-based analytics. */
import { describe, expect, it } from 'vitest'
import { readingAnalytics, readingScopes, recentCoverage, queueCounts, RECENT_WINDOW_MS } from './analytics'
import { eventPersonalState, parsePersonalState, patchPersonalState, type PersonalState } from './personal-state'
import { filterWorkspace, readingQueue, type WorkspaceEvent, type WorkspaceFilters } from './workspace'
const now = Date.parse('2026-10-01T14:00:00Z')
const empty = (): PersonalState => ({ version: 1, entries: {} })
const event = (id: string, time: number | null = now - 3600000): WorkspaceEvent => {
  const primary = { title: id, url: `https://example.org/${id}`, publisher: 'Example', sourceId: 'ie-explained', section: 'Explained', description: '', publishedAt: time ? new Date(time).toISOString() : null, relevance: { accepted: true, score: 7, exam: 'both' as const, subjects: ['Economy'], topics: [], staticAnchors: [], signals: [] } }
  return { id: primary.url, primary, members: [primary], day: '2026-10-01', mustRead: false, priority: 3, priorityReasons: [], minutes: 6 }
}
const filters: WorkspaceFilters = { day: '2026-10-01', tab: 'To be Read', exam: 'All', subject: 'All subjects', publisher: 'All sources', query: '', budget: null }
describe('Three exclusive queues', () => {
  it('moves read and saved articles out of pending, gives Saved precedence and restores on unsave/unread', () => {
    const a = event('a'), b = event('b'), c = event('c')
    let state = patchPersonalState(empty(), [a.id], { readAt: now })
    state = patchPersonalState(state, [b.id], { savedAt: now })
    state = patchPersonalState(state, [c.id], { readAt: now, savedAt: now })
    expect(queueCounts([a, b, c], state)).toEqual({ 'To be Read': 0, Read: 1, Saved: 2 })
    expect(filterWorkspace([a, b, c], state, filters)).toEqual([])
    expect(filterWorkspace([a, b, c], state, { ...filters, tab: 'Read' }).map(e => e.id)).toEqual([a.id])
    state = patchPersonalState(state, [c.id], { savedAt: undefined })
    expect(readingQueue(eventPersonalState(c, state))).toBe('Read')
    state = patchPersonalState(state, [b.id], { savedAt: undefined })
    expect(readingQueue(eventPersonalState(b, state))).toBe('To be Read')
  })
  it('hides removal in every queue, preserves read/save/note and roundtrips ignoredAt', () => {
    const a = event('a'), prior = patchPersonalState(empty(), [a.id], { readAt: now, savedAt: now, note: 'Preserved' })
    const hidden = parsePersonalState(JSON.stringify(patchPersonalState(prior, [a.id], { ignoredAt: now })))
    for (const tab of ['To be Read', 'Read', 'Saved'] as const) expect(filterWorkspace([a], hidden, { ...filters, tab })).toEqual([])
    expect(queueCounts([a], hidden)).toEqual({ 'To be Read': 0, Read: 0, Saved: 0 })
    expect(patchPersonalState(hidden, [a.id], { ignoredAt: undefined })).toEqual(prior)
  })
})
describe('Rolling Today and Archive', () => {
  it('uses the last 24 hours across midnight and partitions without overlap at the cutoff', () => {
    const fresh = event('fresh'), priorDay = event('prior-day', now - 23 * 3600000), cutoff = event('cutoff', now - RECENT_WINDOW_MS), old = event('old', now - RECENT_WINDOW_MS - 1), missing = event('missing', null), future = event('future', now + 1)
    const scopes = readingScopes([missing, old, fresh, cutoff, priorDay, future], now)
    expect(scopes.today.map(e => e.id)).toEqual([fresh.id, priorDay.id])
    expect(scopes.archive.map(e => e.id)).toEqual([future.id, cutoff.id, old.id, missing.id])
    expect(scopes.today.some(e => scopes.archive.includes(e))).toBe(false)
    expect(readingScopes([fresh], now + RECENT_WINDOW_MS).today).toEqual([])
  })
  it('keeps a group in one scope but displays only a current headline, preserving every state key', () => {
    const e = event('primary', now - 25 * 3600000), alternate = event('alternate', now - 23 * 3600000)
    e.members.push(alternate.primary)
    const current = readingScopes([e], now).today[0]
    expect(current.primary.url).toBe(alternate.id)
    expect(current.members).toEqual(e.members)
    expect(current.id).toBe(e.id)
    expect(recentCoverage(current, now).map(member => member.url)).toEqual([alternate.id])
    expect(readingScopes([e], now).archive).toEqual([])
    e.members.push(event('future', now + 1).primary)
    expect(readingScopes([e], now).today[0].primary.url).toBe(alternate.id)
  })
})
describe('Reading analytics', () => {
  it('deduplicates cluster members, includes metadata-free progress, read saved/removed items and only estimates known time', () => {
    const a = event('a'), alternate = event('alternate'), b = event('b')
    a.members.push(alternate.primary)
    let state = patchPersonalState(empty(), [a.id, alternate.id], { readAt: now, savedAt: now })
    state = patchPersonalState(state, [b.id], { ignoredAt: now })
    state = patchPersonalState(state, ['https://example.org/unavailable'], { readAt: now })
    const stats = readingAnalytics([a, b], state, now)
    expect(stats).toMatchObject({ read: 2, saved: 1, pending: 0, savedForLater: 0, removed: 1, estimatedReadMinutes: 6, metadataUnavailable: 1, readToday: 2, readWeek: 2, readMonth: 2, streak: 1 })
    expect(stats.daily.at(-1)).toMatchObject({ read: 2, saved: 1 })
  })
  it('uses marking dates for activity/streaks and keeps totals stable if the preferred member changes', () => {
    const a = event('a'), b = event('b'), c = event('c'), yesterday = now - 86400000
    let state = patchPersonalState(empty(), [a.id], { readAt: now })
    state = patchPersonalState(state, [b.id], { readAt: yesterday })
    state = patchPersonalState(state, [c.id], { readAt: now - 40 * 86400000 })
    expect(readingAnalytics([a, b, c], state, now)).toMatchObject({ read: 3, readToday: 1, readWeek: 2, readMonth: 2, streak: 2 })
    const merged = { ...a, primary: b.primary, members: [b.primary, a.primary] }
    const reversed = { ...merged, members: [...merged.members].reverse() }
    expect(eventPersonalState(merged, state)).toEqual(eventPersonalState(reversed, state))
  })
})
