/**
 * Compiles content/ into places.json: projects every place onto its sheet,
 * links it to sheet geometry, checks it lies in the states it claims, resolves
 * relations, and derives state and country adjacency.
 */
import { feature, neighbors } from 'topojson-client'
import { SHEETS, sheetFrame } from './sheets.mjs'
import { CONTENT, ENRICH, LINKS, PREFIX, placeId, V1_LOCK } from './content.mjs'
import { pointInPolygon, slug } from './geo.mjs'
import { STATES } from '../content/states.mjs'

/** NCERT's six physiographic divisions, with each state's default. */
export const REGIONS = [
  { id: 'the-himalaya', name: 'The Himalaya' },
  { id: 'northern-plains', name: 'Northern Plains' },
  { id: 'peninsular-plateau', name: 'Peninsular Plateau' },
  { id: 'indian-desert', name: 'Indian Desert' },
  { id: 'coastal-plains', name: 'Coastal Plains' },
  { id: 'islands', name: 'Islands' },
]
const STATE_REGION = {
  ladakh: 'the-himalaya', 'jammu-and-kashmir': 'the-himalaya', 'himachal-pradesh': 'the-himalaya', uttarakhand: 'the-himalaya', sikkim: 'the-himalaya',
  'arunachal-pradesh': 'the-himalaya', nagaland: 'the-himalaya', manipur: 'the-himalaya', mizoram: 'the-himalaya', tripura: 'the-himalaya',
  meghalaya: 'peninsular-plateau', assam: 'northern-plains', punjab: 'northern-plains', haryana: 'northern-plains', delhi: 'northern-plains',
  chandigarh: 'northern-plains', 'uttar-pradesh': 'northern-plains', bihar: 'northern-plains', 'west-bengal': 'northern-plains',
  rajasthan: 'indian-desert', gujarat: 'coastal-plains', goa: 'coastal-plains', kerala: 'coastal-plains', puducherry: 'coastal-plains',
  'dnh-and-dd': 'coastal-plains', 'andaman-and-nicobar': 'islands', lakshadweep: 'islands',
  'madhya-pradesh': 'peninsular-plateau', chhattisgarh: 'peninsular-plateau', jharkhand: 'peninsular-plateau', odisha: 'peninsular-plateau',
  maharashtra: 'peninsular-plateau', telangana: 'peninsular-plateau', karnataka: 'peninsular-plateau', 'andhra-pradesh': 'peninsular-plateau',
  'tamil-nadu': 'peninsular-plateau',
}
/** The nine coastal states and four coastal UTs. */
const COASTAL_STATES = new Set(['gujarat', 'maharashtra', 'goa', 'karnataka', 'kerala', 'tamil-nadu', 'andhra-pradesh', 'odisha', 'west-bengal', 'dnh-and-dd', 'puducherry', 'andaman-and-nicobar', 'lakshadweep'])
const COASTAL_KINDS = new Set(['coast', 'delta', 'port', 'cape', 'gulf', 'strait', 'sea'])

const polys = (topo, key) =>
  topo.objects[key] ? feature(topo, topo.objects[key]).features.filter((f) => f.geometry).map((f) => ({ id: f.properties.id, name: f.properties.name, iso: f.properties.iso, continent: f.properties.continent, geometry: f.geometry })) : []

const lines = (topo, key) =>
  topo.objects[key]
    ? feature(topo, topo.objects[key]).features.filter((f) => f.geometry).map((f) => ({ id: f.properties.id, coords: f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates }))
    : []

function nearestOnLines(p, ls) {
  let best = null
  let bestD = Infinity
  for (const l of ls)
    for (let i = 1; i < l.length; i++) {
      const [x0, y0] = l[i - 1]
      const [x1, y1] = l[i]
      const dx = x1 - x0
      const dy = y1 - y0
      const t = Math.max(0, Math.min(1, ((p[0] - x0) * dx + (p[1] - y0) * dy) / (dx * dx + dy * dy || 1)))
      const q = [x0 + t * dx, y0 + t * dy]
      const d = Math.hypot(p[0] - q[0], p[1] - q[1])
      if (d < bestD) {
        bestD = d
        best = q
      }
    }
  return { point: best, distance: bestD }
}

/** Is the point inside the polygon, or within `tol` px of it? */
function nearPolygon(p, g, tol) {
  if (pointInPolygon(p, g)) return true
  return nearestOnLines(p, rings(g)).distance <= tol
}

const rings = (g) => (g.type === 'Polygon' ? g.coordinates : g.type === 'MultiPolygon' ? g.coordinates.flat() : [])

const wikiUrl = (title) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_')).replace(/%2C/g, ',').replace(/%3A/g, ':').replace(/%28/g, '(').replace(/%29/g, ')')}`
const SHAPE = { river: 'line', lake: 'area', region: 'area', marine: 'area', area: 'area' }
/** Curation reasons that are also useful tags in the app. */
const WHY_TAG = { 'current-affairs': 'current-affairs', strategic: 'strategic' }

/**
 * Provenance and version-2 enrichment for a place: its Wikipedia and Wikidata
 * pages, designations found in official lists, and the list sources.
 */
function withSources(place, raw) {
  const src = [...(raw.src ? [].concat(raw.src) : [])]
  const link = LINKS[place.id]
  if (link) {
    if (!src.some((s) => /wikipedia\.org/.test(s.url))) src.unshift({ title: `Wikipedia: ${link.title}`, url: wikiUrl(link.title) })
    if (link.qid && !src.some((s) => /wikidata\.org/.test(s.url))) src.push({ title: `Wikidata: ${link.qid}`, url: `https://www.wikidata.org/wiki/${link.qid}` })
  }
  const e = ENRICH[place.id]
  if (e) {
    place.tags = [...new Set([...(place.tags ?? []), ...e.tags])]
    for (const f of e.facts) if (!place.facts.includes(f)) place.facts.push(f)
    for (const s of e.src) if (!src.some((x) => x.url === s.url)) src.push(s)
    for (const w of e.why ?? []) if (WHY_TAG[w]) place.tags = [...new Set([...(place.tags ?? []), WHY_TAG[w]])]
  }
  if (raw.why && WHY_TAG[raw.why]) place.tags = [...new Set([...(place.tags ?? []), WHY_TAG[raw.why]])]
  if (!place.tags?.length) delete place.tags
  const wikidata = raw.qid ?? link?.qid
  return { ...place, ...(wikidata ? { wikidata } : {}), ...(src.length ? { sources: src } : {}), ...(raw.added ? { added: raw.added } : {}) }
}

export function compilePlaces(sheetData, overlays = {}) {
  const warnings = []
  const warn = (m) => warnings.push(m)
  const places = []
  const byId = new Map()
  const bySlug = new Map() // `${sheet}:${slug(name)}` → [ids]

  for (const sheetId of ['india', 'world']) {
    const data = sheetData[sheetId]
    const { projection, width, height } = sheetFrame(SHEETS[sheetId])
    const states = polys(data.topology, 'states')
    const countries = polys(data.topology, 'countries')
    const ov = overlays[sheetId]
    const rivers = [...lines(data.topology, 'rivers'), ...(ov ? lines(ov.data.rivers, 'rivers') : [])]
    const areas = ov ? feature(ov.data.areas, ov.data.areas.objects.areas).features.filter((f) => f.geometry) : []
    const lakes = polys(data.topology, 'lakes')
    const regions = polys(data.shapes, 'regions')
    const marine = polys(data.shapes, 'marine')
    const has = (list, id) => list.some((f) => f.id === id)

    for (const raw of CONTENT[sheetId]) {
      const id = placeId(sheetId, raw)
      if (byId.has(id)) {
        warn(`duplicate id ${id}`)
        continue
      }
      let [x, y] = projection([raw.lon, raw.lat])
      if (!(x >= 0 && y >= 0 && x <= width && y <= height)) {
        warn(`${id}: outside the ${sheetId} sheet`)
        continue
      }
      const key = raw.id ?? slug(raw.name)
      const base = slug(raw.name.replace(/^(Lake|Gulf of|Bay of|Strait of|Mount) /i, '').replace(/ (Lake|River|Range|Hills|Mountains|Plateau|Desert|Delta|Valley|Coast|Glacier|Dam)$/i, ''))
      // Linked geometry on the sheet.
      let geom = raw.geom
      if (!geom) {
        const cands = [...new Set([key, base, slug(raw.name)])]
        if (raw.kind === 'river') geom = cands.map((c) => `river:${c}`).find((g) => has(rivers, g.slice(6)))
        else if (raw.kind === 'lake') geom = cands.map((c) => `lake:${c}`).find((g) => has(lakes, g.slice(5)))
        else if (['sea', 'gulf', 'strait'].includes(raw.kind)) geom = cands.map((c) => `marine:${c}`).find((g) => has(marine, g.slice(7)))
        else if (['range', 'plateau', 'desert', 'plain', 'valley', 'coast', 'delta', 'region', 'island', 'grassland'].includes(raw.kind))
          geom = [...cands, `${base}-range`, `${base}-hills`, `${base}-mountains`, `${base}-plateau`].map((c) => `region:${c}`).find((g) => has(regions, g.slice(7)))
      } else {
        const [layer, gid] = geom.split(':')
        const list = { river: rivers, lake: lakes, marine, region: regions }[layer]
        if (!list || !has(list, gid)) {
          warn(`${id}: geometry ${geom} not on the sheet`)
          geom = undefined
        }
      }
      // Courses and outlines from the overlay, for places the base sheet does not draw.
      if (!geom && ov?.geomOf.has(id)) geom = ov.geomOf.get(id)
      // A new place whose sourced point falls outside its own outline (a coarse coordinate) moves to the outline's label point.
      let moved = null
      if (raw.added && geom?.startsWith('area:')) {
        const a = areas.find((f) => f.properties.id === geom.slice(5))
        if (a && !pointInPolygon([x, y], a.geometry) && a.properties.lx !== undefined) {
          ;[x, y] = [a.properties.lx, a.properties.ly]
          const [lon, lat] = projection.invert([x, y])
          moved = { lon: Math.round(lon * 1e4) / 1e4, lat: Math.round(lat * 1e4) / 1e4 }
        }
      }
      if (raw.kind === 'river') {
        if (!geom) {
          if (sheetId === 'india') warn(`${id}: river has no course on the sheet`)
        }
        else {
          // Put the river’s point on its course, near the authored position.
          const r = rivers.find((f) => f.id === geom.slice(6))
          const snap = nearestOnLines([x, y], r.coords)
          if (snap.distance > 40) warn(`${id}: authored point is ${snap.distance.toFixed(0)} px from its course`)
          ;[x, y] = snap.point
        }
      }

      // States / countries.
      let st = raw.st ? [].concat(raw.st) : undefined
      let co = raw.co ? [].concat(raw.co) : undefined
      if (sheetId === 'india' && !co) {
        const inside = states.filter((s) => pointInPolygon([x, y], s.geometry)).map((s) => s.id)
        if (!st) {
          st = inside.length ? inside : states.filter((s) => nearPolygon([x, y], s.geometry, 6)).map((s) => s.id)
          if (!st.length && !['sea', 'gulf', 'strait'].includes(raw.kind)) warn(`${id}: not inside any state`)
        } else {
          for (const s of st) if (!states.some((f) => f.id === s)) warn(`${id}: unknown state ${s}`)
          const offshore = ['island', 'volcano', 'cape', 'gulf', 'strait', 'sea', 'region', 'park', 'port'].includes(raw.kind)
          const tol = raw.kind === 'river' || st.length > 1 ? 30 : raw.kind === 'volcano' ? 90 : offshore ? 45 : 7
          const ok = st.some((s) => {
            const f = states.find((g) => g.id === s)
            return f && nearPolygon([x, y], f.geometry, tol)
          })
          if (!ok) warn(`${id}: point is not in ${st.join('/')} (found ${inside.join('/') || 'none'})`)
        }
      }
      if (co) co = co.map((c) => c.toUpperCase())

      // The fog unit the place belongs to: a state on the India sheet, a country (ISO3) otherwise.
      let unit
      if (sheetId === 'india') {
        const inState = states.find((s) => pointInPolygon([x, y], s.geometry))
        if (inState) unit = inState.id
        else if (!co && st?.length) unit = st[0]
        else unit = countries.find((c) => pointInPolygon([x, y], c.geometry))?.iso ?? co?.[0]
      } else {
        unit = countries.find((c) => pointInPolygon([x, y], c.geometry))?.iso ?? co?.[0]
      }

      const region =
        sheetId !== 'india'
          ? undefined
          : raw.region ?? (st?.[0] === 'andaman-and-nicobar' || st?.[0] === 'lakshadweep' ? 'islands' : COASTAL_KINDS.has(raw.kind) && st?.length ? 'coastal-plains' : st?.[0] ? STATE_REGION[st[0]] : undefined)

      const place = {
        id,
        name: raw.name,
        ...(raw.aka ? { aka: raw.aka } : {}),
        kind: raw.kind,
        sheet: sheetId,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        lon: moved?.lon ?? raw.lon,
        lat: moved?.lat ?? raw.lat,
        ...(geom ? { geom } : {}),
        ...(st?.length ? { states: st } : {}),
        ...(co?.length ? { countries: co } : {}),
        ...(region ? { region } : {}),
        ...(unit ? { unit } : {}),
        facts: [].concat(raw.f ?? []),
        ...(raw.rel ? { rel: raw.rel } : {}),
        ...(raw.tags ? { tags: raw.tags } : {}),
        level: raw.lvl ?? 2,
        ...(raw.el ? { elevation: raw.el } : {}),
        ...(raw.sub ? { subtitle: raw.sub } : {}),
        ...(raw.src ? { sources: [].concat(raw.src) } : {}),
      }
      // Version 1 places keep the level and fog unit they had (they decide exploration order).
      const locked = V1_LOCK?.places[id]
      if (locked) {
        if (place.level !== locked[0]) warn(`${id}: level ${place.level} differs from version 1 (${locked[0]}); keeping ${locked[0]}`)
        place.level = locked[0]
        if (locked[1] && place.unit !== locked[1]) {
          warn(`${id}: fog unit ${place.unit} differs from version 1 (${locked[1]}); keeping ${locked[1]}`)
          place.unit = locked[1]
        }
      } else if (V1_LOCK && !raw.added) warn(`${id}: new place without \`added\` (version 2 places come from content/generated)`)
      if (place.geom) place.shape = SHAPE[place.geom.split(':')[0]] ?? 'point'
      const final = withSources(place, raw)
      const gsrc = ov?.sources.get(id)
      if (gsrc && !(final.sources ?? []).some((x) => x.url === gsrc.url)) final.sources = [...(final.sources ?? []), { ...gsrc, title: `${gsrc.title} (outline or course)` }]
      if (!final.facts.length) warn(`${id}: no facts`)
      places.push(final)
      byId.set(id, final)
      const sk = `${sheetId}:${slug(raw.name)}`
      bySlug.set(sk, [...(bySlug.get(sk) ?? []), id])
      bySlug.set(`${sheetId}:${key}`, [...new Set([...(bySlug.get(`${sheetId}:${key}`) ?? []), id])])
    }
  }

  if (V1_LOCK) for (const id of Object.keys(V1_LOCK.places)) if (!byId.has(id)) warn(`VERSION 1 PLACE MISSING: ${id} (user progress refers to it)`)

  // ── relations ───────────────────────────────────────────────────────────
  const resolve = (sheetId, ref, from) => {
    if (/^[A-Z]{3}$/.test(ref)) return ref // country code
    const full = /^(in|w)\./.test(ref) ? ref : `${PREFIX[sheetId]}.${ref}`
    if (byId.has(full)) return full
    const name = ref.split('.').pop()
    const alt = bySlug.get(`${sheetId}:${name}`)
    if (alt?.length === 1) return alt[0]
    // 'pass.rohtang' → 'in.pass.rohtang-pass'
    const pre = [...byId.keys()].filter((k) => k.startsWith(full + '-'))
    if (pre.length === 1) return pre[0]
    warn(`${from}: unresolved relation ${ref}`)
    return null
  }
  for (const p of places) {
    if (!p.rel) continue
    const rel = {}
    for (const [k, v] of Object.entries(p.rel)) {
      if (k === 'bank') {
        rel[k] = v
        continue
      }
      if (Array.isArray(v)) {
        const r = v.map((x) => resolve(p.sheet, x, p.id)).filter(Boolean)
        if (r.length) rel[k] = r
      } else {
        const r = resolve(p.sheet, v, p.id)
        if (r) rel[k] = r
      }
    }
    p.rel = rel
  }

  // ── states ──────────────────────────────────────────────────────────────
  const india = sheetData.india
  const stateObj = india.topology.objects.states
  const nb = neighbors(stateObj.geometries)
  const statePolys = polys(india.topology, 'states')
  const indiaCountries = polys(india.topology, 'countries')
  const stateInfo = stateObj.geometries.map((g, i) => {
    const meta = STATES.find((s) => s.id === g.properties.id)
    const poly = statePolys.find((s) => s.id === meta.id)
    const borderCountries = new Set()
    for (const ring of rings(poly.geometry)) {
      for (let k = 0; k < ring.length; k += 2) {
        const [px, py] = ring[k]
        for (const [dx, dy] of [[4, 0], [-4, 0], [0, 4], [0, -4]]) {
          const q = [px + dx, py + dy]
          if (statePolys.some((s) => pointInPolygon(q, s.geometry))) continue
          const c = indiaCountries.find((f) => pointInPolygon(q, f.geometry))
          if (c) borderCountries.add(c.iso)
        }
      }
    }
    return {
      id: meta.id,
      name: meta.name,
      type: meta.type,
      capital: meta.capital,
      region: meta.region,
      fact: meta.fact,
      neighbours: nb[i].map((j) => stateObj.geometries[j].properties.id),
      borderCountries: [...borderCountries].filter(Boolean).sort(),
      coastal: COASTAL_STATES.has(meta.id),
    }
  })

  // ── countries (world sheet) ─────────────────────────────────────────────
  const world = sheetData.world
  const cObj = world.topology.objects.countries
  const cnb = neighbors(cObj.geometries)
  const countries = cObj.geometries.map((g, i) => ({
    id: g.properties.id,
    name: g.properties.name,
    iso: g.properties.iso,
    continent: g.properties.continent,
    neighbours: [...new Set(cnb[i].map((j) => cObj.geometries[j].properties.iso))].filter((x) => x && x !== g.properties.iso),
  }))

  return { data: { version: 1, places, states: stateInfo, regions: REGIONS, countries }, warnings }
}
