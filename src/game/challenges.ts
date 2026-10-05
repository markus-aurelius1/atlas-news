/**
 * Daily and weekly challenges. The set for a period is chosen deterministically
 * from the date, so every device shows the same challenges and nothing needs to
 * be stored until the user claims a reward.
 */
import type { ChallengeClaim } from '@/data/types'
import { startOfWeekKey, type DayKey, type WeekStart } from '@/lib/time'
import { hashString, pick, seededRandom, shuffle } from '@/lib/random'

/** Atlas activity within the challenge period (computed by the caller). */
export interface AtlasActivity {
  /** Recall questions answered. */
  reviewed: number
  correct: number
  /** Mountain passes that reached Strong in this period. */
  passesStrong: number
}

export interface ChallengeContext {
  atlas: AtlasActivity
}

interface ChallengeDef {
  id: string
  period: 'day' | 'week'
  targets: number[]
  reward: (target: number) => number
  title: (target: number) => string
  measure: (ctx: ChallengeContext) => number
}

const DAILY: ChallengeDef[] = [
  {
    id: 'd-review',
    period: 'day',
    targets: [5, 8],
    reward: (n) => n * 3,
    title: (n) => `Review ${n} places in the Atlas`,
    measure: (c) => c.atlas.reviewed,
  },
]

const WEEKLY: ChallengeDef[] = [
  {
    id: 'w-recall',
    period: 'week',
    targets: [20, 30, 45],
    reward: (n) => n * 2,
    title: (n) => `Answer ${n} Atlas questions correctly`,
    measure: (c) => c.atlas.correct,
  },
  {
    id: 'w-pass',
    period: 'week',
    targets: [1, 2],
    reward: (n) => 40 + n * 20,
    title: (n) => (n === 1 ? 'Make a mountain pass Strong' : `Make ${n} mountain passes Strong`),
    measure: (c) => c.atlas.passesStrong,
  },
]

export interface ChallengeInstance {
  key: string
  id: string
  period: 'day' | 'week'
  periodKey: string
  title: string
  target: number
  reward: number
  progress: number
  complete: boolean
  claimed: boolean
}

function instantiate(def: ChallengeDef, periodKey: string, ctx: ChallengeContext, claims: ChallengeClaim[]): ChallengeInstance {
  const rand = seededRandom(hashString(`${def.id}:${periodKey}`))
  const target = pick(rand, def.targets)
  const progress = def.measure(ctx)
  return {
    key: `${def.id}@${periodKey}`,
    id: def.id,
    period: def.period,
    periodKey,
    title: def.title(target),
    target,
    reward: def.reward(target),
    progress,
    complete: progress >= target,
    claimed: claims.some((c) => c.challengeId === def.id && c.period === periodKey),
  }
}

export function dailyChallenges(today: DayKey, ctx: ChallengeContext, claims: ChallengeClaim[], count = 3): ChallengeInstance[] {
  const defs = shuffle(seededRandom(`daily:${today}`), DAILY).slice(0, count)
  return defs.map((d) => instantiate(d, today, ctx, claims))
}

export function weeklyChallenges(today: DayKey, weekStartsOn: WeekStart, ctx: ChallengeContext, claims: ChallengeClaim[], count = 2) {
  const week = startOfWeekKey(today, weekStartsOn)
  const defs = shuffle(seededRandom(`weekly:${week}`), WEEKLY).slice(0, count)
  return defs.map((d) => instantiate(d, week, ctx, claims))
}
