/**
 * Coordinate audit: every version 1 place against its Wikidata item (and
 * Wikipedia article). Lists point features whose authored position is further
 * from both sources than their kind allows.
 *
 *   node gazetteer/audit-coords.mjs  → reports/coords-audit.json
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { km, wdCoords, wdEntities, wpPages } from '../lib/wiki.mjs'
import { TOLERANCE_KM } from './match.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '../../..')
const { places } = JSON.parse(readFileSync(join(root, 'public/atlas/v1/places.json'), 'utf8'))
const links = JSON.parse(readFileSync(join(here, '../content/sources/links.json'), 'utf8'))

const v1 = places.filter((p) => !p.added && links[p.id] && Number.isFinite(TOLERANCE_KM[p.kind] ?? 150))
const ents = await wdEntities(v1.map((p) => links[p.id].qid))
const pages = await wpPages(v1.map((p) => links[p.id].title))
const out = []
for (const p of v1) {
  const l = links[p.id]
  const wd = wdCoords(ents.get(l.qid)).filter((c) => c.globe === 'Q2')[0]
  const wp = pages.get(l.title)
  const dWd = wd ? km(p.lat, p.lon, wd.lat, wd.lon) : null
  const dWp = wp?.lat != null ? km(p.lat, p.lon, wp.lat, wp.lon) : null
  const tol = TOLERANCE_KM[p.kind] ?? 150
  const near = [dWd, dWp].filter((d) => d !== null)
  if (!near.length) continue
  if (Math.min(...near) > tol * 0.5)
    out.push({ id: p.id, kind: p.kind, title: l.title, authored: [p.lat, p.lon], wikidata: wd ? [wd.lat, wd.lon] : null, wikipedia: wp?.lat != null ? [wp.lat, wp.lon] : null, km: Math.round(Math.min(...near)), tol })
}
out.sort((a, b) => b.km / b.tol - a.km / a.tol)
writeFileSync(join(here, '../reports/coords-audit.json'), JSON.stringify(out, null, 1))
console.log(`${v1.length} point features checked; ${out.length} further than half their tolerance from both sources`)
for (const o of out) console.log(`  ${o.id.padEnd(46)} ${String(o.km).padStart(4)} km (tol ${o.tol})  authored ${o.authored}  wd ${o.wikidata ?? '-'}  wp ${o.wikipedia ?? '-'}`)
