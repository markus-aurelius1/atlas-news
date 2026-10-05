/**
 * Matching places to Wikipedia articles: title guesses per kind, name
 * normalisation, and the checks that decide whether an article really is the
 * place (distance for point features, the article's description for large ones).
 */
import { km, wpGeosearch, wpPages, wpSearch } from '../lib/wiki.mjs'

export const norm = (s) =>
  String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’'`]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Words that describe the kind of feature rather than name it. */
const GENERIC = new Set(
  'river rivers lake lakes wetland wetlands national park parks wildlife sanctuary tiger reserve reserves biosphere mount mountain mountains range ranges hills hill peak pass la glacier plateau desert delta valley coast island islands dam barrage reservoir falls waterfall port of the gulf bay sea strait canal cape city district region ghat ghats sagar tal taal lagoon beel jheel tso kund'.split(
    ' ',
  ),
)
/** The distinctive part of a name: "Kaziranga National Park" → "kaziranga" ("Desert National Park" stays whole). */
export const core = (s) => {
  const n = norm(String(s).replace(/\s*\([^)]*\)\s*$/, ''))
  return (
    n
      .split(' ')
      .filter((w) => !GENERIC.has(w))
      .join(' ') || n
  )
}

export const KIND_WORD = {
  river: 'river', confluence: 'confluence', lake: 'lake', wetland: 'wetland', park: 'national park', peak: 'mountain', pass: 'pass', range: 'mountain range',
  glacier: 'glacier', plateau: 'plateau', desert: 'desert', plain: 'plain', valley: 'valley', coast: 'coast', delta: 'delta', island: 'island', port: 'port',
  dam: 'dam', waterfall: 'waterfall', cape: 'cape', strait: 'strait', gulf: 'gulf', sea: 'sea', canal: 'canal', monument: 'monument', grassland: 'grassland',
  volcano: 'volcano', region: 'region', city: 'city', capital: 'capital', state: 'state', country: 'country', corridor: 'corridor', border: 'border', site: 'region',
  reef: 'reef', basin: 'basin', trench: 'trench', current: 'ocean current',
}

/** How far (km) an article's coordinates may be from the authored point. Infinity = large feature, judged by description. */
export const TOLERANCE_KM = {
  capital: 30, city: 30, port: 30, dam: 25, waterfall: 20, monument: 20, confluence: 25, pass: 25, peak: 25, volcano: 30, cape: 30,
  lake: 60, wetland: 60, park: 80, glacier: 60, island: 120, valley: 150, grassland: 150, canal: 150, strait: 250, delta: 250, trench: 600, reef: 400,
  river: Infinity, range: Infinity, plateau: Infinity, desert: Infinity, plain: Infinity, coast: Infinity, region: Infinity, sea: Infinity, gulf: Infinity,
  corridor: 200, border: Infinity, site: 400, basin: Infinity, current: Infinity,
}

/** Words an article's description should contain for a large feature. */
const DESC_HINT = {
  river: /river|tributar|stream|distributar|channel|waterway/,
  range: /mountain|range|hills|massif|highland|sierra|ridge|ghats|cordillera/,
  plateau: /plateau|tableland|upland|highland|region/,
  desert: /desert|region|dunes|sand/,
  plain: /plain|lowland|region|basin|steppe|prairie/,
  coast: /coast|shore|region|littoral/,
  region: /region|area|land|territor|historical|geographic|valley|basin|corridor|plain/,
  sea: /sea|ocean|bay|gulf|marginal|body of water|waters/,
  gulf: /gulf|bay|sea|inlet|sound|bight/,
  border: /border|boundary|line|frontier/,
  basin: /basin|region|depression/,
  current: /current|gyre|drift/,
}

export function guesses(p, where = []) {
  const n = p.name.replace(/\s*\(.*\)$/, '')
  const w = where.filter(Boolean)
  const g = []
  const add = (...xs) => g.push(...xs)
  switch (p.kind) {
    case 'river':
      add(`${n} River`, `${n} river`, n, `${n} (river)`, ...w.map((x) => `${n} River (${x})`))
      break
    case 'lake':
      add(n, `${n} Lake`, `Lake ${n}`, `${n} (lake)`)
      break
    case 'wetland':
      add(n, `${n} Lake`, `${n} Wetland`, `${n} wetland`, `${n} Bird Sanctuary`)
      break
    case 'park':
      add(n, `${n} National Park`, `${n} Tiger Reserve`, `${n} Wildlife Sanctuary`)
      break
    case 'peak':
    case 'volcano':
      add(n, `Mount ${n}`, `${n} (mountain)`, `${n} (volcano)`, `${n} Peak`)
      break
    case 'pass':
      add(n, `${n} Pass`, `${n} pass`, `${n} (pass)`)
      break
    case 'glacier':
      add(n, `${n} Glacier`, `${n} glacier`)
      break
    case 'range':
      add(n, `${n} Range`, `${n} range`, `${n} Mountains`, `${n} Hills`)
      break
    case 'port':
      add(`${n} Port`, `Port of ${n}`, n, ...w.map((x) => `${n}, ${x}`))
      break
    case 'dam':
      add(n, `${n} Dam`, `${n} dam`, `${n} Barrage`)
      break
    case 'waterfall':
      add(n, `${n} Falls`, `${n} Waterfalls`, `${n} Waterfall`)
      break
    case 'island':
      add(n, `${n} Island`, `${n} (island)`, `${n} Islands`)
      break
    case 'city':
    case 'capital':
      add(n, ...w.map((x) => `${n}, ${x}`), `${n} (city)`)
      break
    case 'plateau':
      add(n, `${n} Plateau`, `${n} plateau`)
      break
    case 'valley':
      add(n, `${n} Valley`, `${n} valley`)
      break
    case 'desert':
      add(n, `${n} Desert`)
      break
    case 'cape':
      add(n, `Cape ${n}`, `${n} (cape)`)
      break
    default:
      add(n, `${n} (${KIND_WORD[p.kind] ?? p.kind})`)
  }
  for (const a of p.aka ?? []) g.push(a)
  return [...new Set(g)]
}

/** "Kota, Rajasthan" → "Kota"; "Po (river)" → "Po". */
export const stripQualifier = (t) => String(t).replace(/\s*\([^)]*\)\s*$/, '').replace(/,\s[^,]+$/, '')

const PHYSICAL = new Set(['river', 'lake', 'range', 'peak', 'pass', 'glacier', 'plateau', 'desert', 'plain', 'valley', 'coast', 'delta', 'island', 'waterfall', 'cape', 'strait', 'gulf', 'sea', 'canal', 'volcano', 'grassland', 'wetland', 'confluence', 'reef', 'trench', 'basin', 'current'])
/**
 * Descriptions whose head noun shows an article is about something else (a
 * district named after the river, a power station at the port…). Only the
 * first few words are tested: "Valley in Yadong County" is still a valley.
 */
const head = (words) => new RegExp(`^(?:[a-z0-9-]+ ){0,2}(?:${words})\\b`)
const NOT_PHYSICAL = head('district|city|town|village|municipality|municipal|constituency|railway|station|film|album|song|band|company|school|university|college|bridge|airport|tehsil|taluk|taluka|mandal|neighbourhood|suburb|county|state|province|ship|novel|television|genus|species|census|given name|surname|autonomous|corporation|power')
const NOT_PARK = head('district|city|town|village|dam|reservoir|power station|tehsil|taluk|census|given name')
const NOT_PLACE = head('power station|thermal|bridge|film|album|song|university|railway station|temple|ship|novel|given name|surname')
/** Kinds large enough that the article's point may sit far from the authored one. */
const LARGE = new Set(['island', 'strait', 'delta', 'canal', 'valley', 'grassland', 'park', 'glacier', 'lake', 'wetland'])

/**
 * Does this page describe place `p`? The distinctive part of the name must
 * match exactly (a redirect from a title built from the name also counts),
 * the description must not say it is something else, and point features must
 * lie near the authored position. Returns { ok, dist, why, far }.
 */
export function check(p, page, guess) {
  if (!page || page.disambiguation) return { ok: false, why: 'missing/disambiguation' }
  const tol = TOLERANCE_KM[p.kind] ?? 150
  const dist = page.lat === null || p.lat === undefined ? null : km(p.lat, p.lon, page.lat, page.lon)
  const desc = norm(page.description)
  const names = [p.name, ...(p.aka ?? [])].map((n) => core(stripQualifier(n))).filter(Boolean)
  const titleCore = core(stripQualifier(page.title))
  const guessCore = guess ? core(stripQualifier(guess)) : null
  const exact = names.includes(titleCore) || (page.redirected && guessCore && names.includes(guessCore))
  if (!exact) return { ok: false, dist, why: 'name' }
  const neg = PHYSICAL.has(p.kind) ? NOT_PHYSICAL : p.kind === 'park' ? NOT_PARK : ['city', 'capital', 'port'].includes(p.kind) ? NOT_PLACE : null
  if (neg && neg.test(desc)) return { ok: false, dist, why: `description "${page.description}"` }
  if (!Number.isFinite(tol) || dist === null) return { ok: true, dist, why: '' }
  if (dist <= tol) return { ok: true, dist, why: '' }
  if (LARGE.has(p.kind) && dist <= tol * 5) return { ok: true, dist, why: `far (${dist.toFixed(0)} km)`, far: true }
  return { ok: false, dist, why: `far (${dist.toFixed(0)} km)` }
}

/**
 * Find the Wikipedia article for each place. `places` need
 * { key, name, kind, lat, lon, aka?, where?: string[], title? }.
 * Returns Map<key, { page, dist, how } | { page: null, tried }>.
 */
export async function resolvePlaces(places, { log = () => {} } = {}) {
  const result = new Map()
  // 1. Explicit titles and guesses, looked up in bulk.
  const allTitles = []
  const lists = new Map()
  for (const p of places) {
    const list = p.title ? [p.title] : guesses(p, p.where)
    lists.set(p.key, list)
    allTitles.push(...list)
  }
  const pages = await wpPages(allTitles)
  const todo = []
  for (const p of places) {
    let hit = null
    for (const t of lists.get(p.key)) {
      const page = pages.get(t)
      const c = check(p, page, t)
      if (c.ok || (p.title && page && !page.disambiguation)) {
        hit = { page, dist: c.dist, how: p.title ? 'title' : 'guess' }
        break
      }
    }
    if (hit) result.set(p.key, hit)
    else todo.push(p)
  }
  log(`  guesses matched ${result.size}/${places.length}; searching ${todo.length}`)

  // 2. Full-text search, then nearby articles.
  for (const p of todo) {
    const found = await searchOne(p)
    result.set(p.key, found ?? { page: null, tried: lists.get(p.key) })
  }
  return result
}

async function searchOne(p) {
  const n = p.name.replace(/\s*\(.*\)$/, '')
  const queries = [`${n} ${KIND_WORD[p.kind] ?? ''} ${(p.where ?? [])[0] ?? ''}`.trim(), `${n} ${KIND_WORD[p.kind] ?? ''}`.trim(), n]
  const seen = new Set()
  for (const q of queries) {
    const hits = (await wpSearch(q, 6)).map((h) => h.title).filter((t) => !seen.has(t))
    hits.forEach((t) => seen.add(t))
    if (!hits.length) continue
    const pages = await wpPages(hits)
    for (const t of hits) {
      const page = pages.get(t)
      const c = check(p, page, t)
      if (c.ok) return { page, dist: c.dist, how: 'search' }
    }
  }
  if (p.lat !== undefined && Number.isFinite(TOLERANCE_KM[p.kind] ?? 150)) {
    const near = await wpGeosearch(p.lat, p.lon, 10000, 50)
    const titles = near.map((g) => g.title)
    const pages = await wpPages(titles)
    for (const t of titles) {
      const page = pages.get(t)
      const c = check(p, page, t)
      if (c.ok) return { page, dist: c.dist, how: 'nearby' }
    }
  }
  return null
}
