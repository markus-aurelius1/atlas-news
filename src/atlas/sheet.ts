/**
 * Loads a sheet file and decodes it once into ready-to-draw SVG path strings.
 * Coordinates are already projected into sheet pixels by the build step.
 */
import { useEffect, useState } from 'react'
import { chunkPath, type ChunkedPath } from '@/features/atlas/renderer/geometry'
import { feature, mesh, neighbors } from 'topojson-client'
import type { Feature, Geometry, MultiLineString, MultiPolygon, Polygon } from 'geojson'
import type { GeometryCollection, Topology } from 'topojson-specification'
import type { MapLabel, SheetFile, SheetId } from './types'

export interface MapFeature {
  id: string
  name: string
  d: string
  geometry: Polygon | MultiPolygon
  bbox: [number, number, number, number]
}

export interface MapLine {
  id: string
  name: string
  rank: number
  d: string
  coords: Array<Array<[number, number]>>
  /** Drawn from the overlay (a course the base sheet does not have). */
  overlay?: boolean
  canal?: boolean
}

/** An outline from the overlay: a protected area, a lake or wetland, a disputed region or a physical region. */
export interface AreaFeature extends MapFeature {
  kind: 'park' | 'water' | 'region' | 'land'
}

export interface Sheet {
  id: SheetId
  title: string
  width: number
  height: number
  states: MapFeature[]
  countries: MapFeature[]
  lakes: MapFeature[]
  rivers: MapLine[]
  regions: MapFeature[]
  marine: MapFeature[]
  /** Overlay outlines (parks, wetlands, disputed and physical regions), keyed `area:<id>` by places. */
  areas: AreaFeature[]
  chunks?: Record<string, ChunkedPath>
  lines: Record<'indiaBorder' | 'indiaCoast' | 'coasts' | 'intlBorders' | 'graticule' | 'stateBorders', string>
  labels: MapLabel[]
  /** State/country adjacency (by index into `states` / `countries`). */
  stateNeighbours: Map<string, string[]>
  reliefUrl: string
  shadeUrl: string
  /** Bounds of India (states) or of the populated world, for the initial view. */
  focus: [number, number, number, number]
}

const r1 = (n: number) => Math.round(n * 10) / 10

function ringPath(ring: number[][]): string {
  let s = ''
  for (let i = 0; i < ring.length; i++) s += (i ? 'L' : 'M') + r1(ring[i][0]) + ',' + r1(ring[i][1])
  return s + 'Z'
}

function polygonPath(g: Geometry | null): string {
  if (!g) return ''
  if (g.type === 'Polygon') return g.coordinates.map(ringPath).join('')
  if (g.type === 'MultiPolygon') return g.coordinates.map((p) => p.map(ringPath).join('')).join('')
  return ''
}

function linePath(lines: number[][][]): string {
  let s = ''
  for (const l of lines) for (let i = 0; i < l.length; i++) s += (i ? 'L' : 'M') + r1(l[i][0]) + ',' + r1(l[i][1])
  return s
}

function bboxOf(g: Polygon | MultiPolygon): [number, number, number, number] {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  for (const p of polys)
    for (const [x, y] of p[0]) {
      if (x < x0) x0 = x
      if (y < y0) y0 = y
      if (x > x1) x1 = x
      if (y > y1) y1 = y
    }
  return [x0, y0, x1, y1]
}

type Props = { id?: string; name?: string; rank?: number; kind?: AreaFeature['kind']; canal?: boolean }

function polygons(topo: Topology, key: string): MapFeature[] {
  const obj = topo.objects[key] as GeometryCollection<Props> | undefined
  if (!obj) return []
  const fc = feature(topo, obj) as unknown as { features: Array<Feature<Polygon | MultiPolygon, Props>> }
  return fc.features
    .filter((f) => f.geometry)
    .map((f) => ({ id: f.properties.id ?? '', name: f.properties.name ?? '', d: polygonPath(f.geometry), geometry: f.geometry, bbox: bboxOf(f.geometry) }))
}

function multiLine(topo: Topology, key: string): string {
  const obj = topo.objects[key]
  if (!obj) return ''
  const f = feature(topo, obj as GeometryCollection) as unknown as Feature<MultiLineString> | { features: Array<Feature<MultiLineString>> }
  const geoms = 'features' in f ? f.features.map((x) => x.geometry) : [f.geometry]
  return geoms.map((g) => (g ? linePath(g.coordinates) : '')).join('')
}

function riverLines(topo: Topology, overlay: boolean): MapLine[] {
  const obj = topo.objects.rivers as GeometryCollection<Props> | undefined
  if (!obj) return []
  const fc = feature(topo, obj) as unknown as { features: Array<Feature<MultiLineString | { type: 'LineString'; coordinates: number[][] }, Props>> }
  return fc.features
    .filter((f) => f.geometry)
    .map((f) => {
      const coords = (f.geometry.type === 'LineString' ? [f.geometry.coordinates] : (f.geometry as MultiLineString).coordinates) as Array<Array<[number, number]>>
      return { id: f.properties.id ?? '', name: f.properties.name ?? '', rank: f.properties.rank ?? 5, d: linePath(coords), coords, ...(overlay ? { overlay: true } : {}), ...(f.properties.canal ? { canal: true } : {}) }
    })
}

/** Courses, outlines and labels that the overlay adds to a sheet. */
export interface OverlayFile {
  version: number
  sheet: SheetId
  rivers: Topology
  areas: Topology
  labels: MapLabel[]
}

export function decodeSheet(file: SheetFile, base: string, overlay?: OverlayFile | null): Sheet {
  const topo = file.topology
  const states = polygons(topo, 'states')
  const rivers: MapLine[] = [...riverLines(topo, false), ...(overlay ? riverLines(overlay.rivers, true) : [])]
  const areas: AreaFeature[] = overlay ? polygons(overlay.areas, 'areas').map((f, i) => ({ ...f, kind: areaKinds(overlay.areas)[i] ?? 'land' })) : []

  const stateNeighbours = new Map<string, string[]>()
  let stateBorders = ''
  if (topo.objects.states) {
    const obj = topo.objects.states as GeometryCollection<Props>
    const nb = neighbors(obj.geometries)
    const idOf = (g: { properties?: Props | object | null }) => ((g.properties ?? {}) as Props).id ?? ''
    obj.geometries.forEach((g, i) => stateNeighbours.set(idOf(g), nb[i].map((j) => idOf(obj.geometries[j]))))
    stateBorders = linePath((mesh(topo, obj, (a, b) => a !== b) as MultiLineString).coordinates)
  }

  // India: the states. World: Africa to the western Pacific, with India near the middle.
  const focus: [number, number, number, number] = states.length
    ? states.reduce<[number, number, number, number]>((a, s) => [Math.min(a[0], s.bbox[0]), Math.min(a[1], s.bbox[1]), Math.max(a[2], s.bbox[2]), Math.max(a[3], s.bbox[3])], [Infinity, Infinity, -Infinity, -Infinity])
    : [file.width * 0.38, file.height * 0.06, file.width * 0.98, file.height * 0.94]

  const result: Sheet = {
    id: file.sheet,
    title: file.title,
    width: file.width,
    height: file.height,
    states,
    countries: polygons(topo, 'countries'),
    lakes: polygons(topo, 'lakes'),
    rivers,
    regions: polygons(file.shapes, 'regions'),
    marine: polygons(file.shapes, 'marine'),
    areas,
    lines: {
      indiaBorder: multiLine(file.lines, 'indiaBorder'),
      indiaCoast: multiLine(file.lines, 'indiaCoast'),
      coasts: multiLine(file.lines, 'coasts'),
      intlBorders: multiLine(file.lines, 'intlBorders'),
      graticule: multiLine(file.lines, 'graticule'),
      stateBorders,
    },
    labels: overlay ? [...file.labels, ...overlay.labels] : file.labels,
    stateNeighbours,
    reliefUrl: `${base}atlas/v1/${file.sheet}-relief.webp`,
    shadeUrl: `${base}atlas/v1/${file.sheet}-shade.webp`,
    focus,
  }
  result.chunks = {}
  for (const [key, d] of Object.entries(result.lines)) result.chunks[key] = chunkPath(d)
  for (const group of ['states', 'countries', 'lakes', 'rivers', 'areas'] as const)
    for (const f of result[group]) result.chunks[group + ':' + f.id] = chunkPath(f.d)
  return result
}

/** Kinds of the overlay's areas, in geometry order (kept beside `polygons`, which drops properties it doesn't know). */
function areaKinds(topo: Topology): Array<AreaFeature['kind']> {
  const obj = topo.objects.areas as GeometryCollection<Props> | undefined
  return obj ? obj.geometries.filter((g) => g.type !== null).map((g) => (g.properties as Props | undefined)?.kind ?? 'land') : []
}

const cache = new Map<SheetId, Promise<Sheet>>()

export function loadSheet(id: SheetId): Promise<Sheet> {
  const hit = cache.get(id)
  if (hit) return hit
  const base = import.meta.env.BASE_URL
  const sheetFile = fetch(`${base}atlas/v1/${id}.json`).then((r) => {
    if (!r.ok) throw new Error(`Atlas sheet ${id}: ${r.status}`)
    return r.json() as Promise<SheetFile>
  })
  // The overlay is optional: the map still works (with fewer outlines) without it.
  const overlayFile = fetch(`${base}atlas/v1/${id}-overlay.json`)
    .then((r) => (r.ok ? (r.json() as Promise<OverlayFile>) : null))
    .catch(() => null)
  const p = Promise.all([sheetFile, overlayFile]).then(([file, overlay]) => decodeSheet(file, base, overlay))
  cache.set(id, p)
  p.catch(() => cache.delete(id))
  return p
}

export function useSheet(id: SheetId): { sheet: Sheet | null; error: Error | null } {
  const [state, setState] = useState<{ sheet: Sheet | null; error: Error | null }>({ sheet: null, error: null })
  useEffect(() => {
    let alive = true
    setState((s) => (s.sheet?.id === id ? s : { sheet: null, error: null }))
    loadSheet(id).then(
      (sheet) => alive && setState({ sheet, error: null }),
      (error: Error) => alive && setState({ sheet: null, error }),
    )
    return () => {
      alive = false
    }
  }, [id])
  return state
}

// ───────────────────────── planar geometry helpers ─────────────────────────

export function pointInGeometry([x, y]: [number, number], g: Polygon | MultiPolygon): boolean {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates
  for (const poly of polys) {
    let inside = false
    for (const ring of poly) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const xi = ring[i][0],
          yi = ring[i][1],
          xj = ring[j][0],
          yj = ring[j][1]
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
      }
    }
    if (inside) return true
  }
  return false
}

export function featureAt(features: MapFeature[], p: [number, number]): MapFeature | undefined {
  return features.find((f) => p[0] >= f.bbox[0] && p[0] <= f.bbox[2] && p[1] >= f.bbox[1] && p[1] <= f.bbox[3] && pointInGeometry(p, f.geometry))
}

export function distanceToLines(p: [number, number], lines: Array<Array<[number, number]>>): number {
  let best = Infinity
  for (const l of lines) {
    for (let i = 1; i < l.length; i++) {
      const [x0, y0] = l[i - 1]
      const [x1, y1] = l[i]
      const dx = x1 - x0
      const dy = y1 - y0
      const t = Math.max(0, Math.min(1, ((p[0] - x0) * dx + (p[1] - y0) * dy) / (dx * dx + dy * dy || 1)))
      const d = Math.hypot(p[0] - (x0 + t * dx), p[1] - (y0 + t * dy))
      if (d < best) best = d
    }
  }
  return best
}
