// The version 2 gazetteer pipeline: article matching, fact extraction, and the
// guarantees places.json must keep (every version 1 place, sourced additions).
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { check, core, stripQualifier } from '../gazetteer/match.mjs'
import { cleanLead, pickFacts, sentences } from '../gazetteer/facts.mjs'

const page = (title, description, lat = null, lon = null, extra = {}) => ({ title, description, lat, lon, disambiguation: false, redirected: false, ...extra })

test('distinctive names: generic words drop, names made only of them stay whole', () => {
  assert.equal(core('Kaziranga National Park'), 'kaziranga')
  assert.equal(core('Hudson Bay Lowlands'), 'hudson lowlands')
  assert.equal(core('Desert National Park'), 'desert national park')
  assert.equal(stripQualifier('Kota, Rajasthan'), 'Kota')
  assert.equal(stripQualifier('Po (river)'), 'Po')
})

test('an article must be about the place itself', () => {
  const malacca = { name: 'Strait of Malacca', kind: 'strait', lat: 3.5, lon: 100.5 }
  assert.equal(check(malacca, page('Malacca Strait Bridge', 'Bridge in Malaysia', 2.2, 102.2)).ok, false)
  assert.equal(check(malacca, page('Strait of Malacca', 'Strait between the Malay Peninsula and Sumatra')).ok, true)
  const wetland = { name: 'East Kolkata Wetlands', kind: 'wetland', lat: 22.55, lon: 88.45 }
  assert.equal(check(wetland, page('Kolkata district', 'District of West Bengal', 22.57, 88.36)).ok, false)
  // A description that merely mentions a district is fine; one whose head noun is "district" is not.
  const valley = { name: 'Chumbi Valley', kind: 'valley', lat: 27.45, lon: 88.95 }
  assert.equal(check(valley, page('Chumbi Valley', 'Valley in Yadong County, Tibet, China', 27.48, 88.9)).ok, true)
  const island = { name: 'Hawaii', kind: 'island', lat: 19.6, lon: -155.5 }
  assert.equal(check(island, page('Hawaii', 'State of the United States of America', 21.3, -157.8)).ok, false)
  // Point features must lie near the authored position.
  const pass = { name: 'Nathu La', kind: 'pass', lat: 27.39, lon: 88.83 }
  assert.equal(check(pass, page('Nathu La', 'Mountain pass', 27.39, 88.84)).ok, true)
  assert.equal(check(pass, page('Nathu La', 'Mountain pass', 30.1, 81.2)).ok, false)
  // A redirect from a title built from the name counts as a match.
  const nalanda = { name: 'Nalanda', kind: 'monument', lat: 25.13, lon: 85.44 }
  assert.equal(check(nalanda, page('Nalanda mahavihara', 'Buddhist monastery', null, null, { redirected: true }), 'Nalanda').ok, true)
})

test('leads are cleaned and split without inventing text', () => {
  const lead =
    'Wular Lake (Kashmiri pronunciation: [wulur]; also spelled Wolar) is one of the largest freshwater lakes in Asia. It is sometimes said to be the largest; the Jhelum feeds it. The lake basin was formed by tectonic activity and is fed by the Jhelum River. The name derives from an old word.'
  const clean = cleanLead(lead)
  assert.ok(!clean.includes('pronunciation'))
  assert.ok(clean.startsWith('Wular Lake is one of the largest freshwater lakes in Asia.'))
  const facts = pickFacts(lead)
  assert.equal(facts[0], 'Wular Lake is one of the largest freshwater lakes in Asia.')
  for (const f of facts) assert.ok(clean.includes(f.replace(/\.$/, '')), `fact not from the lead: ${f}`)
  assert.ok(!facts.some((f) => f.includes('name derives')), 'etymology is left out')
  assert.deepEqual(sentences('Mt. Abu is a hill station. It lies in the Aravalli Range, near St. Mary’s church.'), ['Mt. Abu is a hill station.', 'It lies in the Aravalli Range, near St. Mary’s church.'])
})

const placesFile = new URL('../../../public/atlas/v1/places.json', import.meta.url)
const lockFile = new URL('../content/sources/v1-lock.json', import.meta.url)

test('places.json keeps every version 1 place with its level and fog unit', { skip: !existsSync(lockFile) }, () => {
  const { places } = JSON.parse(readFileSync(placesFile, 'utf8'))
  const lock = JSON.parse(readFileSync(lockFile, 'utf8'))
  const byId = new Map(places.map((p) => [p.id, p]))
  for (const [id, [level, unit]] of Object.entries(lock.places)) {
    const p = byId.get(id)
    assert.ok(p, `missing version 1 place ${id}`)
    assert.equal(p.level, level, `${id} level`)
    if (unit) assert.equal(p.unit, unit, `${id} unit`)
    assert.equal(p.added, undefined, `${id} must not be marked as added`)
  }
})

test('every place added in version 2 is sourced, placed and unique', () => {
  const { places } = JSON.parse(readFileSync(placesFile, 'utf8'))
  const added = places.filter((p) => p.added)
  const ids = new Set()
  const qids = new Map()
  for (const p of places) {
    assert.ok(!ids.has(p.id), `duplicate id ${p.id}`)
    ids.add(p.id)
    if (p.wikidata && !(p.kind === 'capital' && p.tags?.includes('national'))) {
      const key = `${p.sheet}:${p.wikidata}`
      // Deltas and valleys may cite their river's article; otherwise one item is one place per sheet.
      // Version 1 already pairs a few names with one article (the Siang and the Brahmaputra); new places may not.
      const prev = qids.get(key)
      if (prev && (p.added || prev.added) && !['delta', 'valley'].includes(p.kind) && !['delta', 'valley'].includes(prev.kind)) assert.fail(`${p.id} duplicates ${prev.id} (${p.wikidata})`)
      qids.set(key, p)
    }
  }
  for (const p of added) {
    assert.ok(p.sources?.some((s) => /^https:\/\//.test(s.url)), `${p.id} has no source link`)
    assert.ok(p.facts.length > 0, `${p.id} has no facts`)
    assert.ok(Number.isFinite(p.lat) && Number.isFinite(p.lon), `${p.id} has no position`)
    assert.equal(p.added, 2)
  }
})
