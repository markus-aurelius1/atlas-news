import type { AtlasData } from '@/atlas/data'
import { atLeast, levelOf, type MasteryLevel } from '@/atlas/mastery'
import type { Place, PlaceKind } from '@/atlas/types'
import type { Exploration } from '@/atlas/useExploration'
import type { AtlasStyle } from '@/data/types'
import { MAP_STYLES } from '@/game/progression'
import type { Plate, Tone } from './AtlasMap'
import { Symbol } from './symbols'

export function viewFor(style: AtlasStyle, rankIndex: number): { style: AtlasStyle; plate: Plate; tone: Tone } {
  const allowed = (MAP_STYLES.find((s) => s.id === style)?.minRank ?? 0) <= rankIndex ? style : 'physical'
  switch (allowed) {
    case 'political':
      return { style: allowed, plate: 'political', tone: 'day' }
    case 'night':
      return { style: allowed, plate: 'political', tone: 'night' }
    case 'antique':
      return { style: allowed, plate: 'physical', tone: 'antique' }
    default:
      return { style: 'physical', plate: 'physical', tone: 'day' }
  }
}

/** A place's symbol as a small inline icon for lists. */
export function PlaceIcon({ kind, tags, size = 22 }: { kind: PlaceKind; tags?: string[]; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-11 -11 22 22" aria-hidden="true" className="shrink-0 overflow-visible">
      <Symbol kind={kind} tags={tags} national={tags?.includes('national')} />
    </svg>
  )
}

export interface Crumb {
  label: string
  target?: { type: 'state' | 'country'; id: string }
}

/** World › Asia › India › Northern Plains › Uttar Pradesh › Varanasi */
export function breadcrumb(atlas: AtlasData, p: Place): Crumb[] {
  const out: Crumb[] = [{ label: 'World' }]
  const iso = p.sheet === 'india' ? (p.unit && atlas.state(p.unit) ? 'IND' : (p.unit ?? p.countries?.[0])) : (p.unit ?? p.countries?.[0])
  const country = atlas.country(iso)
  if (country) out.push({ label: country.continent }, { label: country.name, target: { type: 'country', id: country.id } })
  if (p.sheet === 'india' && p.unit && atlas.state(p.unit)) {
    const region = atlas.regions.find((r) => r.id === p.region)
    if (region) out.push({ label: region.name })
    out.push({ label: atlas.state(p.unit)!.name, target: { type: 'state', id: p.unit } })
  }
  return out
}

export type Development = 'uncharted' | 'charted' | 'settled' | 'developed' | 'flourishing'
export const DEVELOPMENT_LABEL: Record<Development, string> = {
  uncharted: 'Uncharted',
  charted: 'Charted',
  settled: 'Settled',
  developed: 'Developed',
  flourishing: 'Flourishing',
}
export const DEVELOPMENT_HINT: Record<Development, string> = {
  uncharted: 'Test a place here to chart it',
  charted: '30% of its places Familiar to settle it',
  settled: '60% Strong to develop it',
  developed: '80% Mastered to make it flourish',
  flourishing: 'Fully mastered',
}

/** How far a state (or country) has developed – driven by mastery of its places. */
export function developmentOf(ex: Exploration, unit: string) {
  // Preserve the historical denominator for untouched later additions, while
  // counting recall history independently.
  const places = (ex.atlas.inUnit.get(unit) ?? []).filter((p) => !p.added || ex.state.discovered.has(p.id) || ex.mastery.has(p.id))
  const total = places.length
  let discovered = 0
  let familiar = 0
  let strong = 0
  let mastered = 0
  for (const p of places) {
    const d = ex.state.discovered.has(p.id)
    if (d) discovered++
    const lvl = levelOf(p.id, d, ex.mastery)
    if (atLeast(lvl, 'familiar')) familiar++
    if (atLeast(lvl, 'strong')) strong++
    if (lvl === 'mastered') mastered++
  }
  let level: Development = discovered || familiar || ex.state.explored.has(unit) ? 'charted' : 'uncharted'
  if (total && familiar / total >= 0.3) level = 'settled'
  if (total && strong / total >= 0.6) level = 'developed'
  if (total && mastered / total >= 0.8) level = 'flourishing'
  return { level, total, discovered, familiar, strong, mastered }
}

export const masteryFn = (ex: Exploration) => (id: string): MasteryLevel => levelOf(id, ex.state.discovered.has(id), ex.mastery, true)

/** Designations and study tags, as shown on place cards and matched by search. */
export const TAG_LABEL: Record<string, string> = {
  ramsar: 'Ramsar site',
  'tiger-reserve': 'Tiger reserve',
  biosphere: 'Biosphere reserve',
  'national-park': 'National park',
  'world-heritage': 'World Heritage Site',
  montreux: 'Montreux Record',
  national: 'National capital',
  'current-affairs': 'In the news',
  strategic: 'Strategic',
}
