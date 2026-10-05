/**
 * The world filling in. Everything here is derived from exploration and
 * mastery, so it grows back exactly the same on any device:
 *
 * - Routes appear once every place along them is discovered (the Golden
 *   Quadrilateral when Delhi, Mumbai, Chennai and Kolkata are).
 * - Ships sail off the ports of Developed states.
 * - Wildlife returns to parks you have Mastered.
 */
import { atLeast, levelOf } from './mastery'
import type { SheetId } from './types'
import type { Exploration } from './useExploration'

export type RouteKind = 'road' | 'rail' | 'trade' | 'sea'
export type Species = 'tiger' | 'rhino' | 'lion' | 'snow-leopard' | 'elephant' | 'crane' | 'turtle' | 'deer' | 'cheetah'

export interface LivingRoute {
  id: string
  name: string
  kind: RouteKind
  points: Array<[number, number]>
}
export interface Ship {
  id: string
  x: number
  y: number
  /** Unit vector pointing out to sea. */
  dx: number
  dy: number
}
export interface Wildlife {
  id: string
  x: number
  y: number
  species: Species
  name: string
}
export interface LivingWorld {
  routes: LivingRoute[]
  ships: Ship[]
  wildlife: Wildlife[]
  /** Discovered cities and capitals, lit on the night chart. */
  lights: Set<string>
}

interface RouteDef {
  id: string
  name: string
  kind: RouteKind
  sheet: SheetId
  /** Place ids in order; all must be discovered. */
  via: string[]
}

const ROUTES: RouteDef[] = [
  { id: 'golden-quadrilateral', name: 'Golden Quadrilateral', kind: 'road', sheet: 'india', via: ['in.capital.new-delhi', 'in.capital.jaipur', 'in.city.ahmedabad', 'in.capital.mumbai', 'in.city.pune', 'in.capital.bengaluru', 'in.capital.chennai', 'in.city.visakhapatnam', 'in.capital.bhubaneswar', 'in.capital.kolkata', 'in.city.varanasi', 'in.city.kanpur', 'in.city.agra', 'in.capital.new-delhi'] },
  { id: 'north-south-corridor', name: 'North–South Corridor', kind: 'road', sheet: 'india', via: ['in.capital.srinagar', 'in.capital.jammu', 'in.capital.chandigarh', 'in.capital.new-delhi', 'in.city.agra', 'in.city.jhansi', 'in.city.nagpur', 'in.capital.hyderabad', 'in.capital.bengaluru', 'in.city.madurai', 'in.cape.kanyakumari'] },
  { id: 'east-west-corridor', name: 'East–West Corridor', kind: 'road', sheet: 'india', via: ['in.city.silchar', 'in.city.guwahati', 'in.city.siliguri', 'in.capital.patna', 'in.city.gorakhpur', 'in.capital.lucknow', 'in.city.jhansi', 'in.city.kota', 'in.city.udaipur', 'in.city.ahmedabad', 'in.city.bhuj'] },
  { id: 'konkan-railway', name: 'Konkan Railway', kind: 'rail', sheet: 'india', via: ['in.capital.mumbai', 'in.coast.konkan-coast', 'in.capital.panaji', 'in.port.new-mangalore-port'] },
  { id: 'kaladan', name: 'Kaladan Multi-Modal Project', kind: 'sea', sheet: 'india', via: ['in.port.kolkata-port', 'in.port.sittwe', 'in.capital.aizawl'] },
]

/** Parks and the animal that returns when they are mastered. */
const WILDLIFE: Record<string, Species> = {
  'in.park.jim-corbett-national-park': 'tiger',
  'in.park.ranthambore-national-park': 'tiger',
  'in.park.kanha-national-park': 'deer',
  'in.park.sundarbans-national-park': 'tiger',
  'in.park.bandhavgarh-national-park': 'tiger',
  'in.park.kaziranga-national-park': 'rhino',
  'in.park.manas-national-park': 'rhino',
  'in.park.gir-national-park': 'lion',
  'in.park.hemis-national-park': 'snow-leopard',
  'in.park.periyar-tiger-reserve': 'elephant',
  'in.park.bandipur-national-park': 'elephant',
  'in.park.keoladeo-national-park': 'crane',
  'in.park.gahirmatha-marine-sanctuary': 'turtle',
  'in.park.keibul-lamjao-national-park': 'deer',
  'in.park.kuno-national-park': 'cheetah',
}
/** Every place id the living world refers to (checked against the gazetteer in tests). */
export const livingRefs = () => [...ROUTES.flatMap((r) => r.via), ...Object.keys(WILDLIFE)]

export function livingWorld(ex: Exploration, sheet: SheetId): LivingWorld {
  const { atlas, state, mastery } = ex
  const known = (id: string) => state.discovered.has(id)

  const routes: LivingRoute[] = []
  for (const r of ROUTES) {
    if (r.sheet !== sheet) continue
    const shown = r.via.every(known)
    if (!shown) continue
    const points = r.via.map((id) => atlas.byId.get(id)).filter((p): p is NonNullable<typeof p> => !!p && p.sheet === sheet).map((p) => [p.x, p.y] as [number, number])
    if (points.length > 1) routes.push({ id: r.id, name: r.name, kind: r.kind, points })
  }

  // Ships: Familiar ports in Developed (60% Strong) states.
  const developed = new Set<string>()
  const byUnit = new Map<string, { total: number; strong: number }>()
  for (const p of atlas.bySheet.india) {
    if (!p.unit || (p.added && !known(p.id))) continue
    const u = byUnit.get(p.unit) ?? { total: 0, strong: 0 }
    u.total++
    if (known(p.id) && atLeast(levelOf(p.id, true, mastery), 'strong')) u.strong++
    byUnit.set(p.unit, u)
  }
  for (const [u, v] of byUnit) if (v.total && v.strong / v.total >= 0.6) developed.add(u)
  const cx = sheet === 'india' ? 1150 : 1400
  const cy = sheet === 'india' ? 1050 : 600
  const ships: Ship[] = []
  for (const p of atlas.bySheet[sheet]) {
    if (p.kind !== 'port' || !known(p.id)) continue
    if (!(p.unit && developed.has(p.unit))) continue
    const len = Math.hypot(p.x - cx, p.y - cy) || 1
    ships.push({ id: p.id, x: p.x, y: p.y, dx: (p.x - cx) / len, dy: (p.y - cy) / len })
  }

  const wildlife: Wildlife[] = []
  for (const [id, species] of Object.entries(WILDLIFE)) {
    const p = atlas.byId.get(id)
    if (!p || p.sheet !== sheet || !known(id)) continue
    if (levelOf(id, true, mastery) === 'mastered') wildlife.push({ id, x: p.x, y: p.y, species, name: p.name })
  }


  const lights = new Set<string>()
  for (const p of atlas.bySheet[sheet]) if ((p.kind === 'city' || p.kind === 'capital' || p.kind === 'port') && known(p.id)) lights.add(p.id)

  return { routes, ships, wildlife, lights }
}
