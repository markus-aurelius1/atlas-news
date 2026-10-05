// npm test  (node --test, no dependencies needed)
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { applyPyq, attachPyq, bandOf, buildAliasIndex, coreName, explainUnmatched, normalizeName, resolveRef, scorePlaces, validateEntry, YIELD_WEIGHTS } from '../lib/pyq.mjs'
import LEDGER from '../content/pyq/index.mjs'
import NOT_MAPPED from '../content/pyq/not-mapped.mjs'

const REAL = JSON.parse(readFileSync(new URL('../../../public/atlas/v1/places.json', import.meta.url), 'utf8')).places
const clone = (x) => JSON.parse(JSON.stringify(x))
const src = { title: 'test', url: 'https://example.org/q' }

test('names normalise and lose descriptor words', () => {
  assert.equal(normalizeName('Keoladeo  Ghana N.P.'), 'keoladeo ghana n p')
  assert.equal(normalizeName('Humayun’s Tomb'), 'humayuns tomb')
  assert.equal(normalizeName('Sri Vijaya Puram & Port Blair'), 'sri vijaya puram and port blair')
  assert.equal(coreName('Chilika Lake'), 'chilika')
  assert.equal(coreName('Lake Chilika'), 'chilika')
  assert.equal(coreName('Kaziranga National Park'), 'kaziranga')
  assert.equal(coreName('Nathu La'), 'nathu la')
  assert.equal(coreName('Lake'), '')
})

test('references resolve by id, name, alias and core name against the real gazetteer', () => {
  const idx = buildAliasIndex(REAL)
  assert.deepEqual(resolveRef(idx, 'in.pass.nathu-la'), { id: 'in.pass.nathu-la' })
  assert.deepEqual(resolveRef(idx, 'Nathu La'), { id: 'in.pass.nathu-la' })
  assert.equal(resolveRef(idx, 'Allahabad').id, REAL.find((p) => p.name === 'Prayagraj').id) // alias
  assert.equal(resolveRef(idx, 'Port Blair').id, REAL.find((p) => p.name === 'Sri Vijaya Puram').id)
  const chilika = REAL.find((p) => /chilika/i.test(p.name))
  assert.equal(resolveRef(idx, 'Chilika').id, chilika.id)
  // The same place on both sheets resolves to both, not "ambiguous".
  assert.deepEqual(resolveRef(idx, 'New Delhi'), { id: 'in.capital.new-delhi', also: ['w.capital.new-delhi'] })
  assert.ok(resolveRef(idx, 'Nowhere-at-all Lake').missing)
  assert.ok(resolveRef(idx, { id: 'in.nope.nope' }).missing)
})

test('ambiguous names are reported, and hints settle them', () => {
  const places = [
    { id: 'a.river.x', name: 'Tawa', kind: 'river', sheet: 'india', states: ['madhya-pradesh'] },
    { id: 'a.dam.x', name: 'Tawa', kind: 'dam', sheet: 'india', states: ['madhya-pradesh'] },
  ]
  const idx = buildAliasIndex(places)
  assert.deepEqual(resolveRef(idx, 'Tawa').ambiguous, ['a.river.x', 'a.dam.x'])
  assert.deepEqual(resolveRef(idx, { name: 'Tawa', kind: 'dam' }), { id: 'a.dam.x' })
})

test('entries without a source, year or question are rejected, not guessed', () => {
  assert.deepEqual(validateEntry({ exam: 'UPSC', year: 2020, q: 'x', places: ['A'], source: src }), [])
  assert.ok(validateEntry({ exam: 'UPSC', year: 2020, q: 'x', places: ['A'] }).some((p) => p.includes('source')))
  assert.ok(validateEntry({ exam: 'UPSC', year: 20, q: 'x', places: ['A'], source: src }).some((p) => p.includes('year')))
  assert.ok(validateEntry({ exam: 'UPSC', year: 2020, places: ['A'], source: src }).some((p) => p.includes('q ')))
  assert.deepEqual(validateEntry({ exam: 'UPSC', year: 2020, q: 'x', places: ['A'], source: { url: 'pdf:paper.pdf#p3' } }), [])
})

test('history counts distinct questions, years, exams, topics and sources', () => {
  const places = [{ id: 'p.a', name: 'Alpha Lake', level: 1 }, { id: 'p.b', name: 'Beta', level: 2 }]
  const e = (year, q, refs, extra = {}) => ({ exam: 'UPSC CSE Prelims', year, q, places: refs, source: src, ...extra })
  const res = attachPyq(places, [
    e(2014, 'Q1', ['Alpha'], { topic: 'wetlands' }),
    e(2014, 'Q1', ['Alpha Lake']), // the same question recorded twice
    e(2019, 'Q2', ['p.a', 'Beta'], { topic: ['wetlands', 'ramsar'], source: { title: 'Paper', url: 'pdf:2019.pdf#p4' } }),
    e(2021, 'Q3', ['Gamma']),
    { exam: 'UPSC', year: 2020, q: 'no source', places: ['Beta'] },
  ])
  assert.deepEqual(places[0].pyq, {
    count: 2,
    years: [2014, 2019],
    exams: ['UPSC CSE Prelims'],
    topics: ['ramsar', 'wetlands'],
    sources: [src, { title: 'Paper', url: 'pdf:2019.pdf', pages: [4] }],
  })
  assert.equal(places[1].pyq.count, 1)
  assert.equal(res.matched, 2)
  assert.equal(res.unmatched[0].ref, 'Gamma')
  assert.equal(res.invalid.length, 1)
})

test('pages of one PDF are grouped into one source', () => {
  const places = [{ id: 'p.a', name: 'Alpha', level: 2 }]
  const e = (year, q, url) => ({ exam: 'UPPCS Prelims', year, q, places: ['Alpha'], source: { title: 'Papers', url } })
  attachPyq(places, [e(2001, 'Q1', 'pdf:papers.pdf#p12'), e(2002, 'Q2', 'pdf:papers.pdf#p3'), e(2003, 'Q3', 'pdf:papers.pdf#p12'), e(2004, 'Q4', 'pdf:other.pdf#p1')])
  assert.deepEqual(places[0].pyq.sources, [
    { title: 'Papers', url: 'pdf:papers.pdf', pages: [3, 12] },
    { title: 'Papers', url: 'pdf:other.pdf', pages: [1] },
  ])
})

test('names listed as not mapped are explained, the rest stay open', () => {
  const res = explainUnmatched([{ ref: 'Walong' }, { ref: { name: 'Sindh', kind: 'river' } }, { ref: 'Nowhere' }], { Walong: 'town', Sindh: 'river' })
  assert.deepEqual(res.unmatched, [{ ref: 'Nowhere' }])
  assert.deepEqual(res.explained.map((x) => x.reason), ['town', 'river'])
})

test('the score is bounded, explained, and rewards frequent, recurring, recent, central places', () => {
  const places = [
    { id: 'hot', name: 'Hot', level: 1, tags: ['ramsar'], pyq: { count: 4, years: [2013, 2017, 2021, 2024], exams: ['UPSC'], topics: [], sources: [] }, rel: { near: ['warm', 'cold'] } },
    { id: 'warm', name: 'Warm', level: 2, pyq: { count: 1, years: [2012], exams: ['UPSC'], topics: [], sources: [] } },
    { id: 'cold', name: 'Cold', level: 3 },
    { id: 'gap', name: 'Gap', level: 1, tags: ['tiger-reserve'] },
  ]
  const { refYear } = scorePlaces(places)
  assert.equal(refYear, 2024)
  const [hot, warm, cold, gap] = places.map((p) => p.yield)
  for (const y of [hot, warm, cold, gap]) {
    assert.ok(y.score >= 0 && y.score <= 100)
    assert.equal(y.band, bandOf(y.score))
    assert.ok(y.reasons.length > 0)
    assert.deepEqual(Object.keys(y.parts).sort(), Object.keys(YIELD_WEIGHTS).sort())
  }
  assert.ok(hot.score > warm.score && warm.score > cold.score, JSON.stringify({ hot, warm, cold }))
  assert.equal(hot.band, 'core')
  assert.match(hot.reasons[0], /Asked 4× in UPSC \(2013, 2017, 2021, 2024\)/)
  assert.ok(hot.reasons.includes('Ramsar site'))
  assert.ok(warm.parts.recency < 0.5, 'asked 12 years before the latest paper')
  // Important but never asked: flagged as under-tested, never claimed as asked.
  assert.ok(gap.parts.gap > 0.5)
  assert.ok(gap.reasons.some((r) => r.includes('not yet seen')))
  assert.ok(!gap.reasons.some((r) => r.startsWith('Asked')))
  assert.ok(gap.score > cold.score)
})

test('weights sum to 1 and an empty ledger changes nothing', () => {
  assert.equal(Math.round(Object.values(YIELD_WEIGHTS).reduce((a, b) => a + b, 0) * 1000), 1000)
  const places = clone(REAL.slice(0, 20))
  const res = applyPyq(places, [])
  assert.equal(res.applied, false)
  assert.deepEqual(places, REAL.slice(0, 20))
})

test('the committed ledger is valid and fully resolvable', () => {
  for (const e of LEDGER) assert.deepEqual(validateEntry(e), [], JSON.stringify(e))
  const res = attachPyq(clone(REAL), LEDGER)
  assert.deepEqual(res.invalid, [])
  assert.deepEqual(res.ambiguous, [])
  // Every name that does not resolve to a place is listed, with a reason, in not-mapped.mjs.
  const open = explainUnmatched(res.unmatched, NOT_MAPPED).unmatched.map((u) => u.ref)
  assert.deepEqual(open, [])
})
