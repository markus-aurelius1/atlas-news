/**
 * A small, polite client for Wikipedia, Wikidata and the OpenStreetMap
 * Overpass API. Every response is cached under .cache/wiki (git-ignored), so
 * a rebuild is offline and repeatable once the cache is warm.
 *
 * Requests run with bounded concurrency and a minimum gap, identify the
 * project in the User-Agent, and retry with backoff (Wikimedia asks for both).
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { CACHE } from './fetch.mjs'

const UA = 'TarsAtlasBuild/2.0 (offline study atlas data pipeline; https://en.wikipedia.org/)'
const WP = 'https://en.wikipedia.org/w/api.php'
const WD = 'https://www.wikidata.org/w/api.php'
const OVERPASS = 'https://overpass-api.de/api/interpreter'

let active = 0
let lastStart = 0
const queue = []
const LIMIT = 4
const GAP_MS = 60

function schedule(fn) {
  return new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject })
    pump()
  })
}

function pump() {
  if (active >= LIMIT || !queue.length) return
  const wait = Math.max(0, lastStart + GAP_MS - Date.now())
  if (wait > 0) {
    setTimeout(pump, wait)
    return
  }
  const job = queue.shift()
  active++
  lastStart = Date.now()
  job
    .fn()
    .then(job.resolve, job.reject)
    .finally(() => {
      active--
      pump()
    })
  pump()
}

const keyFile = (ns, key) => join(CACHE, 'wiki', ns, createHash('sha1').update(key).digest('hex').slice(0, 20) + '.json')

/** GET/POST JSON with a disk cache keyed by the request. */
async function cachedJson(ns, url, { body, retries = 5, accept } = {}) {
  const key = url + (body ? '\n' + body : '')
  const file = keyFile(ns, key)
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  const json = await schedule(async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(url, {
          method: body ? 'POST' : 'GET',
          headers: { 'User-Agent': UA, 'Api-User-Agent': UA, ...(accept ? { Accept: accept } : {}), ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
          body,
        })
        if (res.status === 429 || res.status >= 500) throw new Error(`${res.status} ${url.slice(0, 120)}`)
        if (!res.ok) throw Object.assign(new Error(`${res.status} ${url.slice(0, 160)}`), { fatal: true })
        const j = await res.json()
        if (j?.error?.code === 'maxlag') throw new Error('maxlag')
        return j
      } catch (err) {
        if (err.fatal || attempt >= retries) throw err
        await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt))
      }
    }
  })
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(json))
  return json
}

const qs = (o) => new URLSearchParams({ format: 'json', formatversion: '2', ...o }).toString()
const chunks = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))

/**
 * Page info for many titles: canonical title (after redirects), coordinates,
 * Wikidata id, short description and whether it is a disambiguation page.
 * Returns Map<inputTitle, info | null>.
 */
export async function wpPages(titles) {
  const out = new Map()
  const uniq = [...new Set(titles.filter(Boolean))]
  await Promise.all(
    chunks(uniq, 50).map(async (batch) => {
      const j = await cachedJson(
        'wp-pages',
        `${WP}?${qs({ action: 'query', prop: 'coordinates|pageprops|description', ppprop: 'wikibase_item|disambiguation', colimit: 'max', coprimary: 'primary', redirects: '1', titles: batch.join('|') })}`,
      )
      const q = j.query ?? {}
      const norm = new Map((q.normalized ?? []).map((n) => [n.from, n.to]))
      const redir = new Map((q.redirects ?? []).map((r) => [r.from, { to: r.to, fragment: r.tofragment }]))
      const pages = new Map((q.pages ?? []).map((p) => [p.title, p]))
      for (const t of batch) {
        let title = norm.get(t) ?? t
        const r = redir.get(title)
        if (r) title = r.to
        const p = pages.get(title)
        if (!p || p.missing || p.invalid) {
          out.set(t, null)
          continue
        }
        const c = p.coordinates?.[0]
        out.set(t, {
          title: p.title,
          pageid: p.pageid,
          qid: p.pageprops?.wikibase_item ?? null,
          disambiguation: p.pageprops?.disambiguation !== undefined,
          description: p.description ?? '',
          lat: c?.lat ?? null,
          lon: c?.lon ?? null,
          redirected: !!r,
          fragment: r?.fragment ?? null,
        })
      }
    }),
  )
  return out
}

/** Plain-text lead sections (Map<title, text>), 20 titles per request. */
export async function wpExtracts(titles) {
  const out = new Map()
  const uniq = [...new Set(titles.filter(Boolean))]
  await Promise.all(
    chunks(uniq, 20).map(async (batch) => {
      const j = await cachedJson('wp-extracts', `${WP}?${qs({ action: 'query', prop: 'extracts', exintro: '1', explaintext: '1', exlimit: '20', redirects: '1', titles: batch.join('|') })}`)
      const q = j.query ?? {}
      const norm = new Map((q.normalized ?? []).map((n) => [n.from, n.to]))
      const redir = new Map((q.redirects ?? []).map((r) => [r.from, r.to]))
      const pages = new Map((q.pages ?? []).map((p) => [p.title, p]))
      for (const t of batch) {
        let title = norm.get(t) ?? t
        title = redir.get(title) ?? title
        out.set(t, pages.get(title)?.extract ?? '')
      }
    }),
  )
  return out
}

/** Full-text search: [{ title, snippet }]. */
export async function wpSearch(query, limit = 6) {
  const j = await cachedJson('wp-search', `${WP}?${qs({ action: 'query', list: 'search', srsearch: query, srlimit: String(limit), srprop: 'snippet' })}`)
  return (j.query?.search ?? []).map((s) => ({ title: s.title, snippet: s.snippet.replace(/<[^>]+>/g, '') }))
}

/** Articles with coordinates near a point: [{ title, lat, lon, dist (m) }]. Radius ≤ 10 km. */
export async function wpGeosearch(lat, lon, radius = 10000, limit = 50) {
  const j = await cachedJson('wp-geo', `${WP}?${qs({ action: 'query', list: 'geosearch', gscoord: `${lat.toFixed(4)}|${lon.toFixed(4)}`, gsradius: String(Math.min(10000, radius)), gslimit: String(limit) })}`)
  return (j.query?.geosearch ?? []).map((g) => ({ title: g.title, lat: g.lat, lon: g.lon, dist: g.dist }))
}

/** Parsed HTML of a page (for list articles). */
export async function wpParseHtml(title) {
  const j = await cachedJson('wp-parse', `${WP}?${qs({ action: 'parse', page: title, prop: 'text', redirects: '1' })}`)
  return j.parse?.text ?? ''
}

/** Wikidata entities (claims, English label/aliases/description, enwiki sitelink). Map<qid, entity>. */
export async function wdEntities(qids) {
  const out = new Map()
  const uniq = [...new Set(qids.filter((q) => /^Q\d+$/.test(q ?? '')))]
  await Promise.all(
    chunks(uniq, 50).map(async (batch) => {
      const j = await cachedJson('wd-entities', `${WD}?${qs({ action: 'wbgetentities', ids: batch.join('|'), props: 'claims|labels|aliases|descriptions|sitelinks', languages: 'en', sitefilter: 'enwiki', maxlag: '30' })}`, { retries: 8 })
      for (const [id, e] of Object.entries(j.entities ?? {})) out.set(id, e)
      // Redirected (merged) items come back under their new id.
      for (const q of batch) if (!out.has(q)) out.set(q, Object.values(j.entities ?? {}).find((e) => e.redirects?.from === q) ?? null)
    }),
  )
  return out
}

/** Wikidata items by label: [{ id, label, description }]. */
export async function wdSearch(text, limit = 7) {
  const j = await cachedJson('wd-search', `${WD}?${qs({ action: 'wbsearchentities', search: text, language: 'en', type: 'item', limit: String(limit) })}`)
  return (j.search ?? []).map((s) => ({ id: s.id, label: s.label, description: s.description ?? '' }))
}

/**
 * OpenStreetMap's Nominatim geocoder (cached). Its usage policy allows one
 * request per second, so these run one at a time, apart from the Wikimedia queue.
 */
let nominatimChain = Promise.resolve()
export async function nominatim(query, { countrycodes } = {}) {
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({ q: query, format: 'jsonv2', limit: '5', ...(countrycodes ? { countrycodes } : {}) })}`
  const file = keyFile('nominatim', url)
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'))
  const run = nominatimChain.then(async () => {
    await new Promise((r) => setTimeout(r, 1100))
    const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' } })
    if (!res.ok) throw new Error(`nominatim ${res.status}`)
    return res.json()
  })
  nominatimChain = run.catch(() => {})
  const json = await run
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(json))
  return json
}

/**
 * OpenStreetMap geometry by Wikidata id, via the QLever SPARQL endpoint over the
 * OSM planet (osm2rdf; University of Freiburg). Much faster and steadier than
 * Overpass for tag lookups. Returns [{ osm: url, qid, wkt }].
 */
export async function osmByWikidata(qids) {
  const values = qids.map((q) => `"${q}"`).join(' ')
  const query = `PREFIX osmkey: <https://www.openstreetmap.org/wiki/Key:>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>
SELECT ?osm ?q ?wkt WHERE { VALUES ?q { ${values} } ?osm osmkey:wikidata ?q ; geo:hasGeometry/geo:asWKT ?wkt }`
  const j = await cachedJson('qlever-osm', 'https://qlever.dev/api/osm-planet', { body: 'query=' + encodeURIComponent(query), retries: 4, accept: 'application/sparql-results+json' })
  return (j.results?.bindings ?? []).map((b) => ({ osm: b.osm.value, qid: b.q.value, wkt: b.wkt.value }))
}

/** OpenStreetMap elements via Overpass (POST, cached; `mirror` uses a second public instance). */
export async function overpass(query, { mirror = false } = {}) {
  return cachedJson('overpass', mirror ? OVERPASS_MIRROR : OVERPASS, { body: 'data=' + encodeURIComponent(query), retries: mirror ? 3 : 6 })
}
const OVERPASS_MIRROR = 'https://maps.mail.ru/osm/tools/overpass/api/interpreter'

// ── Wikidata claim helpers ──────────────────────────────────────────────────

const mainValues = (e, p) =>
  (e?.claims?.[p] ?? [])
    .filter((c) => c.rank !== 'deprecated' && c.mainsnak?.snaktype === 'value')
    .sort((a, b) => (b.rank === 'preferred') - (a.rank === 'preferred'))

export const wdIds = (e, p) => mainValues(e, p).map((c) => c.mainsnak.datavalue.value.id).filter(Boolean)
export const wdStrings = (e, p) => mainValues(e, p).map((c) => c.mainsnak.datavalue.value).filter((v) => typeof v === 'string')
export function wdQuantity(e, p) {
  const c = mainValues(e, p)[0]
  if (!c) return null
  const v = c.mainsnak.datavalue.value
  return { amount: Number(v.amount), unit: String(v.unit).split('/').pop() }
}
/** Coordinates: [{ lat, lon, part }] where `part` is the "applies to part" qualifier (e.g. source/mouth), if any. */
export function wdCoords(e) {
  return mainValues(e, 'P625').map((c) => {
    const v = c.mainsnak.datavalue.value
    const part = c.qualifiers?.P518?.[0]?.datavalue?.value?.id ?? null
    return { lat: v.latitude, lon: v.longitude, part, globe: String(v.globe).split('/').pop(), preferred: c.rank === 'preferred' }
  })
}
export const wdLabel = (e) => e?.labels?.en?.value ?? null
export const wdAliases = (e) => (e?.aliases?.en ?? []).map((a) => a.value)
export const wdEnwiki = (e) => e?.sitelinks?.enwiki?.title ?? null

/** Great-circle distance in km. */
export function km(aLat, aLon, bLat, bLon) {
  const r = Math.PI / 180
  const d = Math.sin(((bLat - aLat) * r) / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(((bLon - aLon) * r) / 2) ** 2
  return 12742 * Math.asin(Math.sqrt(d))
}

export const wikiUrl = (title) => `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_')).replace(/%2C/g, ',').replace(/%3A/g, ':').replace(/%28/g, '(').replace(/%29/g, ')')}`
export const wikidataUrl = (qid) => `https://www.wikidata.org/wiki/${qid}`
