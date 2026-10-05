/** Filter admitted questions using meaningful relations, never option-only geography. */
import type { AtlasPyqQuestion } from './types'
import type { AtlasData } from '../data'
import { meaningfulRelations } from './experience'
export interface PyqFilter { family?: string; year?: number; kind?: string; placeId?: string; mode?: string }
export function matchesPyq(q:AtlasPyqQuestion,filter:PyqFilter,atlas:AtlasData) {
  if(filter.family&&q.family!==filter.family||filter.year&&q.exam.year!==filter.year)return false
  const meaningful=meaningfulRelations(q.relations)
  return meaningful.some(r=>(!filter.placeId||r.placeId===filter.placeId)&&(!filter.kind||atlas.byId.get(r.placeId)?.kind===filter.kind))
}
