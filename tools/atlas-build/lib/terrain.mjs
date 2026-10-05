/**
 * Relief plates from AWS Terrain Tiles (SRTM / GMTED / ETOPO1, public data).
 * Elevation is sampled for every sheet pixel through the inverse projection,
 * shaded (Horn's method, light from the north-west) and coloured with classic
 * atlas hypsometric and bathymetric tints.
 */
import { PNG } from 'pngjs'
import sharp from 'sharp'
import { geoDistance } from 'd3-geo'
import { pool, terrainTile } from './fetch.mjs'

const TILE = 256

const lon2x = (lon, z) => ((lon + 180) / 360) * 2 ** z * TILE
const lat2y = (lat, z) => {
  const r = (Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180
  return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z * TILE
}

export async function loadDem(bbox, z) {
  const [x0, y0, x1, y1] = bbox
  const tx0 = Math.max(0, Math.floor(lon2x(Math.max(-180, x0), z) / TILE))
  const tx1 = Math.min(2 ** z - 1, Math.floor(lon2x(Math.min(180, x1) - 1e-9, z) / TILE))
  const ty0 = Math.max(0, Math.floor(lat2y(y1, z) / TILE))
  const ty1 = Math.min(2 ** z - 1, Math.floor(lat2y(y0, z) / TILE))
  const jobs = []
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) jobs.push([tx, ty])
  const tiles = new Map()
  let done = 0
  await pool(jobs, 12, async ([tx, ty]) => {
    const png = PNG.sync.read(await terrainTile(z, tx, ty))
    const elev = new Float32Array(TILE * TILE)
    for (let i = 0; i < TILE * TILE; i++) {
      const r = png.data[i * 4]
      const g = png.data[i * 4 + 1]
      const b = png.data[i * 4 + 2]
      elev[i] = r * 256 + g + b / 256 - 32768
    }
    tiles.set(`${tx}/${ty}`, elev)
    if (++done % 50 === 0) process.stdout.write(`  terrain tiles ${done}/${jobs.length}\r`)
  })
  const at = (px, py) => {
    const tx = Math.floor(px / TILE)
    const ty = Math.floor(py / TILE)
    const t = tiles.get(`${((tx % 2 ** z) + 2 ** z) % 2 ** z}/${ty}`)
    if (!t) return 0
    const ix = Math.min(TILE - 1, Math.max(0, Math.floor(px - tx * TILE)))
    const iy = Math.min(TILE - 1, Math.max(0, Math.floor(py - ty * TILE)))
    return t[iy * TILE + ix]
  }
  /** Bilinear elevation at lon/lat. */
  return (lon, lat) => {
    const px = lon2x(lon, z) - 0.5
    const py = lat2y(lat, z) - 0.5
    const fx = Math.floor(px)
    const fy = Math.floor(py)
    const dx = px - fx
    const dy = py - fy
    const a = at(fx, fy)
    const b = at(fx + 1, fy)
    const c = at(fx, fy + 1)
    const d = at(fx + 1, fy + 1)
    return a * (1 - dx) * (1 - dy) + b * dx * (1 - dy) + c * (1 - dx) * dy + d * dx * dy
  }
}

// Classic atlas hypsometric tints (metres → colour).
const LAND = [
  [0, [88, 150, 86]],
  [100, [118, 168, 96]],
  [200, [160, 190, 112]],
  [400, [208, 210, 136]],
  [600, [232, 214, 146]],
  [900, [226, 190, 124]],
  [1300, [212, 162, 98]],
  [1800, [192, 134, 80]],
  [2500, [166, 108, 66]],
  [3500, [140, 96, 72]],
  [4500, [150, 124, 116]],
  [5500, [186, 172, 170]],
  [6500, [236, 232, 232]],
  [8800, [255, 255, 255]],
]
// Bathymetric tints (depth, negative metres).
const SEA = [
  [0, [206, 232, 244]],
  [-50, [190, 224, 240]],
  [-200, [166, 210, 234]],
  [-1000, [138, 192, 226]],
  [-2500, [112, 172, 214]],
  [-4000, [92, 154, 204]],
  [-6000, [74, 136, 192]],
]

function ramp(stops, v) {
  const asc = stops[0][0] < stops[stops.length - 1][0]
  const s = asc ? stops : [...stops].reverse()
  if (v <= s[0][0]) return s[0][1]
  if (v >= s[s.length - 1][0]) return s[s.length - 1][1]
  for (let i = 1; i < s.length; i++) {
    if (v <= s[i][0]) {
      const t = (v - s[i - 1][0]) / (s[i][0] - s[i - 1][0])
      const a = s[i - 1][1]
      const b = s[i][1]
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
    }
  }
  return s[s.length - 1][1]
}

/** Rasterise projected land polygons to a mask (via SVG → sharp). */
export async function landMask(polygons, width, height) {
  const ringPath = (ring) => 'M' + ring.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + 'Z'
  const parts = []
  for (const g of polygons) {
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
    for (const p of polys) parts.push(`<path d="${p.map(ringPath).join('')}"/>`)
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><g fill="#fff" fill-rule="evenodd" stroke="#fff" stroke-width="2.5" stroke-linejoin="round">${parts.join('')}</g></svg>`
  const { data } = await sharp(Buffer.from(svg), { unlimited: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const mask = new Uint8Array(width * height)
  for (let i = 0; i < width * height; i++) mask[i] = data[i * 4 + 3]
  return mask
}

/**
 * Render relief (physical plate) and hillshade (for the political plate).
 * Returns WebP buffers.
 */
export async function renderRelief({ sheet, frame, landPolygons, icePolygons = [], elevation, grid }) {
  const { width: W, height: H } = frame
  const { inside, elev, metresPerPx } = grid ?? sampleGrid(sheet, frame, elevation)
  const mask = await landMask(landPolygons, W, H)
  const ice = icePolygons.length ? await landMask(icePolygons, W, H) : null
  return shadeAndTint({ sheet, W, H, inside, elev, metresPerPx, mask, ice })
}

/** Elevation for every sheet pixel (through the inverse projection). */
export function sampleGrid(sheet, frame, elevation) {
  const { projection, width: W, height: H } = frame
  const inside = new Uint8Array(W * H)
  const elev = new Float32Array(W * H)
  const metresPerPx = new Float32Array(H)
  for (let y = 0; y < H; y++) {
    let rowMetres = 0
    for (let x = 0; x < W; x++) {
      const ll = projection.invert([x + 0.5, y + 0.5])
      if (!ll || !Number.isFinite(ll[0]) || !Number.isFinite(ll[1])) continue
      // Outside the projection's outline (Robinson edges) → round-trip fails.
      const back = projection(ll)
      if (!back || Math.abs(back[0] - x - 0.5) > 0.5 || Math.abs(back[1] - y - 0.5) > 0.5) continue
      if (ll[1] < sheet.bbox[1] - 1 || ll[1] > sheet.bbox[3] + 1) continue
      inside[y * W + x] = 1
      elev[y * W + x] = elevation(ll[0], ll[1])
      if (!rowMetres && x > W / 2) {
        const nb = projection.invert([x + 1.5, y + 0.5])
        if (nb) rowMetres = geoDistance(ll, nb) * 6371008
      }
    }
    metresPerPx[y] = rowMetres || metresPerPx[y - 1] || 1000
    if (y % 200 === 0) process.stdout.write(`  sampling ${sheet.id} ${Math.round((y / H) * 100)}%   \r`)
  }
  return { inside, elev, metresPerPx, W, H }
}

async function shadeAndTint({ sheet, W, H, inside, elev, metresPerPx, mask, ice }) {
  const relief = Buffer.alloc(W * H * 4)
  const shade = Buffer.alloc(W * H * 4)
  // Light from the north-west, 45° above the horizon (the cartographic convention).
  const zenith = ((90 - 45) * Math.PI) / 180
  const azimuthMath = ((360 - 315 + 90) * Math.PI) / 180
  const get = (x, y) => elev[Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))]
  for (let y = 0; y < H; y++) {
    const cell = metresPerPx[y] / sheet.exaggeration
    for (let x = 0; x < W; x++) {
      const i = y * W + x
      if (!inside[i]) continue
      const isLand = mask[i] > 127
      // Horn's method
      const a = get(x - 1, y - 1), b = get(x, y - 1), c = get(x + 1, y - 1)
      const d = get(x - 1, y), f = get(x + 1, y)
      const g = get(x - 1, y + 1), h = get(x, y + 1), k = get(x + 1, y + 1)
      const dzdx = (c + 2 * f + k - (a + 2 * d + g)) / (8 * cell)
      const dzdy = (g + 2 * h + k - (a + 2 * b + c)) / (8 * cell)
      const slope = Math.atan(Math.hypot(dzdx, dzdy))
      const aspect = Math.atan2(dzdy, -dzdx)
      let hs = Math.cos(zenith) * Math.cos(slope) + Math.sin(zenith) * Math.sin(slope) * Math.cos(azimuthMath - aspect)
      hs = Math.max(0, Math.min(1, hs))
      const flat = Math.cos(zenith) // shade value of flat ground
      let color
      if (isLand) {
        color = ramp(LAND, Math.max(0, elev[i]))
        if (ice && ice[i] > 127) color = [242, 247, 250] // glaciers and ice sheets
        // Multiply-style shading, normalised so flat land keeps its tint.
        const k2 = Math.max(0.55, Math.min(1.25, 0.35 + (0.65 * hs) / flat))
        color = color.map((v) => Math.min(255, v * k2))
        const g8 = Math.round(Math.max(0, Math.min(255, 255 * Math.min(1, 0.25 + (0.75 * hs) / flat))))
        shade[i * 4] = g8
        shade[i * 4 + 1] = g8
        shade[i * 4 + 2] = g8
        shade[i * 4 + 3] = 255
      } else {
        color = ramp(SEA, Math.min(-1, elev[i]))
        const k2 = Math.max(0.9, Math.min(1.06, 0.8 + (0.2 * hs) / flat))
        color = color.map((v) => Math.min(255, v * k2))
      }
      relief[i * 4] = color[0]
      relief[i * 4 + 1] = color[1]
      relief[i * 4 + 2] = color[2]
      relief[i * 4 + 3] = 255
    }
  }
  process.stdout.write('\n')
  const reliefWebp = await sharp(relief, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 80, effort: 6 }).toBuffer()
  // The political plate shows the shading faintly, so half resolution is plenty.
  const shadeWebp = await sharp(shade, { raw: { width: W, height: H, channels: 4 } }).resize(Math.round(W / 2)).webp({ quality: 55, alphaQuality: 50, effort: 6 }).toBuffer()
  const previewPng = await sharp(relief, { raw: { width: W, height: H, channels: 4 } }).resize(Math.round(W / 2)).png().toBuffer()
  return { reliefWebp, shadeWebp, previewPng }
}
