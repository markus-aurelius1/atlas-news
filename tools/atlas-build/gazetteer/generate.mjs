/**
 * Turns the candidate lists (content/candidates) into gazetteer entries with
 * sourced positions, facts, identifiers and relations, and drops every
 * candidate the gazetteer already has.
 *
 *   node gazetteer/generate.mjs
 *
 * Reads   content/candidates/{india,world}.mjs, content/candidates/lists/*.json,
 *         content/sources/links.json (existing place → Wikipedia/Wikidata)
 * Writes  content/generated/{india,world}.json   new places (P() shape + src, qid)
 *         content/generated/enrich.json          tags/aliases/sources to add to existing places
 *         reports/generate-review.json           unresolved, merged, suspicious
 *
 * Positions: Wikidata P625, else the Wikipedia article, else (for designated
 * sites with no article) OpenStreetMap. Nothing is filled in from memory.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { slug } from '../lib/geo.mjs'
import { km, nominatim, wdAliases, wdCoords, wdEntities, wdEnwiki, wdIds, wdLabel, wdQuantity, wdSearch, wdStrings, wikidataUrl, wikiUrl, wpExtracts, wpPages, wpSearch } from '../lib/wiki.mjs'
import { core, KIND_WORD, norm, stripQualifier, TOLERANCE_KM } from './match.mjs'
import { pickFacts } from './facts.mjs'
import INDIA from '../content/candidates/india.mjs'
import WORLD from '../content/candidates/world.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../../..')
const read = (p) => JSON.parse(readFileSync(join(here, p), 'utf8'))
const existing = JSON.parse(readFileSync(join(root, 'public/atlas/v1/places.json'), 'utf8'))
const links = read('../content/sources/links.json')
const lists = Object.fromEntries(['india-ramsar', 'india-tiger-reserves', 'india-national-parks', 'india-biosphere-reserves', 'world-capitals'].map((f) => [f, read(`../content/candidates/lists/${f}.json`)]))

const review = { unresolved: [], noCoords: [], merged: [], duplicates: [], coordConflicts: [], outOfSheet: [] }

// ── 1. Candidates, one shape ────────────────────────────────────────────────
const cands = []
const add = (sheet, c) => cands.push({ sheet, tags: [], ...c, tags: [...new Set(c.tags ?? [])] })
for (const c of INDIA) add('india', c)
for (const c of WORLD) add('world', c)

const LAKEY = /\b(lake|tso|taal|tal|sagar|jheel|beel|bil|sarovar|kere|reservoir|dam|pokhri)\b/i
/** Ramsar sites the list names without linking an article, and the article that describes them. */
const RAMSAR_ARTICLE = {
  'Therthangal Bird Sanctuary': 'Therthangal Bird Sanctuary',
  'Sakkarakottai Bird Sanctuary': 'Sakkarakottai Bird Sanctuary',
  'Khecheopalli Lake': 'Khecheopalri Lake',
  'Siliserh Lake': 'Siliserh Lake',
  'Nakti Bird Sanctuary': 'Nakti Dam Wildlife Sanctuary',
  'Shallabugh Wetland Conservation Reserve': 'Shallabugh Wetland',
  'Shekha Jheel Bird Sanctuary': 'Shekha Bird Sanctuary',
  'Patna Bird Sanctuary': 'Patna Bird Sanctuary',
  'Udhwa Lake': 'Udhwa',
  'Khichan Wetland': 'Khichan',
  'Aghanashini Estuary': 'Aghanashini River',
}
{
  const L = lists['india-ramsar']
  for (const s of L.items) {
    const date = s.designated ? `Designated a Ramsar site on ${s.designated}` : 'A Ramsar site'
    const listed = s.name.replace(/\s*\(.*\)$/, '')
    const article = s.title ?? RAMSAR_ARTICLE[listed] ?? null
    add('india', {
      kind: LAKEY.test(s.name) || LAKEY.test(article ?? '') ? 'lake' : 'wetland',
      title: article,
      // Sites described by a broader article (a village, a river) keep the list's name.
      name: s.title ? undefined : listed,
      listName: listed,
      stateHint: s.state,
      lvl: 3,
      why: 'ramsar',
      tags: ['ramsar'],
      listFact: `${date}${s.areaKm2 ? ` (${s.areaKm2.toLocaleString('en-IN')} km²)` : ''}.`,
      listSrc: { title: `${L.list} (${L.owner})`, url: L.url },
    })
  }
}
{
  const L = lists['india-tiger-reserves']
  for (const s of L.items)
    add('india', {
      kind: 'park',
      title: s.title,
      name: /Tiger Reserve|National Park|Sanctuary/.test(s.title ?? '') ? undefined : `${s.name} Tiger Reserve`,
      stateHint: s.state,
      coordHint: s.coord,
      lvl: 2,
      why: 'tiger-reserve',
      tags: ['tiger-reserve'],
      listFact: s.since ? `Part of Project Tiger's network of tiger reserves since ${s.since}.` : undefined,
      listSrc: { title: `${L.list} (${L.owner})`, url: L.url },
    })
}
{
  const L = lists['india-national-parks']
  for (const s of L.items) add('india', { kind: 'park', title: s.title, lvl: 3, why: 'national-park', tags: ['national-park'], listSrc: { title: `${L.list} (${L.owner})`, url: L.url } })
}
{
  const L = lists['india-biosphere-reserves']
  for (const s of L.items)
    add('india', {
      kind: 'park',
      title: s.title,
      name: /Biosphere/.test(s.title ?? '') || /National Park/.test(s.title ?? '') ? undefined : `${s.name} Biosphere Reserve`,
      lvl: 2,
      why: 'biosphere',
      tags: ['biosphere'],
      listFact: s.unesco ? `In UNESCO's World Network of Biosphere Reserves since ${s.unesco}.` : undefined,
      listSrc: { title: `${L.list} (${L.owner})`, url: L.url },
    })
}
{
  const L = lists['world-capitals']
  // Seats of government Natural Earth marks as alternative capitals; former and summer capitals are left out.
  const ALT_KEEP = new Set(['Lobamba', 'The Hague', 'Putrajaya', 'Porto-Novo', 'Sri Jayawardenepura Kotte', 'Dodoma'])
  for (const s of L.items) {
    if (s.alt && !ALT_KEEP.has(s.name)) continue
    add('world', { kind: 'capital', qid: s.qid, co: s.iso, lvl: 3, why: 'capital', tags: ['national'], coordHint: [s.lat, s.lon], listSrc: { title: 'Natural Earth populated places (Admin-0 capitals)', url: L.url }, bothSheets: true })
  }
}

// ── 2. Articles and Wikidata items ──────────────────────────────────────────
const pages = await wpPages(cands.map((c) => c.title).filter(Boolean))
for (const c of cands) {
  if (c.title) {
    const p = pages.get(c.title)
    if (p && !p.disambiguation) c.page = p
    else review.unresolved.push({ sheet: c.sheet, kind: c.kind, title: c.title, why: p ? 'disambiguation' : 'no article' })
  }
}
// Ramsar rows: the kind follows what the site is; a row that redirects to a broader
// article (a park, a town) is a site within it, placed by its own name instead.
for (const c of cands.filter((c) => c.why === 'ramsar')) {
  const listed = c.listName ?? c.name
  if (c.page?.redirected && core(listed ?? '') && core(listed) !== core(stripQualifier(c.page.title)) && !c.name) {
    c.name = listed
    c.page = null
    c.osm = true
  }
  const label = `${c.page?.title ?? ''} ${c.name ?? ''}`
  c.kind = /National Park|Tiger Reserve/.test(label) ? 'park' : /Sanctuary|Reserve|Barrage|Mangrove|Creek|Estuary|Marsh|Wetland|River/.test(label) ? 'wetland' : LAKEY.test(label) ? 'lake' : 'wetland'
}
// Designated sites with no article: a Wikidata item with coordinates in India, else OpenStreetMap.
for (const c of cands.filter((c) => !c.title && !c.qid && c.name)) {
  const hits = await wdSearch(c.name)
  const ents = await wdEntities(hits.map((h) => h.id))
  const hit = hits.map((h) => ents.get(h.id)).find((e) => e && wdIds(e, 'P17').includes('Q668') && wdCoords(e).length)
  if (hit) c.qid = hit.id
  else c.osm = true
}
// Capitals and Wikidata-first candidates: find their article.
const qidFirst = cands.filter((c) => c.qid && !c.page)
const qEnts = await wdEntities(qidFirst.map((c) => c.qid))
const qTitles = await wpPages(qidFirst.map((c) => wdEnwiki(qEnts.get(c.qid))).filter(Boolean))
for (const c of qidFirst) {
  const t = wdEnwiki(qEnts.get(c.qid))
  if (t && qTitles.get(t)) c.page = qTitles.get(t)
}

const allQids = cands.map((c) => c.page?.qid ?? c.qid).filter(Boolean)
const ents = await wdEntities(allQids)
// Country items → ISO 3166 alpha-3.
const countryQids = new Set()
for (const e of ents.values()) for (const q of wdIds(e, 'P17')) countryQids.add(q)
const countryEnts = await wdEntities([...countryQids])
const iso3 = new Map([...countryEnts].map(([q, e]) => [q, wdStrings(e, 'P298')[0]]).filter(([, v]) => v))

// ── 3. Positions ────────────────────────────────────────────────────────────
for (const c of cands) {
  const qid = c.page?.qid ?? c.qid
  c.qid = qid
  c.ent = qid ? ents.get(qid) : null
  const wd = c.ent ? wdCoords(c.ent).filter((x) => x.globe === 'Q2') : []
  // Rivers: prefer a point on the river itself over its source or mouth when Wikidata qualifies them.
  const pick = wd.find((x) => x.preferred && !x.part) ?? wd.find((x) => !x.part) ?? wd[0]
  const wp = c.page && c.page.lat !== null ? { lat: c.page.lat, lon: c.page.lon } : null
  if (pick && wp && Number.isFinite(TOLERANCE_KM[c.kind] ?? 150) && km(pick.lat, pick.lon, wp.lat, wp.lon) > 50)
    review.coordConflicts.push({ title: c.page.title, qid, wikidata: [pick.lat, pick.lon], wikipedia: [wp.lat, wp.lon], km: Math.round(km(pick.lat, pick.lon, wp.lat, wp.lon)) })
  // When the two disagree on a point feature, trust the more precise one (Wikidata sometimes holds whole degrees).
  const decimals = (v) => (String(v).split('.')[1] ?? '').length
  const precision = (p) => Math.min(decimals(p.lat), decimals(p.lon))
  const conflict = pick && wp && Number.isFinite(TOLERANCE_KM[c.kind] ?? 150) && km(pick.lat, pick.lon, wp.lat, wp.lon) > 20
  if (pick && !(conflict && precision(wp) >= 3 && precision(pick) <= 1)) c.pos = { lat: pick.lat, lon: pick.lon, from: 'wikidata' }
  else if (wp) c.pos = { ...wp, from: 'wikipedia' }
  else if (c.coordHint) c.pos = { lat: c.coordHint[0], lon: c.coordHint[1], from: 'list' }
}
// OpenStreetMap (Nominatim) for designated sites that have neither an article nor a Wikidata item:
// the hit must carry the site's distinctive name.
for (const c of cands.filter((c) => c.osm && !c.pos)) {
  const key = core(c.name.replace(/\b(Wetland|Conservation|Reserve|Complex|Community|Bird|Sanctuary|Forest|Estuary)\b/gi, '')).split(' ')[0]
  try {
    const hits = await nominatim(`${c.name}, ${c.stateHint ?? ''}, India`, { countrycodes: 'in' })
    const more = hits.length ? [] : await nominatim(`${key}, ${c.stateHint ?? ''}, India`, { countrycodes: 'in' })
    const hit = [...hits, ...more].find((h) => norm(h.name ?? h.display_name).includes(key))
    if (hit) {
      c.pos = { lat: Math.round(Number(hit.lat) * 1e4) / 1e4, lon: Math.round(Number(hit.lon) * 1e4) / 1e4, from: 'osm' }
      c.osmRef = { title: `OpenStreetMap: ${hit.display_name.split(',').slice(0, 2).join(',')}`, url: `https://www.openstreetmap.org/${hit.osm_type}/${hit.osm_id}` }
    }
  } catch (err) {
    review.unresolved.push({ sheet: c.sheet, name: c.name, why: `nominatim: ${err.message}` })
  }
}

// ── 4. Dedupe ───────────────────────────────────────────────────────────────
const existingByQid = new Map()
for (const [id, l] of Object.entries(links)) if (l.qid) existingByQid.set(`${id.split('.')[0]}:${l.qid}`, id)
// The version 1 gazetteer only: places.json also holds the version 2 places this script produced last time.
const existingPlaces = existing.places.filter((p) => !p.added)
const PREFIX = { india: 'in', world: 'w' }
const enrich = {}
const addEnrich = (id, c) => {
  const e = (enrich[id] ??= { tags: [], facts: [], src: [], why: [] })
  for (const t of c.tags) if (!e.tags.includes(t)) e.tags.push(t)
  if (c.listFact && !e.facts.includes(c.listFact)) e.facts.push(c.listFact)
  if (c.listSrc && !e.src.some((s) => s.url === c.listSrc.url)) e.src.push(c.listSrc)
  if (c.why && !e.why.includes(c.why)) e.why.push(c.why)
}

const displayName = (c) => {
  if (c.name) return c.name
  let n = stripQualifier(c.page?.title ?? wdLabel(c.ent) ?? '')
  if (c.kind === 'river') n = n.replace(/^River /, '').replace(/ [Rr]iver$/, '')
  if (c.kind === 'region') n = n.replace(/ district$/, '')
  return n
}

/** Articles that duplicate a place already in the gazetteer under another name (a reservoir and its dam, a Ramsar site and its park). */
const MERGE_INTO = {
  'Maharana Pratap Sagar': 'in.dam.pong-dam',
  'Bhitarkanika Mangroves': 'in.park.bhitarkanika-national-park',
  'Kaluveli Bird Sanctuary': 'in.lake.kaliveli-lake',
}

const kept = []
const byQid = new Map()
for (const c of cands) {
  if (!c.pos) {
    if (c.page || c.qid || c.name) review.noCoords.push({ sheet: c.sheet, title: c.page?.title ?? c.name ?? c.qid })
    continue
  }
  c.displayName = displayName(c)
  // Hand-checked duplicates the automatic checks miss (a reservoir and its dam, a Ramsar site and its park).
  const forced = MERGE_INTO[c.page?.title ?? '']
  if (forced) {
    addEnrich(forced, c)
    review.merged.push({ candidate: c.displayName, into: forced, by: 'hand' })
    continue
  }
  // Same Wikidata item as a place already in the gazetteer (on this sheet): enrich that place instead.
  const hitId = c.qid && existingByQid.get(`${PREFIX[c.sheet]}:${c.qid}`)
  if (hitId) {
    addEnrich(hitId, c)
    review.merged.push({ candidate: c.displayName, into: hitId, by: 'wikidata' })
    continue
  }
  // National capitals may appear on both sheets; everything else lives on one.
  const otherSheet = c.qid && existingByQid.get(`${PREFIX[c.sheet === 'india' ? 'world' : 'india']}:${c.qid}`)
  if (otherSheet && !c.bothSheets) {
    addEnrich(otherSheet, c)
    review.merged.push({ candidate: c.displayName, into: otherSheet, by: 'wikidata (other sheet)' })
    continue
  }
  // Same name close by on the same sheet.
  const cn = core(c.displayName)
  const tol = Math.max(15, Number.isFinite(TOLERANCE_KM[c.kind] ?? 150) ? TOLERANCE_KM[c.kind] ?? 150 : 300)
  const near = existingPlaces.find(
    (p) => p.sheet === c.sheet && [p.name, ...(p.aka ?? [])].some((n) => core(n) === cn) && km(p.lat, p.lon, c.pos.lat, c.pos.lon) <= tol,
  )
  if (near) {
    addEnrich(near.id, c)
    review.merged.push({ candidate: c.displayName, into: near.id, by: 'name' })
    continue
  }
  // Duplicates among candidates.
  const dupKey = c.qid ? `${c.sheet}:${c.qid}` : `${c.sheet}:name:${cn}`
  const prev = byQid.get(dupKey)
  if (prev) {
    // A national capital is a capital, whatever else listed it.
    if (c.kind === 'capital' && prev.kind !== 'capital') Object.assign(prev, { kind: 'capital', co: c.co, bothSheets: true, listSrc: prev.listSrc ?? c.listSrc })
    for (const t of c.tags) if (!prev.tags.includes(t)) prev.tags.push(t)
    if (c.listFact) (prev.extraFacts ??= []).push(c.listFact)
    if (c.listSrc) (prev.extraSrc ??= []).push(c.listSrc)
    prev.lvl = Math.min(prev.lvl ?? 3, c.lvl ?? 3)
    review.duplicates.push({ candidate: c.displayName, kept: prev.displayName })
    continue
  }
  byQid.set(dupKey, c)
  kept.push(c)
}

// ── 5. Facts, identifiers, relations ────────────────────────────────────────
const leads = await wpExtracts(kept.map((c) => c.page?.title).filter(Boolean))
const ids = new Set(existingPlaces.map((p) => p.id))
const qidToId = new Map([...existingByQid].map(([k, id]) => [k, id]))
for (const c of kept) {
  let base = `${PREFIX[c.sheet]}.${c.kind}.${slug(c.displayName)}`
  let id = base
  if (ids.has(id)) {
    const where = c.co ?? iso3.get(wdIds(c.ent, 'P17')[0]) ?? c.stateHint ?? '2'
    id = `${base}-${slug(String(where))}`
    for (let n = 2; ids.has(id); n++) id = `${base}-${n}`
  }
  ids.add(id)
  c.id = id
  if (c.qid) qidToId.set(`${PREFIX[c.sheet]}:${c.qid}`, id)
}

const RECENT = /\b(20(1[89]|2\d))\b/
const out = { india: [], world: [] }
for (const c of kept) {
  const e = c.ent
  const lead = c.page ? leads.get(c.page.title) ?? '' : ''
  const facts = c.f ? [].concat(c.f) : pickFacts(lead, { max: c.kind === 'city' || c.kind === 'capital' ? 2 : 3, prefer: c.kind === 'strategic' ? RECENT : undefined })
  for (const f of [c.listFact, ...(c.extraFacts ?? [])]) if (f && !facts.includes(f)) facts.push(f)
  if (!facts.length) {
    review.noCoords.push({ sheet: c.sheet, title: c.page?.title ?? c.displayName, why: 'no facts' })
    continue
  }
  const countries = [...new Set(wdIds(e, 'P17').map((q) => iso3.get(q)).filter(Boolean))]
  const co = c.co ? [].concat(c.co) : c.sheet === 'world' ? countries : countries.length && !countries.includes('IND') ? countries : undefined
  // Elevation (metres) for high features.
  let el
  if (['peak', 'pass', 'volcano', 'glacier', 'lake'].includes(c.kind)) {
    const q = wdQuantity(e, 'P2044')
    if (q && Number.isFinite(q.amount)) el = Math.round(q.unit === 'Q3710' ? q.amount * 0.3048 : q.amount)
  }
  // Relations from Wikidata statements, where the target is in the gazetteer.
  const P = PREFIX[c.sheet]
  const ref = (q) => qidToId.get(`${P}:${q}`)
  const rel = { ...(c.rel ?? {}) }
  if (c.kind === 'river') {
    const mouth = wdIds(e, 'P403').map(ref).filter(Boolean)[0]
    if (mouth) rel[mouth.split('.')[1] === 'river' ? 'tributaryOf' : 'flowsInto'] = mouth
  }
  const range = wdIds(e, 'P4552').map(ref).filter(Boolean)[0]
  if (range && ['peak', 'pass', 'glacier', 'volcano'].includes(c.kind)) rel.range = range
  const water = wdIds(e, 'P206').map(ref).filter(Boolean)
  if (water.length && !['river', 'sea', 'gulf', 'strait'].includes(c.kind)) {
    const rivers = water.filter((w) => w.split('.')[1] === 'river')
    if (rivers.length) rel.onRiver = rivers
  }
  const within = [...wdIds(e, 'P706'), ...(['island', 'volcano'].includes(c.kind) ? wdIds(e, 'P361') : [])].map(ref).filter((x) => x && x !== c.id)
  if (within.length) rel.within = within[0]

  const aka = [...new Set([c.page && stripQualifier(c.page.title) !== c.displayName ? stripQualifier(c.page.title) : null, ...wdAliases(e)])]
    .filter((a) => a && a.length <= 40 && norm(a) !== norm(c.displayName) && !/^[A-Z]{2,5}$/.test(a) && /^[\p{Script=Latin}\d\s'’().,&-]+$/u.test(a))
    .slice(0, 4)
  const tags = [...new Set([...(c.tags ?? []), ...(wdStrings(e, 'P757').length ? ['world-heritage'] : [])])]
  const src = [
    ...(c.page ? [{ title: `Wikipedia: ${c.page.title}`, url: wikiUrl(c.page.title) }] : []),
    ...(c.qid ? [{ title: `Wikidata: ${c.qid}`, url: wikidataUrl(c.qid) }] : []),
    ...(c.osmRef ? [c.osmRef] : []),
    ...(c.listSrc ? [c.listSrc] : []),
    ...(c.extraSrc ?? []),
  ].filter((s, i, a) => a.findIndex((x) => x.url === s.url) === i)

  out[c.sheet].push({
    kind: c.kind,
    name: c.displayName,
    lat: Math.round(c.pos.lat * 1e4) / 1e4,
    lon: Math.round(c.pos.lon * 1e4) / 1e4,
    id: c.id.split('.').slice(2).join('.'),
    ...(co?.length ? { co } : {}),
    ...(c.st ? { st: c.st } : {}),
    lvl: c.lvl ?? 3,
    ...(el ? { el } : {}),
    f: facts,
    ...(aka.length ? { aka } : {}),
    ...(tags.length ? { tags } : {}),
    ...(c.sub ? { sub: c.sub } : {}),
    ...(Object.keys(rel).length ? { rel } : {}),
    src,
    qid: c.qid ?? undefined,
    why: c.why,
    pos: c.pos.from,
  })
}

mkdirSync(join(here, '../content/generated'), { recursive: true })
for (const s of ['india', 'world']) writeFileSync(join(here, `../content/generated/${s}.json`), JSON.stringify(out[s], null, 1))
writeFileSync(join(here, '../content/generated/enrich.json'), JSON.stringify(enrich, null, 1))
writeFileSync(join(here, '../reports/generate-review.json'), JSON.stringify(review, null, 2))
const count = (s) => existingPlaces.filter((p) => p.sheet === s).length
console.log(
  `India: ${count('india')} existing + ${out.india.length} new = ${count('india') + out.india.length}\n` +
    `World: ${count('world')} existing + ${out.world.length} new = ${count('world') + out.world.length}\n` +
    `Enriched existing places: ${Object.keys(enrich).length}; unresolved ${review.unresolved.length}; no coordinates/facts ${review.noCoords.length}; ` +
    `merged ${review.merged.length}; duplicate candidates ${review.duplicates.length}; coordinate conflicts ${review.coordConflicts.length}`,
)
