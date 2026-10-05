/**
 * The gazetteer (places.json): loaded once, indexed, cached by the service
 * worker for offline use. Static geographic data only – user progress lives in
 * IndexedDB and refers to places by id.
 */
import { useEffect, useSyncExternalStore } from 'react'
import type { CountryInfo, Place, PlacesFile, SheetId, StateInfo } from './types'

export interface AtlasData {
  places: Place[]
  byId: Map<string, Place>
  states: StateInfo[]
  state: (id: string | null | undefined) => StateInfo | undefined
  countries: CountryInfo[]
  country: (iso: string | null | undefined) => CountryInfo | undefined
  regions: PlacesFile['regions']
  /** Places whose fog unit is this state / country. */
  inUnit: Map<string, Place[]>
  bySheet: Record<SheetId, Place[]>
  /** Places that name this place in a relation (reverse links for place cards). */
  referencedBy: Map<string, Array<{ place: Place; key: string }>>
  /** How study priorities were computed; undefined until the PYQ ledger has data. */
  yieldModel?: PlacesFile['yieldModel']
}

export function indexAtlas(file: PlacesFile): AtlasData {
  const byId = new Map(file.places.map((p) => [p.id, p]))
  const inUnit = new Map<string, Place[]>()
  const bySheet: Record<SheetId, Place[]> = { india: [], world: [] }
  const referencedBy = new Map<string, Array<{ place: Place; key: string }>>()
  for (const p of file.places) {
    bySheet[p.sheet].push(p)
    if (p.unit) {
      if (!inUnit.has(p.unit)) inUnit.set(p.unit, [])
      inUnit.get(p.unit)!.push(p)
    }
    for (const [key, v] of Object.entries(p.rel ?? {})) {
      for (const ref of Array.isArray(v) ? v : [v]) {
        if (typeof ref !== 'string' || !byId.has(ref)) continue
        if (!referencedBy.has(ref)) referencedBy.set(ref, [])
        referencedBy.get(ref)!.push({ place: p, key })
      }
    }
  }
  const stateById = new Map(file.states.map((s) => [s.id, s]))
  const countryByIso = new Map(file.countries.map((c) => [c.iso, c]))
  return {
    places: file.places,
    byId,
    states: file.states,
    state: (id) => (id ? stateById.get(id) : undefined),
    countries: file.countries,
    country: (iso) => (iso ? countryByIso.get(iso) : undefined),
    regions: file.regions,
    inUnit,
    bySheet,
    referencedBy,
    yieldModel: file.yieldModel,
  }
}

let pending: Promise<AtlasData> | null = null
let loaded: AtlasData | null = null
const waiting = new Set<() => void>()

export function loadAtlas(): Promise<AtlasData> {
  if (pending) return pending
  pending = fetch(`${import.meta.env.BASE_URL}atlas/v1/places.json`)
    .then((r) => {
      if (!r.ok) throw new Error(`Atlas places: ${r.status}`)
      return r.json() as Promise<PlacesFile>
    })
    .then((f) => {
      loaded = indexAtlas(f)
      waiting.forEach((l) => l())
      return loaded
    })
  pending.catch(() => (pending = null))
  return pending
}

const subscribe = (cb: () => void) => {
  waiting.add(cb)
  return () => waiting.delete(cb)
}
const snapshot = () => loaded

/**
 * The gazetteer, or null until it has loaded.
 *
 * With `load` (the default) the caller needs it and the download starts now:
 * the Atlas, a place search, a review. With `load: false` the caller only
 * wants it if it is there (Home's review count, the action context): it is
 * told when the gazetteer arrives but never causes the 2.5 MB request itself.
 * The app asks for it once in idle time after start-up (App.tsx), so those
 * callers fill in a moment later without blocking shell startup.
 */
export function useAtlas(load = true): AtlasData | null {
  const data = useSyncExternalStore(subscribe, snapshot, snapshot)
  useEffect(() => {
    if (load && !loaded) loadAtlas().catch((e) => console.error('[atlas]', e))
  }, [load])
  return data
}

/** A short descriptor, e.g. "Mountain pass · 4,310 m · Sikkim". */
export function placeSubtitle(p: Place, atlas: AtlasData, kindName: string): string {
  const parts = [p.subtitle ?? kindName]
  if (p.elevation) parts.push(`${p.elevation.toLocaleString('en-IN')} m`)
  const where = p.states?.length
    ? p.states.length > 2
      ? `${p.states.length} states`
      : p.states.map((s) => atlas.state(s)?.name ?? s).join(' / ')
    : p.countries?.length
      ? p.countries.length > 2
        ? `${p.countries.length} countries`
        : p.countries.map((c) => atlas.country(c)?.name ?? c).join(' / ')
      : null
  if (where) parts.push(where)
  return parts.join(' · ')
}
