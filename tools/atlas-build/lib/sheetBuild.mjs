import { geoGraticule } from 'd3-geo'
import { naturalEarth, dataMeet } from './fetch.mjs'
import { SHEETS, sheetFrame } from './sheets.mjs'
import { renderRelief, loadDem, sampleGrid, landMask } from './terrain.mjs'
import { drainage, riverMask, traceRivers } from './rivers.mjs'
import { riverSpecs } from './content.mjs'
import {
  feature,
  labelPoint,
  longestLine,
  mesh,
  ms,
  pointInPolygon,
  project,
  readShapefile,
  roundGeometry,
  slug,
  smooth,
  toTopology,
  totalArea,
  resample,
} from './geo.mjs'
import { STATES } from '../content/states.mjs'

const REGION_KIND = (cla) => {
  const c = String(cla || '').toLowerCase()
  if (c.includes('range') || c.includes('mtn') || c.includes('mountain') || c.includes('hill')) return 'range'
  if (c.includes('plateau')) return 'plateau'
  if (c.includes('desert')) return 'desert'
  if (c.includes('delta')) return 'delta'
  if (c.includes('coast')) return 'coast'
  if (c.includes('plain') || c.includes('lowland')) return 'plain'
  if (c.includes('basin')) return 'basin'
  if (c.includes('valley')) return 'valley'
  if (c.includes('peninsula') || c.includes('pen')) return 'peninsula'
  if (c.includes('isthmus')) return 'isthmus'
  if (c.includes('island') || c.includes('arch')) return 'island'
  if (c.includes('gorge')) return 'gorge'
  if (c.includes('continent')) return 'continent'
  return 'region'
}

const MARINE_KIND = (cla) => {
  const c = String(cla || '').toLowerCase()
  if (c.includes('ocean')) return 'ocean'
  if (c.includes('strait') || c.includes('channel') || c.includes('passage')) return 'strait'
  if (c.includes('gulf')) return 'gulf'
  if (c.includes('bay')) return 'bay'
  if (c.includes('sound') || c.includes('inlet') || c.includes('fjord') || c.includes('lagoon')) return 'bay'
  return 'sea'
}

const titleCase = (s) =>
  String(s)
    .toLowerCase()
    .replace(/(^|[\s.-])([a-z])/g, (m, a, b) => a + b.toUpperCase())
    .replace(/\bMts\b/g, 'Mts')

const niceName = (s) => (s === s.toUpperCase() ? titleCase(s) : s).replace('Arvalli', 'Aravalli').replace('Ra.', 'Range').replace('Mts.', 'Mountains').replace('Pen.', 'Peninsula')

/** Indian names for rivers Natural Earth labels differently. */
const INDIAN_NAMES = {
  Ganges: 'Ganga',
  'Mahana Nadi': 'Mahanadi',
  Godavari: 'Godavari',
  Ghaghara: 'Ghaghara',
  Tista: 'Teesta',
  Luhit: 'Lohit',
  Sapt: 'Kosi',
  'Sapt Kosi': 'Kosi',
  Cauvery: 'Kaveri',
  Dihang: 'Siang (Dihang)',
  Yarlung: 'Yarlung Tsangpo',
  Irrawaddy: 'Irrawaddy',
  'Ganges Plain': 'Indo-Gangetic Plain',
  'Ganges Delta': 'Ganga–Brahmaputra Delta',
  'Vale Of Kashmir': 'Kashmir Valley',
  'Laccadive Islands': 'Lakshadweep Islands',
  'Laccadive Sea': 'Lakshadweep Sea',
  'Southern Ghats': 'Southern Ghats',
  'Khasi Hills': 'Khasi Hills',
  'Naga Hills': 'Naga Hills',
  'Gulf Of Khambhat': 'Gulf of Khambhat',
  'Gulf Of Kutch': 'Gulf of Kutch',
  'Gulf Of Mannar': 'Gulf of Mannar',
}

/** Natural Earth splits long features into pieces – merge pieces that share an id. */
function mergeById(fc) {
  const byId = new Map()
  for (const f of fc.features) {
    const id = f.properties.id
    const g = f.geometry
    if (!g) continue
    const cur = byId.get(id)
    if (!cur) {
      byId.set(id, { ...f, geometry: g })
      continue
    }
    const parts = (x) => (x.type === 'LineString' || x.type === 'Polygon' ? [x.coordinates] : x.coordinates)
    const isLine = g.type.includes('Line')
    cur.geometry = { type: isLine ? 'MultiLineString' : 'MultiPolygon', coordinates: [...parts(cur.geometry), ...parts(g)] }
    cur.properties.rank = Math.min(cur.properties.rank ?? 9, f.properties.rank ?? 9)
  }
  return { ...fc, features: [...byId.values()] }
}

/**
 * River importance on the India sheet (1 = great rivers, 4 = minor). Natural
 * Earth's scalerank is a global cartographic rank and undervalues rivers such
 * as the Son or Chambal that matter in Indian geography.
 */
const INDIA_RIVER_RANK = {
  ganga: 1, indus: 1, brahmaputra: 1, godavari: 1, krishna: 1, narmada: 1, mahanadi: 1, kaveri: 1, yamuna: 1, 'siang-dihang': 1, 'yarlung-tsangpo': 1,
  tapi: 2, son: 2, chambal: 2, ghaghara: 2, gandak: 2, kosi: 2, sutlej: 2, chenab: 2, jhelum: 2, tungabhadra: 2, bhima: 2, penner: 2, mahi: 2, irrawaddy: 2, mekong: 2, salween: 2, betwa: 2, ravi: 2, beas: 2,
  wainganga: 3, indravati: 3, teesta: 3, brahmani: 3, lohit: 3, banas: 3, palar: 3, kolidam: 3, parbati: 3, chindwin: 3, 'amu-darya': 3, helmand: 3, yangtze: 3, 'irrawaddy-delta': 4, mahaweli: 3, kaladan: 3,
}

const riverRank = (sheetId, id, scalerank) => {
  if (sheetId === 'india' && INDIA_RIVER_RANK[id]) return INDIA_RIVER_RANK[id]
  const r = scalerank ?? 9
  if (sheetId === 'india') return r <= 3 ? 3 : 4
  return r <= 1 ? 1 : r <= 2 ? 2 : r <= 3 ? 3 : 4
}

/** Region labels that add clutter rather than information. */
const DROP_REGIONS = new Set(['india', 'europe', 'punjab', 'indian-subcontinent', 'sri-lanka', 'hexi-corridor', 'sumatra', 'malay-archipelago', 'greater-sunda-islands', 'turan-lowland', 'isthmus-of-kra', 'indochina-peninsula', 'yungui-plateau'])

/** Split lines into the parts that run along `polys` (within d px) and the rest. */
function classifyLines(lines, polys, d = 3.5) {
  const near = []
  const far = []
  for (const line of lines) {
    let cur = [line[0]]
    let curNear = null
    for (let i = 1; i < line.length; i++) {
      const [x0, y0] = line[i - 1]
      const [x1, y1] = line[i]
      const mx = (x0 + x1) / 2
      const my = (y0 + y1) / 2
      const len = Math.hypot(x1 - x0, y1 - y0) || 1
      const nx = (-(y1 - y0) / len) * d
      const ny = ((x1 - x0) / len) * d
      const isNear = polys.some((g) => pointInPolygon([mx + nx, my + ny], g) || pointInPolygon([mx - nx, my - ny], g))
      if (curNear === null) curNear = isNear
      if (isNear !== curNear) {
        ;(curNear ? near : far).push(cur)
        cur = [line[i - 1]]
        curNear = isNear
      }
      cur.push(line[i])
    }
    if (cur.length > 1) (curNear ? near : far).push(cur)
  }
  return { near, far }
}

const roundLines = (lines) => lines.map((l) => l.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]))
const multi = (g) => (!g ? [] : g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [])

function graticule(step, bbox, projection) {
  const g = geoGraticule().step([step, step]).extent([
    [bbox[0], bbox[1]],
    [bbox[2] + 0.001, bbox[3] + 0.001],
  ])
  return roundLines(multi(project(g(), projection)))
}

export async function buildSheet(id, { skipRelief = false } = {}) {
  const sheet = SHEETS[id]
  const frame = sheetFrame(sheet)
  const { projection, width, height } = frame
  const [bx0, by0, bx1, by1] = sheet.bbox
  const clip = `-clip bbox=${bx0 - 3},${by0 - 3},${bx1 + 3},${by1 + 3}`
  console.log(`\n▸ ${id}: ${width}×${height}`)

  // ── countries (India's official point of view) ───────────────────────────
  const neCountries = await naturalEarth('ne_10m_admin_0_countries_ind')
  let countries = await ms(neCountries, `${id === 'world' ? '' : `-clip bbox=${bx0 - 10},${by0 - 8},${bx1 + 10},${by1 + 8}`} -filter-fields ADMIN,NAME,ADM0_A3,ISO_A3,CONTINENT,SUBREGION,POP_EST -simplify ${id === 'world' ? '1.5%' : '8%'} keep-shapes`)
  countries.features = countries.features.map((f) => ({
    ...f,
    properties: {
      id: slug(f.properties.ADM0_A3 || f.properties.ADMIN),
      iso: f.properties.ADM0_A3,
      name: f.properties.NAME || f.properties.ADMIN,
      continent: f.properties.CONTINENT,
      subregion: f.properties.SUBREGION,
    },
  }))

  // ── states (India sheet only) ────────────────────────────────────────────
  let states = null
  if (id === 'india') {
    const raw = await readShapefile(await dataMeet('States/Admin2.shp'), await dataMeet('States/Admin2.dbf'))
    states = await ms(raw, '-simplify 3.5% keep-shapes')
    const byDm = new Map(STATES.map((s) => [s.dm, s]))
    states.features = states.features.map((f) => {
      const meta = byDm.get(f.properties.ST_NM)
      if (!meta) throw new Error(`Unknown state ${f.properties.ST_NM}`)
      return { ...f, properties: { id: meta.id, name: meta.name } }
    })
    // India is drawn from the states; the NE copy of India is dropped.
    countries.features = countries.features.filter((f) => f.properties.iso !== 'IND')
  }

  // ── physical layers ──────────────────────────────────────────────────────
  const scale = id === 'world' ? '50m' : '10m'
  // Natural Earth mixes upper- and lower-case field names between layers – normalise first.
  const norm = async (layer) => {
    const fc = await naturalEarth(layer)
    return {
      ...fc,
      features: fc.features.map((f) => {
        const p = Object.fromEntries(Object.entries(f.properties || {}).map(([k, v]) => [k.toLowerCase(), v]))
        return { ...f, properties: { name: p.name, name_en: p.name_en, scalerank: p.scalerank, featurecla: p.featurecla } }
      }),
    }
  }
  const rivers = await ms(await norm(`ne_${scale}_rivers_lake_centerlines`), `${id === 'world' ? '-filter "scalerank <= 4"' : clip} -simplify ${id === 'world' ? '15%' : '35%'}`)
  const lakes = await ms(await norm(`ne_${scale}_lakes`), `${id === 'world' ? '-filter "scalerank <= 2"' : clip} -simplify 15% keep-shapes`)
  const regions = await ms(await norm(`ne_${scale}_geography_regions_polys`), `${id === 'world' ? '-filter "scalerank <= 4"' : clip} -simplify ${id === 'world' ? '3%' : '10%'} keep-shapes`)
  const marine = await ms(await norm(`ne_${scale}_geography_marine_polys`), `${id === 'world' ? '-filter "scalerank <= 4"' : clip} -simplify ${id === 'world' ? '3%' : '10%'} keep-shapes`)

  const named = (fc, kindFn) =>
    mergeById({
      ...fc,
      features: fc.features
        .filter((f) => f.properties.name || f.properties.name_en)
        .map((f) => {
          let name = niceName(f.properties.name_en || f.properties.name)
          const plain = name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
          if (id === 'india' && INDIAN_NAMES[plain]) name = INDIAN_NAMES[plain]
          else if (plain !== name) name = plain
          return { ...f, properties: { id: slug(name), name, rank: f.properties.scalerank ?? 5, kind: kindFn ? kindFn(f.properties.featurecla) : undefined } }
        })
        .filter((f) => !DROP_REGIONS.has(f.properties.id)),
    })

  const P = (fc) => project(fc, projection)
  const pCountries = P(countries)
  const pStates = states ? P(states) : null
  const pRivers = P(named(rivers))
  for (const f of pRivers.features) f.properties.rank = riverRank(id, f.properties.id, f.properties.rank)

  // ── terrain (relief plate, and river tracing on the India sheet) ─────────
  const specs = id === 'india' ? riverSpecs() : []
  let grid = null
  let dem = null
  if (!skipRelief || specs.length) {
    console.log('  loading terrain…')
    // Terrain for everything visible in the frame (the conic frame reaches past the bbox corners).
    let lo0 = bx0, la0 = by0, lo1 = bx1, la1 = by1
    for (let i = 0; i <= 40; i++) {
      for (const [px, py] of [[(width * i) / 40, 0], [(width * i) / 40, height], [0, (height * i) / 40], [width, (height * i) / 40]]) {
        const ll = projection.invert([px, py])
        if (!ll || !Number.isFinite(ll[0])) continue
        lo0 = Math.min(lo0, ll[0]); lo1 = Math.max(lo1, ll[0]); la0 = Math.min(la0, ll[1]); la1 = Math.max(la1, ll[1])
      }
    }
    dem = await loadDem(id === 'world' ? [-180, by0 - 1, 180, by1 + 1] : [lo0 - 1, la0 - 1, lo1 + 1, la1 + 1], sheet.terrainZoom)
    grid = sampleGrid(sheet, frame, dem)
  }
  if (specs.length) {
    const known = new Set(pRivers.features.map((f) => f.properties.id))
    const todo = specs.filter((sp) => !known.has(sp.id))
    const land = await landMask([...pCountries.features, ...pStates.features].map((f) => f.geometry).filter(Boolean), width, height)
    const down = drainage(grid, land)
    const lines = pRivers.features.flatMap((f) => (f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates))
    const mask = riverMask(lines, width, height)
    const traced = traceRivers(todo, { projection, W: width, H: height, down, mask })
    for (const w of traced.warnings) console.warn('  ⚠ ' + w)
    pRivers.features.push(...traced.features)
    console.log(`  traced ${traced.features.length} rivers`)
  }
  const pLakes = P(named(lakes))
  const pRegions = P(named(regions, REGION_KIND))
  const pMarine = P(named(marine, MARINE_KIND))

  const objects = { countries: pCountries, lakes: pLakes, rivers: pRivers }
  if (pStates) objects.states = pStates
  const topo = toTopology(objects)

  // ── boundaries & coasts ──────────────────────────────────────────────────
  const countryPolys = feature(topo, topo.objects.countries).features.map((f) => f.geometry)
  const lines = { graticule: graticule(sheet.graticuleStep, sheet.bbox, projection) }
  if (pStates) {
    const statePolys = feature(topo, topo.objects.states).features.map((f) => f.geometry)
    // State borders are derived on the client from the topology (topojson mesh).
    const outline = multi(mesh(topo, topo.objects.states, (a, b) => a === b))
    const c = classifyLines(outline, countryPolys)
    lines.indiaBorder = roundLines(c.near)
    lines.indiaCoast = roundLines(c.far)
    const neighbourOutline = multi(mesh(topo, topo.objects.countries, (a, b) => a === b))
    const n = classifyLines(neighbourOutline, statePolys)
    lines.coasts = roundLines(n.far)
  } else {
    lines.coasts = roundLines(multi(mesh(topo, topo.objects.countries, (a, b) => a === b)))
  }
  lines.intlBorders = roundLines(multi(mesh(topo, topo.objects.countries, (a, b) => a !== b)))

  // ── labels ───────────────────────────────────────────────────────────────
  const inFrame = (p) => p && p.x > 20 && p.x < width - 20 && p.y > 20 && p.y < height - 20
  const labels = []
  if (pStates) {
    for (const f of pStates.features) {
      const p = labelPoint(f.geometry)
      const meta = STATES.find((s) => s.id === f.properties.id)
      labels.push({ id: f.properties.id, kind: 'state', name: f.properties.name, abbr: meta?.abbr, x: p.x, y: p.y, size: Math.sqrt(totalArea(f.geometry)), radius: p.radius })
    }
  }
  for (const f of pCountries.features) {
    const p = labelPoint(clipToFrame(f.geometry, width, height))
    if (!inFrame(p)) continue
    labels.push({ id: f.properties.id, kind: 'country', name: f.properties.name, x: p.x, y: p.y, size: Math.sqrt(totalArea(f.geometry)), radius: p.radius })
  }
  for (const f of pRivers.features) {
    const { line, length } = longestLine(f.geometry)
    if (!line || length < 40) continue
    // The whole course is kept; the client slides the name along it to a free spot.
    const n = Math.max(6, Math.min(90, Math.round(length / 14)))
    labels.push({ id: f.properties.id, kind: 'river', name: f.properties.name, rank: f.properties.rank, path: resample(smooth(line), n), size: length })
  }
  for (const f of pLakes.features) {
    const p = labelPoint(f.geometry)
    if (inFrame(p)) labels.push({ id: f.properties.id, kind: 'lake', name: f.properties.name, x: p.x, y: p.y, size: Math.sqrt(totalArea(f.geometry)) })
  }
  const countryNames = new Set(pCountries.features.map((f) => slug(f.properties.name)))
  for (const f of pRegions.features) {
    const p = labelPoint(clipToFrame(f.geometry, width, height))
    if (!inFrame(p) || f.properties.kind === 'continent' || countryNames.has(f.properties.id)) continue
    labels.push({ id: f.properties.id, kind: f.properties.kind, name: f.properties.name, x: p.x, y: p.y, size: Math.sqrt(totalArea(f.geometry)), rank: f.properties.rank })
  }
  for (const f of pMarine.features) {
    const p = labelPoint(clipToFrame(f.geometry, width, height))
    if (!inFrame(p)) continue
    labels.push({ id: f.properties.id, kind: f.properties.kind, name: f.properties.name, x: p.x, y: p.y, size: Math.sqrt(totalArea(f.geometry)), rank: f.properties.rank })
  }

  // Physical regions and seas are also kept as shapes so a place card can highlight them.
  const shapes = toTopology({ regions: pRegions, marine: pMarine })

  const out = {
    version: 1,
    sheet: id,
    title: sheet.title,
    width,
    height,
    bbox: sheet.bbox,
    topology: topo,
    shapes,
    // Classified boundary lines, quantised like TopoJSON to keep them small.
    lines: toTopology(
      Object.fromEntries(Object.entries(lines).map(([k, v]) => [k, { type: 'MultiLineString', coordinates: v }])),
      5e4,
    ),
    labels: labels.map((l) => ({ ...l, size: Math.round(l.size), x: l.x === undefined ? undefined : Math.round(l.x), y: l.y === undefined ? undefined : Math.round(l.y), radius: l.radius === undefined ? undefined : Math.round(l.radius) })),
  }

  let relief = null
  if (!skipRelief) {
    const landPolygons = [...pCountries.features, ...(pStates ? pStates.features : [])].map((f) => f.geometry).filter(Boolean)
    const glaciers = await ms(await naturalEarth(`ne_${scale}_glaciated_areas`), `${id === 'world' ? '' : clip} -simplify 30% keep-shapes`)
    const icePolygons = P(glaciers).features.map((f) => f.geometry).filter(Boolean)
    relief = await renderRelief({ sheet, frame, landPolygons, icePolygons, elevation: dem, grid })
  }
  return { data: out, relief, frame, pStates, pCountries }
}

/** Clip a projected polygon to the sheet rectangle (Sutherland–Hodgman per ring). */
function clipToFrame(geometry, w, h) {
  const clipRing = (ring) => {
    const edges = [
      (p) => p[0] >= 0,
      (p) => p[0] <= w,
      (p) => p[1] >= 0,
      (p) => p[1] <= h,
    ]
    const inter = [
      (a, b) => [0, a[1] + ((b[1] - a[1]) * (0 - a[0])) / (b[0] - a[0])],
      (a, b) => [w, a[1] + ((b[1] - a[1]) * (w - a[0])) / (b[0] - a[0])],
      (a, b) => [a[0] + ((b[0] - a[0]) * (0 - a[1])) / (b[1] - a[1]), 0],
      (a, b) => [a[0] + ((b[0] - a[0]) * (h - a[1])) / (b[1] - a[1]), h],
    ]
    let out = ring
    for (let e = 0; e < 4; e++) {
      const input = out
      out = []
      for (let i = 0; i < input.length; i++) {
        const cur = input[i]
        const prev = input[(i + input.length - 1) % input.length]
        const cin = edges[e](cur)
        const pin = edges[e](prev)
        if (cin) {
          if (!pin) out.push(inter[e](prev, cur))
          out.push(cur)
        } else if (pin) out.push(inter[e](prev, cur))
      }
      if (!out.length) break
    }
    return out
  }
  if (!geometry) return geometry
  const polys = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []
  const clipped = polys.map((p) => [clipRing(p[0])]).filter((p) => p[0].length >= 3)
  return { type: 'MultiPolygon', coordinates: clipped }
}

export { roundGeometry }
