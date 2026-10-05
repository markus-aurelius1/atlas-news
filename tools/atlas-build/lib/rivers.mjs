/**
 * Rivers that Natural Earth does not carry (Luni, Sabarmati, Damodar, Gomti…)
 * are traced on the terrain model. A priority flood from the sea gives every
 * land cell a downstream neighbour with no pits (Barnes et al. 2014), so
 * following it from a river's source yields its course to the sea or to the
 * river it joins. Short west-coast rivers and distributaries, where a ~1.7 km
 * grid is too coarse, are given as hand-drawn courses instead.
 */
import { smooth } from './geo.mjs'

class MinHeap {
  constructor(capacity) {
    this.pri = new Float64Array(capacity)
    this.idx = new Int32Array(capacity)
    this.n = 0
  }
  push(p, i) {
    let k = this.n++
    const { pri, idx } = this
    while (k > 0) {
      const parent = (k - 1) >> 1
      if (pri[parent] <= p) break
      pri[k] = pri[parent]
      idx[k] = idx[parent]
      k = parent
    }
    pri[k] = p
    idx[k] = i
  }
  pop() {
    const { pri, idx } = this
    const topI = idx[0]
    const topP = pri[0]
    const lastP = pri[--this.n]
    const lastI = idx[this.n]
    let k = 0
    for (;;) {
      let c = 2 * k + 1
      if (c >= this.n) break
      if (c + 1 < this.n && pri[c + 1] < pri[c]) c++
      if (pri[c] >= lastP) break
      pri[k] = pri[c]
      idx[k] = idx[c]
      k = c
    }
    pri[k] = lastP
    idx[k] = lastI
    this.lastPriority = topP
    return topI
  }
}

/** Downstream pointer for every land cell (−1 for sea / outside). */
export function drainage({ W, H, elev, inside }, land) {
  const N = W * H
  const down = new Int32Array(N).fill(-1)
  const seen = new Uint8Array(N)
  const heap = new MinHeap(N)
  const nb = [-W - 1, -W, -W + 1, -1, 1, W - 1, W, W + 1]
  for (let i = 0; i < N; i++) {
    const x = i % W
    const y = (i / W) | 0
    // Sea = outside the land polygons *and* at or below sea level, so slivers
    // between neighbouring boundary datasets don't act as outlets.
    if (!inside[i] || (land[i] < 128 && elev[i] <= 0)) {
      seen[i] = 1
      continue
    }
    // Land cells touching the sea (or the sheet edge) are the outlets.
    let outlet = x === 0 || y === 0 || x === W - 1 || y === H - 1
    if (!outlet) for (const d of nb) if (!inside[i + d] || (land[i + d] < 128 && elev[i + d] <= 0)) outlet = true
    if (outlet) {
      seen[i] = 1
      heap.push(elev[i], i)
    }
  }
  while (heap.n) {
    const c = heap.pop()
    const pc = heap.lastPriority
    const x = c % W
    for (const d of nb) {
      const n = c + d
      if (n < 0 || n >= N || seen[n]) continue
      const nx = n % W
      if (Math.abs(nx - x) > 1) continue
      seen[n] = 1
      down[n] = c
      heap.push(Math.max(elev[n], pc + 1e-4), n)
    }
  }
  return down
}

/** Rasterise existing river lines so traced tributaries stop where they join. */
export function riverMask(lines, W, H) {
  const m = new Uint8Array(W * H)
  const plot = (x, y) => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const px = Math.round(x) + dx
        const py = Math.round(y) + dy
        if (px >= 0 && py >= 0 && px < W && py < H) m[py * W + px] = 1
      }
  }
  for (const l of lines)
    for (let i = 1; i < l.length; i++) {
      const [x0, y0] = l[i - 1]
      const [x1, y1] = l[i]
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)))
      for (let k = 0; k <= steps; k++) plot(x0 + ((x1 - x0) * k) / steps, y0 + ((y1 - y0) * k) / steps)
    }
  return m
}

function simplify(line, tol) {
  if (line.length < 3) return line
  const keep = new Uint8Array(line.length)
  keep[0] = keep[line.length - 1] = 1
  const stack = [[0, line.length - 1]]
  while (stack.length) {
    const [a, b] = stack.pop()
    const [x0, y0] = line[a]
    const [x1, y1] = line[b]
    const len = Math.hypot(x1 - x0, y1 - y0) || 1
    let best = -1
    let bestD = tol
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((y1 - y0) * line[i][0] - (x1 - x0) * line[i][1] + x1 * y0 - y1 * x0) / len
      if (d > bestD) {
        bestD = d
        best = i
      }
    }
    if (best >= 0) {
      keep[best] = 1
      stack.push([a, best], [best, b])
    }
  }
  return line.filter((_, i) => keep[i])
}

/**
 * @param specs  [{ id, name, rank, trace?: { from:[lat,lon], to?:[lat,lon] }, course?: [[lat,lon], …] }]
 * @returns GeoJSON features in sheet pixels, plus warnings.
 */
export function traceRivers(specs, { projection, W, H, down, mask }) {
  const features = []
  const warnings = []
  const round = (v) => Math.round(v * 10) / 10
  for (const s of specs) {
    let pts
    if (s.course) {
      pts = s.course.map(([lat, lon]) => projection([lon, lat]))
      pts = smooth(pts, 2)
    } else {
      const [slat, slon] = s.trace.from
      const [sx, sy] = projection([slon, slat])
      let c = Math.round(sy) * W + Math.round(sx)
      const to = s.trace.to ? projection([s.trace.to[1], s.trace.to[0]]) : null
      const cells = []
      let steps = 0
      while (c >= 0 && steps++ < 20000) {
        const x = c % W
        const y = (c / W) | 0
        cells.push([x + 0.5, y + 0.5])
        if (to && Math.hypot(x - to[0], y - to[1]) < 2.5) break
        // Joined an existing river (ignore the first few cells near the source).
        if (cells.length > 6 && mask[c]) break
        c = down[c]
      }
      if (cells.length < 8) {
        warnings.push(`river ${s.id}: trace too short (${cells.length} cells)`)
        continue
      }
      if (to) {
        const end = cells[cells.length - 1]
        const miss = Math.hypot(end[0] - to[0], end[1] - to[1])
        if (miss > 12) warnings.push(`river ${s.id}: trace ends ${miss.toFixed(0)} px from the expected mouth`)
      }
      pts = smooth(simplify(cells, 0.7), 2)
    }
    const line = simplify(pts, 0.35).map(([x, y]) => [round(x), round(y)])
    features.push({ type: 'Feature', properties: { id: s.id, name: s.name, rank: s.rank ?? 3, traced: true }, geometry: { type: 'LineString', coordinates: line } })
    // Later rivers may join this one.
    for (let i = 1; i < line.length; i++) {
      const [x0, y0] = line[i - 1]
      const [x1, y1] = line[i]
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0))
      for (let k = 0; k <= n; k++) {
        const px = Math.round(x0 + ((x1 - x0) * k) / n)
        const py = Math.round(y0 + ((y1 - y0) * k) / n)
        if (px >= 0 && py >= 0 && px < W && py < H) mask[py * W + px] = 1
      }
    }
  }
  return { features, warnings }
}
