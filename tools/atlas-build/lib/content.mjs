/**
 * Gathers the gazetteer: the hand-written places of data version 1
 * (content/*.mjs) and the sourced places added in version 2
 * (content/generated, built by gazetteer/generate.mjs from content/candidates).
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { slug } from './geo.mjs'
import indiaRivers from '../content/india-rivers.mjs'
import indiaMountains from '../content/india-mountains.mjs'
import indiaLand from '../content/india-land.mjs'
import indiaWater from '../content/india-water.mjs'
import indiaPlaces from '../content/india-places.mjs'
import world from '../content/world.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const json = (p, fallback) => (existsSync(join(here, p)) ? JSON.parse(readFileSync(join(here, p), 'utf8')) : fallback)

/** Version 2 places: sourced, marked `added: 2`. */
const generated = (sheet) => json(`../content/generated/${sheet}.json`, []).map((p) => ({ ...p, added: 2 }))

export const CONTENT = {
  india: [...indiaRivers, ...indiaMountains, ...indiaLand, ...indiaWater, ...indiaPlaces, ...generated('india')],
  world: [...world, ...generated('world')],
}

/** Existing place id → { title, qid } (gazetteer/link-existing.mjs). */
export const LINKS = json('../content/sources/links.json', {})
/** Existing place id → { tags, facts, src } found while generating version 2. */
export const ENRICH = json('../content/generated/enrich.json', {})
/** Version 1 ids, levels and fog units, kept fixed (see explore.ts in the app). */
export const V1_LOCK = json('../content/sources/v1-lock.json', null)

export const PREFIX = { india: 'in', world: 'w' }
export const placeId = (sheet, p) => `${PREFIX[sheet]}.${p.kind}.${p.id ?? slug(p.name)}`

/** Rivers that need a traced or hand-drawn course on the India sheet. */
export function riverSpecs() {
  return CONTENT.india
    .filter((p) => p.kind === 'river' && p.line)
    .map((p) => ({ id: p.id ?? slug(p.name), name: p.name, rank: p.lvl === 1 ? 2 : p.lvl === 3 ? 4 : 3, ...p.line }))
}
