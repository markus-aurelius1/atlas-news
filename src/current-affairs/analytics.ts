/** Derived reading metrics and disjoint rolling-window scopes. Cluster members count as one reading item. */
import { eventPersonalState, type PersonalState } from './personal-state'
import { publicationDay, readingMinutes, readingQueue, shiftDay, type WorkspaceEvent } from './workspace'
export const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000
export function latestPublication(event: WorkspaceEvent): number {
  return Math.max(0, ...event.members.map(m => Date.parse(m.publishedAt ?? '') || 0))
}
export function recentCoverage(event: WorkspaceEvent, now: number) {
  return event.members.filter(member => {
    const time = Date.parse(member.publishedAt ?? '')
    return time > now - RECENT_WINDOW_MS && time <= now
  })
}
export function readingScopes(events: WorkspaceEvent[], now: number) {
  const today: WorkspaceEvent[] = [], archive: WorkspaceEvent[] = []
  for (const event of events) {
    const recent = recentCoverage(event, now)
    if (recent.length) {
      // Retain all member keys for personal state, but show a headline inside the rolling window.
      const primary = recent.find(member => member.url === event.primary.url) ?? recent[0]
      const current = { ...event, primary, day: publicationDay(primary.publishedAt) }
      today.push({ ...current, minutes: readingMinutes(current) })
    }
    else archive.push(event)
  }
  archive.sort((a, b) => latestPublication(b) - latestPublication(a) || a.id.localeCompare(b.id))
  return { today, archive }
}
export function queueCounts(events: WorkspaceEvent[], state: PersonalState) {
  const counts = { 'To be Read': 0, Read: 0, Saved: 0 }
  for (const event of events) { const p = eventPersonalState(event, state); if (!p.ignoredAt) counts[readingQueue(p)]++ }
  return counts
}
export function readingAnalytics(events: WorkspaceEvent[], state: PersonalState, now: number) {
  const known = new Set(events.flatMap(e => e.members.map(m => m.url)))
  const rows = events.map(e => ({ ...eventPersonalState(e, state), subject: e.primary.relevance.subjects[0] ?? 'General studies', minutes: e.minutes, hasMetadata: true }))
  // Keep previously marked URLs in totals even if their feed metadata was never retained by this version.
  for (const [url, p] of Object.entries(state.entries)) if (!known.has(url) && (p.readAt || p.savedAt || p.ignoredAt)) rows.push({ ...p, subject: 'Metadata unavailable', minutes: 0, hasMetadata: false })
  const read = rows.filter(r => r.readAt), saved = rows.filter(r => r.savedAt)
  const today = publicationDay(now), days = Array.from({ length: 14 }, (_, i) => shiftDay(today, i - 13))
  const daily = days.map(day => ({ day, read: read.filter(r => publicationDay(r.readAt!) === day).length, saved: saved.filter(r => publicationDay(r.savedAt!) === day).length }))
  const activeDays = new Set(read.filter(r => r.readAt! <= now).map(r => publicationDay(r.readAt!)))
  let cursor = activeDays.has(today) ? today : shiftDay(today, -1), streak = 0
  while (activeDays.has(cursor)) { streak++; cursor = shiftDay(cursor, -1) }
  const subjects = [...new Set(read.map(r => r.subject))].map(subject => ({ subject, read: read.filter(r => r.subject === subject).length })).sort((a, b) => b.read - a.read || a.subject.localeCompare(b.subject))
  const recentRead = (count: number) => read.filter(r => r.readAt! <= now && publicationDay(r.readAt!) >= shiftDay(today, 1 - count)).length
  return { read: read.length, saved: saved.length, pending: rows.filter(r => r.hasMetadata && !r.ignoredAt && readingQueue(r) === 'To be Read').length, savedForLater: saved.filter(r => !r.ignoredAt && !r.readAt).length, removed: rows.filter(r => r.ignoredAt).length, estimatedReadMinutes: read.reduce((n, r) => n + r.minutes, 0), metadataUnavailable: rows.filter(r => !r.hasMetadata).length, readToday: recentRead(1), readWeek: recentRead(7), readMonth: recentRead(30), streak, daily, subjects }
}
