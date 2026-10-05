import mapshaper from 'mapshaper'
import * as shapefile from 'shapefile'
import { geoProject } from 'd3-geo-projection'
import { topology } from 'topojson-server'
import { mesh, feature, neighbors as topoNeighbors } from 'topojson-client'
import polylabel from 'polylabel'

export const slug = (s) =>
  String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

export async function readShapefile(shp, dbf) {
  return shapefile.read(shp, dbf, { encoding: 'utf-8' })
}

/** Run mapshaper commands on a GeoJSON object, returning GeoJSON. */
export async function ms(geojson, commands) {
  const out = await mapshaper.applyCommands(`-i in.json ${commands} -o out.json format=geojson`, { 'in.json': JSON.stringify(geojson) })
  return JSON.parse(out['out.json'].toString())
}

/**
 * d3-geo treats a polygon's exterior ring as clockwise (holes counter-clockwise);
 * a ring wound the other way means "the whole globe except this". Normalise every
 * ring by its planar lon/lat orientation, which is reliable for these datasets.
 */
export function rewind(geojson) {
  const signed = (ring) => {
    let a = 0
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1])
    return a // < 0 → clockwise in lon/lat (y up)
  }
  const fixPoly = (poly) => poly.map((ring, i) => ((i === 0) === signed(ring) < 0 ? ring : [...ring].reverse()))
  const fixGeom = (g) => {
    if (!g) return g
    if (g.type === 'Polygon') return { ...g, coordinates: fixPoly(g.coordinates) }
    if (g.type === 'MultiPolygon') return { ...g, coordinates: g.coordinates.map(fixPoly) }
    return g
  }
  if (geojson.type === 'FeatureCollection') return { ...geojson, features: geojson.features.map((f) => ({ ...f, geometry: fixGeom(f.geometry) })) }
  return fixGeom(geojson)
}

export function project(geojson, projection) {
  return geoProject(rewind(geojson), projection)
}

const round = (n, p = 10) => Math.round(n * p) / p

/** Round planar coordinates (0.1 px) to keep files small. */
export function roundGeometry(g, p = 10) {
  const r = (c) => (typeof c[0] === 'number' ? [round(c[0], p), round(c[1], p)] : c.map(r))
  return g ? { ...g, coordinates: r(g.coordinates) } : g
}

export function toTopology(objects, quantization = 5e4) {
  return topology(objects, quantization)
}

/** Reduce a polyline to at most n points by even resampling along its length. */
export function resample(line, n) {
  if (!line || line.length <= n) return line
  const d = [0]
  for (let i = 1; i < line.length; i++) d.push(d[i - 1] + Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1]))
  const total = d[d.length - 1]
  const out = []
  let j = 1
  for (let k = 0; k < n; k++) {
    const t = (total * k) / (n - 1)
    while (j < line.length - 1 && d[j] < t) j++
    const f = (t - d[j - 1]) / (d[j] - d[j - 1] || 1)
    out.push([Math.round(line[j - 1][0] + (line[j][0] - line[j - 1][0]) * f), Math.round(line[j - 1][1] + (line[j][1] - line[j - 1][1]) * f)])
  }
  return out
}

export { mesh, feature, topoNeighbors }

/** Pole of inaccessibility of the largest polygon – a label point that is always inside. */
export function labelPoint(geometry) {
  if (!geometry) return null
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []
  let best = null
  let bestArea = -1
  for (const p of polys) {
    const a = Math.abs(ringArea(p[0]))
    if (a > bestArea) {
      bestArea = a
      best = p
    }
  }
  if (!best) return null
  const pt = polylabel(best, 1)
  return { x: round(pt[0]), y: round(pt[1]), area: bestArea, radius: round(pt.distance) }
}

export function ringArea(ring) {
  let a = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1])
  return a / 2
}

export function totalArea(geometry) {
  const polys = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : []
  let a = 0
  for (const p of polys) a += Math.abs(ringArea(p[0])) - p.slice(1).reduce((s, h) => s + Math.abs(ringArea(h)), 0)
  return a
}

export function pointInPolygon([x, y], geometry) {
  const polys = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : []
  for (const poly of polys) {
    let inside = false
    for (const ring of poly) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]
        const [xj, yj] = ring[j]
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
      }
    }
    if (inside) return true
  }
  return false
}

/** Longest continuous run of a (multi)line – used to lay river labels along the river. */
/** Chain line pieces whose ends touch (Natural Earth splits rivers at confluences). */
export function joinLines(lines, tol = 1.5) {
  const pool = lines.filter((l) => l && l.length > 1).map((l) => [...l])
  const near = (a, b) => Math.abs(a[0] - b[0]) <= tol && Math.abs(a[1] - b[1]) <= tol
  const out = []
  while (pool.length) {
    let cur = pool.shift()
    let grew = true
    while (grew) {
      grew = false
      for (let i = 0; i < pool.length; i++) {
        const l = pool[i]
        const a = cur[0], b = cur[cur.length - 1]
        if (near(b, l[0])) cur = cur.concat(l.slice(1))
        else if (near(b, l[l.length - 1])) cur = cur.concat([...l].reverse().slice(1))
        else if (near(a, l[l.length - 1])) cur = l.concat(cur.slice(1))
        else if (near(a, l[0])) cur = [...l].reverse().concat(cur.slice(1))
        else continue
        pool.splice(i, 1)
        grew = true
        break
      }
    }
    out.push(cur)
  }
  return out
}

export function longestLine(geometry) {
  const lines = joinLines(geometry?.type === 'LineString' ? [geometry.coordinates] : geometry?.type === 'MultiLineString' ? geometry.coordinates : [])
  let best = null
  let bestLen = 0
  for (const l of lines) {
    let len = 0
    for (let i = 1; i < l.length; i++) len += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1])
    if (len > bestLen) {
      bestLen = len
      best = l
    }
  }
  return { line: best, length: bestLen }
}

/** Keep the middle `fraction` of a polyline (by length) – a smooth stretch for a curved label. */
export function middleStretch(line, targetLength) {
  if (!line || line.length < 2) return null
  const seg = []
  let total = 0
  for (let i = 1; i < line.length; i++) {
    const d = Math.hypot(line[i][0] - line[i - 1][0], line[i][1] - line[i - 1][1])
    seg.push(d)
    total += d
  }
  const want = Math.min(total * 0.8, targetLength)
  const start = (total - want) / 2
  const out = []
  let acc = 0
  for (let i = 1; i < line.length; i++) {
    const a = acc
    const b = acc + seg[i - 1]
    if (b >= start && a <= start + want) {
      if (!out.length) {
        const t = (start - a) / (seg[i - 1] || 1)
        out.push([line[i - 1][0] + (line[i][0] - line[i - 1][0]) * Math.max(0, t), line[i - 1][1] + (line[i][1] - line[i - 1][1]) * Math.max(0, t)])
      }
      if (b <= start + want) out.push(line[i])
      else {
        const t = (start + want - a) / (seg[i - 1] || 1)
        out.push([line[i - 1][0] + (line[i][0] - line[i - 1][0]) * t, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * t])
        break
      }
    }
    acc = b
  }
  // Labels read left → right.
  if (out.length > 1 && out[0][0] > out[out.length - 1][0]) out.reverse()
  return out.map(([x, y]) => [round(x), round(y)])
}

/** Chaikin smoothing, so label paths curve gently. */
export function smooth(line, iterations = 2) {
  let pts = line
  for (let k = 0; k < iterations; k++) {
    const out = [pts[0]]
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i]
      const [x1, y1] = pts[i + 1]
      out.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1], [0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1])
    }
    out.push(pts[pts.length - 1])
    pts = out
  }
  return pts.map(([x, y]) => [round(x), round(y)])
}
