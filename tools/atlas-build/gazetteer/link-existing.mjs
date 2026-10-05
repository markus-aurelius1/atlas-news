/**
 * Links every place already in the gazetteer to its Wikipedia article and
 * Wikidata item, and audits its coordinates against them.
 *
 *   node gazetteer/link-existing.mjs
 *
 * Writes content/sources/links.json (place id → { title, qid, dist }), which the
 * compiler turns into provenance, and reports/links-review.json (places with no
 * confident match, and authored points far from the sources).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolvePlaces, TOLERANCE_KM } from './match.mjs'
import OVERRIDES from '../content/sources/link-overrides.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../../..')
const places = JSON.parse(readFileSync(join(root, 'public/atlas/v1/places.json'), 'utf8'))
const stateName = new Map(places.states.map((s) => [s.id, s.name]))
const countryName = new Map(places.countries.map((c) => [c.iso, c.name]))

const input = places.places
  .filter((p) => !p.added) // version 1 places only
  .filter((p) => OVERRIDES[p.id] !== null)
  .map((p) => {
    const wiki = (p.sources ?? []).map((s) => /en\.wikipedia\.org\/wiki\/(.+)$/.exec(s.url)?.[1]).find(Boolean)
    const where = p.sheet === 'india' ? [...(p.states ?? []).map((s) => stateName.get(s)), 'India'] : (p.countries ?? []).map((c) => countryName.get(c))
    const title = OVERRIDES[p.id] ?? (wiki ? decodeURIComponent(wiki).replace(/_/g, ' ') : undefined)
    return { key: p.id, name: p.name, kind: p.kind, lat: p.lat, lon: p.lon, aka: p.aka, where, title }
  })

console.log(`Linking ${input.length} places…`)
const res = await resolvePlaces(input, { log: console.log })

const links = {}
const unresolved = []
const far = []
for (const p of input) {
  const r = res.get(p.key)
  if (!r?.page) {
    unresolved.push({ id: p.key, name: p.name, kind: p.kind, tried: r?.tried?.slice(0, 6) })
    continue
  }
  const { page } = r
  links[p.key] = { title: page.title, qid: page.qid, ...(r.dist !== null && r.dist !== undefined ? { dist: Math.round(r.dist * 10) / 10 } : {}), how: r.how }
  const tol = TOLERANCE_KM[p.kind] ?? 150
  if (Number.isFinite(tol) && r.dist !== null && r.dist > tol * 0.6) far.push({ id: p.key, name: p.name, title: page.title, dist: Math.round(r.dist), authored: [p.lat, p.lon], source: [page.lat, page.lon] })
}

mkdirSync(join(here, '../content/sources'), { recursive: true })
mkdirSync(join(here, '../reports'), { recursive: true })
writeFileSync(join(here, '../content/sources/links.json'), JSON.stringify(links, null, 1))
writeFileSync(join(here, '../reports/links-review.json'), JSON.stringify({ unresolved, far }, null, 2))
const how = Object.values(links).reduce((a, l) => ((a[l.how] = (a[l.how] ?? 0) + 1), a), {})
console.log(`Linked ${Object.keys(links).length}/${input.length} (${JSON.stringify(how)}); ${unresolved.length} unresolved; ${far.length} far from the source point`)
