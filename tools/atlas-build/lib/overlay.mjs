/**
 * The overlay: geometry for gazetteer places that the base sheets do not
 * draw – river courses, protected-area and wetland outlines, lakes, physical
 * and disputed regions, canals. It is kept apart from {india,world}.json so the
 * base sheets (and everything derived from them) stay unchanged.
 *
 * Every feature is matched to its place by Wikidata id:
 *   Natural Earth 1:10m (rivers, lakes, physical regions carry `wikidataid`) first,
 *   then OpenStreetMap (elements tagged `wikidata=Q…`, via Overpass; ODbL).
 *
 * Output (public/atlas/v1/{sheet}-overlay.json):
 *   { version, sheet, rivers: Topology, areas: Topology, lines: Topology, labels: MapLabel[] }
 * and, for the compiler, place id → geom key (`river:…`, `area:…`, `line:…`).
 */
import { feature as topoFeature } from 'topojson-client'
import { naturalEarth } from './fetch.mjs'
import { labelPoint, longestLine, pointInPolygon, project, resample, slug, smooth, toTopology, totalArea } from './geo.mjs'
import { osmByWikidata } from './wiki.mjs'
import { SHEETS, sheetFrame } from './sheets.mjs'

// ── geometry helpers (lon/lat and pixel space) ──────────────────────────────

const same = (a, b) => a[0] === b[0] && a[1] === b[1]

/** Join way segments into closed rings (OSM multipolygon outers). */
function assembleRings(segments) {
  const pool = segments.filter((s) => s.length > 1).map((s) => [...s])
  const rings = []
  while (pool.length) {
    let ring = pool.shift()
    let changed = true
    while (!same(ring[0], ring[ring.length - 1]) && changed) {
      changed = false
      for (let i = 0; i < pool.length; i++) {
        const seg = pool[i]
        const end = ring[ring.length - 1]
        if (same(end, seg[0])) ring = ring.concat(seg.slice(1))
        else if (same(end, seg[seg.length - 1])) ring = ring.concat([...seg].reverse().slice(1))
        else if (same(ring[0], seg[seg.length - 1])) ring = seg.concat(ring.slice(1))
        else if (same(ring[0], seg[0])) ring = [...seg].reverse().concat(ring.slice(1))
        else continue
        pool.splice(i, 1)
        changed = true
        break
      }
    }
    if (same(ring[0], ring[ring.length - 1]) && ring.length >= 4) rings.push(ring)
  }
  return rings
}

/** Join line segments that share endpoints (OSM river ways). */
function joinSegments(segments) {
  const pool = segments.filter((s) => s.length > 1).map((s) => [...s])
  const out = []
  while (pool.length) {
    let line = pool.shift()
    let changed = true
    while (changed) {
      changed = false
      for (let i = 0; i < pool.length; i++) {
        const seg = pool[i]
        const end = line[line.length - 1]
        if (same(end, seg[0])) line = line.concat(seg.slice(1))
        else if (same(end, seg[seg.length - 1])) line = line.concat([...seg].reverse().slice(1))
        else if (same(line[0], seg[seg.length - 1])) line = seg.concat(line.slice(1))
        else if (same(line[0], seg[0])) line = [...seg].reverse().concat(line.slice(1))
        else continue
        pool.splice(i, 1)
        changed = true
        break
      }
    }
    out.push(line)
  }
  return out
}

/** Douglas–Peucker in pixel space. */
function simplifyLine(pts, tol) {
  if (pts.length <= 2) return pts
  const keep = new Uint8Array(pts.length)
  keep[0] = keep[pts.length - 1] = 1
  const stack = [[0, pts.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    let best = -1
    let bestD = tol
    const [x0, y0] = pts[a]
    const [x1, y1] = pts[b]
    const dx = x1 - x0
    const dy = y1 - y0
    const len2 = dx * dx + dy * dy || 1e-9
    for (let i = a + 1; i < b; i++) {
      const t = Math.max(0, Math.min(1, ((pts[i][0] - x0) * dx + (pts[i][1] - y0) * dy) / len2))
      const d = Math.hypot(pts[i][0] - (x0 + t * dx), pts[i][1] - (y0 + t * dy))
      if (d > bestD) {
        bestD = d
        best = i
      }
    }
    if (best > 0) {
      keep[best] = 1
      stack.push([a, best], [best, b])
    }
  }
  return pts.filter((_, i) => keep[i])
}

const r1 = (n) => Math.round(n * 10) / 10
const roundPts = (pts) => pts.map(([x, y]) => [r1(x), r1(y)])

function simplifyGeometry(g, tol) {
  if (!g) return null
  if (g.type === 'LineString' || g.type === 'MultiLineString') {
    const lines = (g.type === 'LineString' ? [g.coordinates] : g.coordinates).map((l) => roundPts(simplifyLine(l, tol))).filter((l) => l.length > 1)
    return lines.length ? { type: 'MultiLineString', coordinates: lines } : null
  }
  if (g.type === 'Polygon' || g.type === 'MultiPolygon') {
    const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)
      .map((poly) => poly.map((ring) => roundPts(simplifyLine(ring, tol))).filter((ring) => ring.length >= 4))
      .filter((poly) => poly.length)
    return polys.length ? { type: 'MultiPolygon', coordinates: polys } : null
  }
  return null
}

/** Distance (px) from a point to a projected line or polygon geometry (0 inside a polygon). */
function distanceTo(pt, g) {
  const polys = g.type === 'MultiPolygon' ? g.coordinates : null
  if (polys && pointInPolygon(pt, g)) return 0
  const lines = polys ? polys.flat() : g.coordinates
  let best = Infinity
  for (const l of lines)
    for (let i = 1; i < l.length; i++) {
      const [x0, y0] = l[i - 1]
      const [x1, y1] = l[i]
      const dx = x1 - x0
      const dy = y1 - y0
      const t = Math.max(0, Math.min(1, ((pt[0] - x0) * dx + (pt[1] - y0) * dy) / (dx * dx + dy * dy || 1)))
      best = Math.min(best, Math.hypot(pt[0] - (x0 + t * dx), pt[1] - (y0 + t * dy)))
    }
  return best
}

const inBox = ([x0, y0, x1, y1]) => (c) => c[0] >= x0 && c[0] <= x1 && c[1] >= y0 && c[1] <= y1

// ── sources ────────────────────────────────────────────────────────────────

let neCache = null
async function neByQid() {
  if (neCache) return neCache
  const layers = {
    river: ['ne_10m_rivers_lake_centerlines', 'ne_10m_rivers_europe', 'ne_10m_rivers_north_america', 'ne_10m_rivers_australia'],
    lake: ['ne_10m_lakes', 'ne_10m_lakes_europe', 'ne_10m_lakes_north_america', 'ne_10m_lakes_australia'],
    region: ['ne_10m_geography_regions_polys'],
    marine: ['ne_10m_geography_marine_polys'],
  }
  neCache = {}
  for (const [kind, names] of Object.entries(layers)) {
    const m = new Map()
    for (const name of names) {
      const fc = await naturalEarth(name)
      for (const f of fc.features) {
        const q = f.properties.wikidataid ?? f.properties.WIKIDATAID
        if (!q || !f.geometry) continue
        const prev = m.get(q)
        if (!prev) m.set(q, { geometry: f.geometry, rank: f.properties.scalerank ?? f.properties.SCALERANK, name: f.properties.name_en ?? f.properties.name })
        else {
          // Natural Earth splits long rivers into pieces: merge them.
          const parts = (g) => (g.type.startsWith('Multi') ? g.coordinates : [g.coordinates])
          const multi = prev.geometry.type.includes('Line') ? 'MultiLineString' : 'MultiPolygon'
          prev.geometry = { type: multi, coordinates: [...parts(prev.geometry), ...parts(f.geometry)] }
        }
      }
    }
    neCache[kind] = m
  }
  return neCache
}

/** Parse WKT (points, lines, polygons, multi-, collections) into lists of lines and polygons (lon/lat). */
export function parseWkt(wkt) {
  const lines = []
  const polys = []
  // Tokenise into nested arrays: "((1 2, 3 4))" → [[[ [1,2],[3,4] ]]]
  const parse = (str) => {
    let i = 0
    const node = () => {
      const out = []
      while (i < str.length) {
        const c = str[i]
        if (c === '(') {
          i++
          out.push(node())
        } else if (c === ')') {
          i++
          return out
        } else if (c === ',' || c === ' ') i++
        else {
          const m = /^-?[\d.eE+-]+\s+-?[\d.eE+-]+/.exec(str.slice(i))
          if (m) {
            const [x, y] = m[0].trim().split(/\s+/).map(Number)
            out.push([x, y])
            i += m[0].length
          } else i++
        }
      }
      return out
    }
    return node()
  }
  const walk = (text) => {
    const t = text.trim()
    const type = /^[A-Z]+/.exec(t)?.[0]
    const body = t.slice(type?.length ?? 0).trim()
    if (type === 'GEOMETRYCOLLECTION') {
      // Split the members at depth 1.
      let depth = 0
      let from = 1
      for (let i = 0; i < body.length; i++) {
        if (body[i] === '(') depth++
        else if (body[i] === ')') depth--
        if ((depth === 1 && body[i] === ',') || (depth === 0 && i === body.length - 1)) {
          walk(body.slice(from, i))
          from = i + 1
        }
      }
      return
    }
    const tree = parse(body)[0] ?? []
    if (type === 'LINESTRING') lines.push(tree)
    else if (type === 'MULTILINESTRING') lines.push(...tree)
    else if (type === 'POLYGON') polys.push(tree)
    else if (type === 'MULTIPOLYGON') polys.push(...tree)
  }
  walk(wkt)
  return { lines: lines.filter((l) => l.length > 1), polys: polys.filter((pl) => pl.length && pl[0].length >= 4) }
}

/** OSM geometry (lon/lat) for Wikidata ids, via QLever: Map<qid, { lines, polys, ref }>. Relations win over their member ways. */
async function osmByQid(qids, { log }) {
  const out = new Map()
  const list = [...new Set(qids)]
  for (let i = 0; i < list.length; i += 20) {
    const batch = list.slice(i, i + 20)
    let rows = []
    try {
      rows = await osmByWikidata(batch)
    } catch (err) {
      log(`  ⚠ OSM batch ${i / 20 + 1}: ${err.message}`)
      continue
    }
    const byQ = new Map()
    for (const r of rows) (byQ.get(r.qid) ?? byQ.set(r.qid, []).get(r.qid)).push(r)
    for (const [qid, rs] of byQ) {
      const rel = rs.filter((r) => r.osm.includes('/relation/'))
      const use = rel.length ? rel : rs
      const g = { lines: [], polys: [], ref: use[0].osm }
      for (const r of use) {
        const parsed = parseWkt(r.wkt)
        g.lines.push(...parsed.lines)
        g.polys.push(...parsed.polys)
      }
      out.set(qid, g)
    }
    log(`  OSM ${Math.min(i + 20, list.length)}/${list.length}`)
  }
  return out
}

// ── the overlay ─────────────────────────────────────────────────────────────

const AREA_KINDS = { park: 'park', wetland: 'water', lake: 'water', strategic: 'region', desert: 'land', plateau: 'land', plain: 'land', region: 'land', valley: 'land', grassland: 'land', delta: 'land', coast: 'land' }
/** Strategic places drawn as an outline only when they are areas, not towns or bases. */
const STRATEGIC_AREA = /region|territory|oblast|strip|heights|corridor|province|state|exclave|zone|valley|plain|peninsula|republic|area|tract|islands|gap/i

/**
 * @param sheetId 'india' | 'world'
 * @param places  raw places for the sheet: { id (full), kind, name, qid, sub, lvl }
 * @param base    the base sheet data ({sheet}.json)
 * @param linked  place id → base geom (already drawn; skipped)
 */
export async function buildOverlay(sheetId, places, base, linked, { log = console.log } = {}) {
  const sheet = SHEETS[sheetId]
  const { projection, width, height } = sheetFrame(sheet)
  const bbox = sheet.bbox
  const within = inBox([bbox[0] - 2, bbox[1] - 2, bbox[2] + 2, bbox[3] + 2])
  const tol = sheetId === 'india' ? 0.35 : 0.45
  const ne = await neByQid()
  const baseRivers = new Set(topoFeature(base.topology, base.topology.objects.rivers).features.map((f) => f.properties.id))

  const want = places.filter((p) => p.qid && !linked.has(p.id))
  const needRiver = want.filter((p) => p.kind === 'river' || p.kind === 'canal')
  const needArea = want.filter((p) => AREA_KINDS[p.kind] && (p.kind !== 'strategic' || STRATEGIC_AREA.test(p.sub ?? '')))

  // Natural Earth first, OpenStreetMap for the rest.
  const fromNe = new Map()
  for (const p of needRiver) if (p.kind === 'river' && ne.river.has(p.qid)) fromNe.set(p.id, { ...ne.river.get(p.qid), src: 'ne' })
  for (const p of needArea) {
    const hit = (p.kind === 'lake' || p.kind === 'wetland' ? ne.lake : null)?.get(p.qid) ?? (AREA_KINDS[p.kind] === 'land' ? ne.region.get(p.qid) : null)
    if (hit) fromNe.set(p.id, { ...hit, src: 'ne' })
  }
  const osmQids = [...needRiver, ...needArea].filter((p) => !fromNe.has(p.id)).map((p) => p.qid)
  log(`  ${sheetId}: ${needRiver.length} courses and ${needArea.length} outlines wanted; ${fromNe.size} from Natural Earth, ${osmQids.length} to look up in OpenStreetMap`)
  const osm = osmQids.length ? await osmByQid(osmQids, { log }) : new Map()

  const rivers = []
  const areas = []
  const geomOf = new Map()
  const sources = new Map()
  const bad = []
  const far = []

  for (const p of [...needRiver, ...needArea]) {
    const isLine = p.kind === 'river' || p.kind === 'canal'
    let g = null
    const n = fromNe.get(p.id)
    if (n) g = n.geometry
    else {
      const o = osm.get(p.qid)
      if (!o) continue
      if (isLine) {
        // A river relation or its tagged ways: join the pieces into courses (outline rings of a riverbank are not a course).
        const lines = joinSegments(o.lines)
        g = lines.length ? { type: 'MultiLineString', coordinates: lines } : null
      } else {
        g = o.polys.length ? { type: 'MultiPolygon', coordinates: o.polys } : null
      }
      if (g) sources.set(p.id, { title: `OpenStreetMap: ${p.name}`, url: o.ref })
    }
    if (!g) continue
    // Keep what lies on the sheet.
    const coords = g.type.includes('Line') ? (g.type === 'LineString' ? [g.coordinates] : g.coordinates) : (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).map((poly) => poly[0])
    if (!coords.flat().some(within)) continue
    if (!isLine && g.type.includes('Line')) continue
    if (isLine && g.type.includes('Polygon')) continue
    // A FeatureCollection, so project() rewinds the rings first (OSM outers are counter-clockwise; unrewound, d3 reads them as the rest of the globe).
    const projected = project({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: g }] }, projection).features[0].geometry
    const simple = simplifyGeometry(projected, tol)
    if (!simple) {
      bad.push(p.id)
      continue
    }
    // A feature far from the place's sourced position is some other feature carrying the same tag: leave it out.
    if (p.x !== undefined && distanceTo([p.x, p.y], simple) > (isLine ? 120 : 60)) {
      far.push(p.id)
      continue
    }
    const key = p.id.split('.').slice(1).join('-')
    if (isLine) {
      const rid = p.kind === 'river' && !baseRivers.has(key) ? key : key
      rivers.push({ type: 'Feature', properties: { id: rid, name: p.name, rank: p.lvl === 1 ? 2 : p.lvl === 2 ? 3 : 4, canal: p.kind === 'canal' || undefined }, geometry: simple })
      geomOf.set(p.id, `river:${rid}`)
    } else {
      const area = totalArea(simple)
      if (area < 0.5) continue
      areas.push({ type: 'Feature', properties: { id: key, name: p.name, kind: AREA_KINDS[p.kind] }, geometry: simple })
      geomOf.set(p.id, `area:${key}`)
    }
    if (n) sources.set(p.id, { title: 'Natural Earth 1:10m', url: 'https://www.naturalearthdata.com/' })
  }

  // River names follow their course, like the base sheet's.
  const labels = []
  for (const f of rivers) {
    const { line, length } = longestLine(f.geometry)
    if (!line || length < 40) continue
    const n = Math.max(6, Math.min(90, Math.round(length / 14)))
    labels.push({ id: f.properties.id, kind: 'river', name: f.properties.name, rank: f.properties.rank, path: resample(smooth(line), n), size: Math.round(length) })
  }
  for (const f of areas) {
    const lp = labelPoint(f.geometry)
    f.properties.lx = Math.round(lp.x)
    f.properties.ly = Math.round(lp.y)
  }

  const data = {
    version: 1,
    sheet: sheetId,
    width,
    height,
    rivers: toTopology({ rivers: { type: 'FeatureCollection', features: rivers } }, 1e5),
    areas: toTopology({ areas: { type: 'FeatureCollection', features: areas } }, 1e5),
    labels,
  }
  log(`  ${sheetId} overlay: ${rivers.length} courses, ${areas.length} outlines${bad.length ? `, ${bad.length} too small to draw` : ''}${far.length ? `; left out (far from the place): ${far.join(', ')}` : ''}`)
  return { data, geomOf, sources }
}

export { slug }
