/** Place categories, shared by the gazetteer filter and the map's layer menu. */
import type { PlaceKind } from '@/atlas/types'

export interface PlaceGroup {
  id: string
  label: string
  kinds: PlaceKind[]
}

export const PLACE_GROUPS: PlaceGroup[] = [
  { id: 'mountains', label: 'Mountains', kinds: ['range', 'peak', 'pass', 'glacier', 'volcano'] },
  { id: 'water', label: 'Water', kinds: ['river', 'confluence', 'lake', 'wetland', 'dam', 'waterfall', 'sea', 'gulf', 'strait', 'canal'] },
  { id: 'land', label: 'Land & coast', kinds: ['plateau', 'plain', 'desert', 'valley', 'coast', 'delta', 'island', 'cape', 'grassland', 'region'] },
  { id: 'places', label: 'Cities & ports', kinds: ['capital', 'city', 'port'] },
  { id: 'parks', label: 'Parks', kinds: ['park'] },
  { id: 'heritage', label: 'Heritage', kinds: ['monument'] },
  { id: 'strategic', label: 'Strategic', kinds: ['strategic', 'facility'] },
]

/** Kinds shown for a selection of group ids (null = everything). */
export function kindsFor(groups: readonly string[]): Set<PlaceKind> | null {
  if (!groups.length) return null
  return new Set(PLACE_GROUPS.filter((g) => groups.includes(g.id)).flatMap((g) => g.kinds))
}
