/**
 * The whole derived Atlas state in one hook: exploration, mastery, XP and the
 * review queue. Inputs are shared live queries, and the result is cached per
 * input identity, so every screen can call this cheaply.
 */
import { useClaims, useRecalls } from '@/data/hooks'
import type { ChallengeClaim, RecallAttempt } from '@/data/types'
import { levelInfo, xpBreakdown, type XpBreakdown } from '@/game/progression'
import { type DayKey } from '@/lib/time'
import { useDay } from '@/lib/useDay'
import { useAtlas, type AtlasData } from './data'
import { explore, type ExploreState } from './explore'
import { computeMastery, dueForReview, type DueItem, type MasteryMap } from './mastery'

export interface Exploration {
  atlas: AtlasData
  state: ExploreState
  mastery: MasteryMap
  familiarAt: Map<string, number>
  xp: XpBreakdown
  level: ReturnType<typeof levelInfo>
  due: DueItem[]
  today: DayKey
}

let cache: { key: unknown[]; value: Exploration } | null = null

export function computeExploration(atlas: AtlasData, recalls: RecallAttempt[], claims: ChallengeClaim[], today: DayKey): Exploration {
  const key = [atlas, recalls, claims, today]
  if (cache && cache.key.every((k, i) => k === key[i])) return cache.value
  const mastery = computeMastery(recalls, today)
  const familiarAt = new Map<string, number>()
  for (const [id, m] of mastery) if (m.familiarAt !== null) familiarAt.set(id, m.familiarAt)
  const state = explore({ atlas, familiarAt })
  const xp = xpBreakdown(claims, recalls)
  const value: Exploration = {
    atlas,
    state,
    mastery,
    familiarAt,
    xp,
    level: levelInfo(xp.total),
    due: dueForReview(state.discovered, mastery, today, (id) => atlas.byId.get(id)?.yield?.score ?? 0),
    today,
  }
  cache = { key, value }
  return value
}

/** `load: false` – use the Atlas state if the gazetteer is already here, without asking for it (see useAtlas). */
export function useExploration(load = true): Exploration | null {
  const atlas = useAtlas(load)
  const recalls = useRecalls()
  const claims = useClaims()
  const today = useDay()
  if (!atlas) return null
  return computeExploration(atlas, recalls, claims, today)
}

/** XP and level without waiting for the gazetteer (it doesn't need it). */
export function useXp() {
  const recalls = useRecalls()
  const claims = useClaims()
  const xp = xpBreakdown(claims, recalls)
  return { xp, level: levelInfo(xp.total) }
}
