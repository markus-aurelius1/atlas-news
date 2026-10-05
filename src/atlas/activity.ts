/** Recall activity for the retained Atlas challenges. */
import type { AtlasActivity } from '@/game/challenges'
import type { RecallAttempt } from '@/data/types'
import { dayEndMs, dayStartMs, type DayKey } from '@/lib/time'
import type { Exploration } from './useExploration'
export function atlasActivity(ex: Exploration | null, recalls: RecallAttempt[], start: DayKey, end: DayKey): AtlasActivity {
  const inRange = recalls.filter(r => r.date >= start && r.date <= end)
  const from = dayStartMs(start), to = dayEndMs(end)
  let passesStrong = 0
  if (ex) for (const [id,m] of ex.mastery) if (m.strongAt !== null && m.strongAt >= from && m.strongAt < to && ex.atlas.byId.get(id)?.kind === 'pass') passesStrong++
  return { reviewed: inRange.length, correct: inRange.filter(r => r.correct).length, passesStrong }
}
