/**
 * Mastery comes only from recall, never from time spent:
 *
 *   Accessible  no recall yet (travel is tracked separately)
 *   discovered  legacy internal key for travel or recall started
 *   Familiar    1 correct answer
 *   Strong      3 correct, of at least 2 question types, on at least 2 days
 *   Mastered    5 correct, including a locate or ordering question, spread over
 *               at least 7 days, with 85%+ accuracy over the last 8 answers
 *
 * Spaced review uses Leitner-style boxes with intervals of 1, 3, 7, 16 and 35
 * days. A wrong answer sends a place back to the first box. Places that are
 * well overdue fade one level on the map (they are never un-discovered).
 */
import type { QuestionType, RecallAttempt } from '@/data/types'
import { addDaysKey, type DayKey } from '@/lib/time'

export type MasteryLevel = 'unknown' | 'discovered' | 'familiar' | 'strong' | 'mastered'
export const MASTERY_ORDER: MasteryLevel[] = ['unknown', 'discovered', 'familiar', 'strong', 'mastered']
export const MASTERY_LABEL: Record<MasteryLevel, string> = {
  unknown: 'Accessible',
  discovered: 'Recall started',
  familiar: 'Familiar',
  strong: 'Strong',
  mastered: 'Mastered',
}

export const INTERVALS = [1, 3, 7, 16, 35]
const DAY = 86_400_000

export interface PlaceMastery {
  level: MasteryLevel
  /** Level shown on the map: one lower when the review is well overdue. */
  shown: MasteryLevel
  attempts: number
  correct: number
  /** Consecutive correct answers at the end (Leitner box, 0–5). */
  box: number
  lastAt: number | null
  /** Day of the first answer. */
  firstDate: DayKey | null
  /** Day the next review is due (null when never reviewed). */
  due: DayKey | null
  types: Set<QuestionType | 'pyq'>
  /** When the place first became Familiar / Strong (for gates and challenges). */
  familiarAt: number | null
  strongAt: number | null
}

export const atLeast = (level: MasteryLevel, min: MasteryLevel) => MASTERY_ORDER.indexOf(level) >= MASTERY_ORDER.indexOf(min)

function levelFor(correct: RecallAttempt[], recent: RecallAttempt[]): MasteryLevel {
  const n = correct.length
  if (n === 0) return 'discovered'
  const types = new Set(correct.map((r) => r.type))
  const days = new Set(correct.map((r) => r.date))
  if (n >= 5) {
    const spread = correct[correct.length - 1].at - correct[0].at
    const spatial = correct.some((r) => r.type === 'locate' || r.type === 'order')
    const last = recent.slice(-8)
    const accuracy = last.filter((r) => r.correct).length / last.length
    if (spatial && spread >= 7 * DAY && accuracy >= 0.85 && types.size >= 2) return 'mastered'
  }
  if (n >= 3 && types.size >= 2 && days.size >= 2) return 'strong'
  return 'familiar'
}

/** Mastery for one place from its attempts (oldest first). */
export function masteryOf(attempts: RecallAttempt[], today: DayKey): Omit<PlaceMastery, 'level' | 'shown'> & { level: MasteryLevel; shown: MasteryLevel } {
  const correct: RecallAttempt[] = []
  let familiarAt: number | null = null
  let strongAt: number | null = null
  let box = 0
  for (let i = 0; i < attempts.length; i++) {
    const r = attempts[i]
    if (r.correct) {
      correct.push(r)
      box = Math.min(INTERVALS.length, box + 1)
    } else box = 0
    const lvl = levelFor(correct, attempts.slice(0, i + 1))
    if (familiarAt === null && atLeast(lvl, 'familiar')) familiarAt = r.at
    if (strongAt === null && atLeast(lvl, 'strong')) strongAt = r.at
  }
  const level = levelFor(correct, attempts)
  const last = attempts[attempts.length - 1]
  const due = last ? addDaysKey(last.date, box === 0 ? 1 : INTERVALS[box - 1]) : null
  let shown = level
  if (due && box > 0) {
    // Well overdue (by more than its own interval): fade one level.
    const overdueBy = daysBetween(due, today)
    if (overdueBy > INTERVALS[box - 1] && MASTERY_ORDER.indexOf(level) > 2) shown = MASTERY_ORDER[MASTERY_ORDER.indexOf(level) - 1]
  }
  return {
    level,
    shown,
    attempts: attempts.length,
    correct: correct.length,
    box,
    lastAt: last?.at ?? null,
    firstDate: attempts[0]?.date ?? null,
    due,
    types: new Set(correct.map((r) => r.type)),
    familiarAt,
    strongAt,
  }
}

function daysBetween(a: DayKey, b: DayKey): number {
  return Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / DAY)
}

export type MasteryMap = Map<string, PlaceMastery>

/** Mastery for every place that has been answered. Discovered-but-unanswered places are not included. */
export function computeMastery(recalls: RecallAttempt[], today: DayKey): MasteryMap {
  const byPlace = new Map<string, RecallAttempt[]>()
  for (const r of recalls) {
    // PYQs credit only their explicit snapshot of eligible primary relations, never the context place or distractors.
    const ids = r.type === 'pyq' ? r.pyq?.eligiblePlaceIds ?? [] : [r.placeId]
    for (const id of new Set(ids.filter(Boolean))) {
      if (!byPlace.has(id)) byPlace.set(id, [])
      byPlace.get(id)!.push(r)
    }
  }
  const out: MasteryMap = new Map()
  for (const [id, list] of byPlace) {
    list.sort((a, b) => a.at - b.at)
    out.set(id, masteryOf(list, today))
  }
  return out
}

/** Level for a place given discovery and recall. */
export function levelOf(id: string, discovered: boolean, mastery: MasteryMap, shown = false): MasteryLevel {
  const m = mastery.get(id)
  if (m) return shown ? m.shown : m.level
  return discovered ? 'discovered' : 'unknown'
}

export interface DueItem {
  id: string
  /** Days overdue (≥ 0), or −1 for a discovered place never reviewed. */
  overdue: number
}

/** New (never answered) places introduced per day, so a long history doesn't bury you. */
export const NEW_PER_DAY = 12

/**
 * Places due for review today: overdue reviews first (most overdue first), then
 * up to NEW_PER_DAY discovered places that have never been tested (most recent first).
 * With a `priority` (the study-priority score), equally overdue reviews and new
 * places are taken highest-priority first.
 */
export function dueForReview(discovered: Map<string, { at: number }>, mastery: MasteryMap, today: DayKey, priority?: (id: string) => number): DueItem[] {
  const overdue: DueItem[] = []
  const fresh: DueItem[] = []
  let newToday = 0
  for (const m of mastery.values()) if (m.firstDate === today) newToday++
  for (const [id, d] of discovered) {
    const m = mastery.get(id)
    if (!m) fresh.push({ id, overdue: -1 + d.at / 1e15 })
    else if (m.due && m.due <= today) overdue.push({ id, overdue: daysBetween(m.due, today) })
  }
  const prio = priority ?? (() => 0)
  // A freely accessible place tested before travelling still belongs in spaced review.
  for (const [id, m] of mastery) if (!discovered.has(id) && m.due && m.due <= today) overdue.push({ id, overdue: daysBetween(m.due, today) })
  overdue.sort((a, b) => b.overdue - a.overdue || prio(b.id) - prio(a.id))
  fresh.sort((a, b) => prio(b.id) - prio(a.id) || b.overdue - a.overdue)
  return [...overdue, ...fresh.slice(0, Math.max(0, NEW_PER_DAY - newToday))]
}
