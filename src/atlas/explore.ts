/** Atlas study coverage comes only from recall. Legacy time-based travel data is left in IndexedDB, unused. */
import type { AtlasData } from './data'
// Historical content-release boundary retained for provenance; no time conversion uses it.
export const ATLAS_V2_AT = Date.UTC(2026, 8, 26)
export interface Discovery { at: number; via: 'recall' }
export interface ExploreState { discovered: Map<string, Discovery>; explored: Set<string> }
export function explore({ atlas, familiarAt }: { atlas: AtlasData; familiarAt: Map<string, number> }): ExploreState {
  const discovered = new Map<string, Discovery>()
  const explored = new Set<string>()
  for (const [id, at] of familiarAt) {
    const place = atlas.byId.get(id)
    if (!place) continue
    discovered.set(id, { at, via: 'recall' })
    if (place.unit) explored.add(place.unit)
  }
  return { discovered, explored }
}
