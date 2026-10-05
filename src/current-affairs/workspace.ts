/** Pure daily-edition, priority and reading-plan rules; all estimates use existing metadata, never article fetches. */
import { OFFICIAL_LINKS } from './static-links'
import { normalize } from './relevance'
import { eventPersonalState, type PersonalState } from './personal-state'
import type { NewsEvent, RelevanceIndex } from './types'
export const MUST_READ_THRESHOLD = 7
export const EDITION_TIMEZONE = 'Asia/Kolkata'
export const UNDATED = 'undated'
export type ReadingTab = 'To be Read' | 'Read' | 'Saved'
export interface WorkspaceEvent extends NewsEvent { mustRead: boolean; priority: number; priorityReasons: string[]; minutes: number; day: string }
export interface WorkspaceFilters { day: string; days?: string[]; tab: ReadingTab; exam: 'All' | 'Prelims' | 'Mains' | 'Both'; subject: string; publisher: string; query: string; budget: number | null }
export function publicationDay(value: string | number | null): string {
  if (value === null || !Number.isFinite(new Date(value).getTime())) return UNDATED
  return new Intl.DateTimeFormat('en-CA', { timeZone: EDITION_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
}
export function shiftDay(day: string, delta: number): string {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + delta)
  return date.toISOString().slice(0, 10)
}
export function editionLabel(day: string): string {
  return day === UNDATED ? 'Undated' : new Date(`${day}T12:00:00Z`).toLocaleDateString('en-IN', { timeZone: EDITION_TIMEZONE, day: 'numeric', month: 'short' })
}
export function readingMinutes(event: NewsEvent): number {
  const item = event.primary
  if (/long analysis|analysis|opinion|editorial/i.test(item.section)) return 7
  if (/explained|explainer/i.test(item.section)) return 6
  return /upsc/i.test(item.section) ? 4 : 3
}
export function mustReadEvidence(event: NewsEvent, index: RelevanceIndex) {
  const r = event.primary.relevance, reasons: string[] = []
  let score = 0
  const add = (points: number, reason: string) => { score += points; reasons.push(reason) }
  const signals = index.signals.filter(s => r.staticAnchors.includes(s.concept))
  const recurrence = signals.reduce((max, s) => Math.max(max, s.prelimsCount + s.mainsCount), 0)
  if (r.score >= 12) add(2, 'Strong supported relevance evidence')
  else if (r.score >= 7) add(1, 'Supported headline concept')
  if (recurrence >= 20) add(2, 'Recurring CSE concept')
  else if (recurrence >= 5) add(1, 'CSE PYQ connection')
  if (signals.some(s => s.taxonomyIds.length > 0 && s.subtopic)) add(1, 'Specific syllabus connection')
  if (r.staticAnchors.some(c => Object.hasOwn(OFFICIAL_LINKS, c))) add(1, 'Institutional or convention connection')
  if (new Set(event.members.map(m => m.publisher)).size > 1) add(1, 'Coverage across publishers')
  if (event.members.some(m => /explained|explainer/i.test(m.section))) add(1, 'Explainer coverage')
  if (r.exam === 'both') add(1, 'Prelims and Mains demand')
  return { mustRead: r.accepted && score >= MUST_READ_THRESHOLD, priority: score, priorityReasons: reasons }
}
export function buildWorkspace(events: NewsEvent[], index: RelevanceIndex): WorkspaceEvent[] {
  return events.map(event => ({ ...event, ...mustReadEvidence(event, index), minutes: readingMinutes(event), day: publicationDay(event.primary.publishedAt) }))
}
export function dailyGroups(events: WorkspaceEvent[]): Map<string, WorkspaceEvent[]> {
  const groups = new Map<string, WorkspaceEvent[]>()
  for (const event of events) groups.set(event.day, [...(groups.get(event.day) ?? []), event])
  return groups
}
export function editionProgress(events: WorkspaceEvent[], state: PersonalState) {
  const unread = events.filter(e => !eventPersonalState(e, state).readAt)
  return { total: events.length, read: events.length - unread.length, unread: unread.length, minutesLeft: unread.reduce((n, e) => n + e.minutes, 0), mustRead: events.filter(e => e.mustRead).length }
}
const valueOrder = (a: WorkspaceEvent, b: WorkspaceEvent) => Number(b.mustRead) - Number(a.mustRead) || b.priority - a.priority || (Date.parse(b.primary.publishedAt ?? '') || 0) - (Date.parse(a.primary.publishedAt ?? '') || 0) || a.id.localeCompare(b.id)
export function readingQueue(personal: import('./personal-state').PersonalEntry): ReadingTab {
  return personal.savedAt ? 'Saved' : personal.readAt ? 'Read' : 'To be Read'
}
export function timeBudgetSelection(events: WorkspaceEvent[], state: PersonalState, budget: number): WorkspaceEvent[] {
  const selected: WorkspaceEvent[] = []
  let remaining = budget
  for (const event of events.filter(e => !eventPersonalState(e, state).readAt).sort(valueOrder)) {
    if (event.minutes <= remaining) { selected.push(event); remaining -= event.minutes }
  }
  return selected
}
export function filterWorkspace(events: WorkspaceEvent[], state: PersonalState, filters: WorkspaceFilters): WorkspaceEvent[] {
  const terms = normalize(filters.query).split(' ').filter(Boolean)
  const matches = events.filter(event => {
    const r = event.primary.relevance, personal = eventPersonalState(event, state)
    const text = normalize(event.members.map(m => [m.title, m.publisher, m.section, ...m.relevance.subjects, ...m.relevance.topics, ...m.relevance.staticAnchors, ...m.relevance.signals].join(' ')).join(' '))
    return !personal.ignoredAt && (filters.days ? filters.days.includes(event.day) : event.day === filters.day) && readingQueue(personal) === filters.tab
      && (filters.exam === 'All' || filters.exam === 'Both' && r.exam === 'both' || filters.exam === 'Prelims' && (r.exam === 'prelims' || r.exam === 'both') || filters.exam === 'Mains' && (r.exam === 'mains' || r.exam === 'both'))
      && (filters.subject === 'All subjects' || r.subjects.includes(filters.subject)) && (filters.publisher === 'All sources' || event.members.some(m => m.publisher === filters.publisher)) && terms.every(t => text.includes(t))
  }).sort(valueOrder)
  return filters.budget ? timeBudgetSelection(matches, state, filters.budget) : matches
}
