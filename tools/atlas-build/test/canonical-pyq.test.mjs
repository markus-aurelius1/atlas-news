/** Release boundary, quality gates, identity resolution and runtime leakage tests against the real frozen package. */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { loadCanonical, readZip, verifyPackage, loadVerified, runtimeEligibility, canonicalHash } from '../lib/canonical-package.mjs'
import { premiumRenderability, SUPPORTED_BLOCKS, textLocations } from '../../../src/atlas/pyq/quality.mjs'
import { blockNodes, nodesHtml } from '../../../src/atlas/pyq/render.mjs'
import { buildEntityIndex, resolveEntity, extractMentions } from '../lib/atlas-mentions.mjs'
import { classifyRelevance, assignRoles } from '../lib/atlas-relevance.mjs'
import { curate, runtimeArtifacts } from '../canonical-pyq.mjs'
import mappings from '../content/pyq/canonical-mappings.mjs'
import { fixtures } from './fixtures/canonical-structures.mjs'

const clone = (x) => structuredClone(x)
const packagePath = process.env.CANONICAL_PYQ_PACKAGE ?? new URL('../../../../canonical-pyq-v2-final.zip', import.meta.url)
const zip = existsSync(packagePath) ? readFileSync(packagePath) : null
const pkg = zip ? verifyPackage(readZip(zip)) : null
const canonical = pkg ? loadVerified(pkg) : { records: [], identity: {} }
const integration = (name, fn) => test(name, { skip: !pkg && 'Supply canonical-pyq-v2-final.zip or CANONICAL_PYQ_PACKAGE for full release verification' }, fn)
const atlas = JSON.parse(readFileSync(new URL('../../../public/atlas/v1/places.json', import.meta.url)))
const index = buildEntityIndex(atlas, mappings)
const result = pkg ? curate(canonical, atlas, index) : { counts: {}, rows: [] }
const report = { counts: result.counts, candidates: result.rows }
const byId = new Map(canonical.records.map((r) => [r.record.id, r]))

integration('pinned release manifest verifies every entry and rejects changed bytes, extra paths and wrong identity', () => {
  const files = readZip(zip)
  assert.equal(files.size, 325)
  const damaged = new Map(files)
  damaged.set('canonical-pyq-v2-final/corpus/upsc-cse/2025.json', Buffer.from('[]'))
  assert.throws(() => verifyPackage(damaged), /integrity/)
  const extra = new Map(files); extra.set('canonical-pyq-v2-final/extra.json', Buffer.from('{}'))
  assert.throws(() => verifyPackage(extra), /count/)
  assert.throws(() => verifyPackage(files, '0'.repeat(64)), /identity/)
  assert.throws(() => readZip(Buffer.from('not a zip')), /directory/)
})

integration('active pack loading has exact stable IDs and all question/answer/provenance joins', () => {
  assert.equal(canonical.records.length, 6982)
  assert.equal(canonical.index.papers.length, 56)
  assert.equal(canonical.records.filter((r) => r.meta.immediately_scoreable).length, 6815)
  for (const { record, answer, paper } of canonical.records) {
    assert.equal(answer.id, record.answer_id)
    assert.equal(answer.question_id, record.id)
    assert.equal(record.exam.code, paper.exam)
  }
  assert.equal(byId.get('CDS-2023-II-GK-Q061').answer.correct_options.join(''), 'C')
  assert.equal(byId.get('UPPCS-2018-GS1-Q001').record.provenance.booklet, 'C')
})

integration('joins fail closed on shuffled answers, metadata hashes, duplicate IDs and archive paths', () => {
  const mutate = (path, fn) => ({ ...pkg, json: (p) => p === path ? fn(clone(pkg.json(p))) : pkg.json(p) })
  assert.throws(() => loadVerified(mutate('answers/upsc-cse/2026.json', (rows) => { rows[0].question_id = rows[1].question_id; return rows })), /Duplicate/)
  assert.throws(() => loadVerified(mutate('corpus/runtime-metadata.json', (v) => { v.questions[0].base_question_hash = '0'.repeat(64); return v })), /hash mismatch/)
  assert.throws(() => loadVerified(mutate('corpus/index.json', (v) => { v.papers[0].questions = 'source-archive/corpus/upsc-cse/2026.json'; return v })), /Non-active/)
  assert.throws(() => loadVerified(mutate('answers/upsc-cse/2026.json', (rows) => { rows[0].booklet = 'X'; return rows })), /provenance/)
})

integration('runtime gate requires every sidecar field and rejects all unresolved issues, independently of legacy flags', () => {
  const { meta, answer, record } = canonical.records.find((r) => runtimeEligibility(r.meta, r.answer).pass)
  assert.equal(runtimeEligibility(meta, answer).pass, true)
  const bad = { active: false, quiz_state: 'NEEDS_FIX_BEFORE_SCORING', answer_status: 'ambiguous', answer_scoreable: false, immediately_scoreable: false, requires_local_correction: true, content_issues: ['SOURCE_UNCLEAR'], answer_issues: ['ANSWER_UNAVAILABLE'], visual_flags: ['MAP_REQUIRED'], disposition: 'CANCELLED' }
  for (const [key, value] of Object.entries(bad)) assert.equal(runtimeEligibility({ ...meta, [key]: value }, answer).pass, false, key)
  assert.equal(runtimeEligibility(meta, { ...answer, status: 'unavailable' }).pass, false)
  assert.equal(runtimeEligibility(meta, { ...answer, correct_options: [] }).pass, false)
  assert.equal(runtimeEligibility(meta, { ...answer, correct_options: ['A', 'B'] }).pass, true)
  record.validation.quiz_ready = false
  assert.equal(runtimeEligibility(meta, answer).pass, true)
  assert.equal(canonical.records.filter((r) => runtimeEligibility(r.meta, r.answer).pass).length, 6792)
})

for (const [name, fixture] of Object.entries(fixtures)) test(`premium component faithfully represents ${name}`, () => {
  assert.deepEqual(premiumRenderability(fixture), { pass: true, reasons: [] })
  const html = nodesHtml(blockNodes(fixture.content))
  assert.ok(html.length > 0)
  for (const location of textLocations(fixture).filter((x) => x.location !== 'option')) assert.ok(html.includes(location.text.replaceAll('&', '&amp;').replaceAll('“', '“').replaceAll('"', '&quot;')), location.text)
})

test('all supported block discriminants have a fixture and unknown/visual blocks fail', () => {
  assert.ok(SUPPORTED_BLOCKS.every((b) => b in fixtures))
  for (const type of ['figure-reference', 'map-reference', 'image-reference', 'unknown']) {
    const q = clone(fixtures.paragraph); q.content = [{ type, asset_id: 'missing' }]
    assert.equal(premiumRenderability(q).pass, false)
    assert.throws(() => blockNodes(q.content), /Unsupported/)
  }
})

test('premium rejects broken boundaries, empty items, malformed rows/codes, OCR, visual text and orphan labels', () => {
  const reject = (q) => assert.equal(premiumRenderability(q).pass, false)
  let q = clone(fixtures.paragraph); q.options[0].content = []; reject(q)
  q = clone(fixtures.paragraph); q.options[1].content = q.options[0].content; reject(q)
  q = clone(fixtures['statement-list']); q.content[1].items[0].content = []; reject(q)
  q = clone(fixtures.table); q.content[1].rows[0].pop(); reject(q)
  q = clone(fixtures.table); q.content[1].rows[0][0] = ''; reject(q)
  q = clone(fixtures['answer-code']); q.options[0].content[0].segments[0].value = '99'; reject(q)
  q = clone(fixtures.paragraph); q.content[0].text += ' See the map shown below.'; reject(q)
  q = clone(fixtures.paragraph); q.content[0].text += ' \uFFFD OCR Page 3 of 5'; reject(q)
  q = clone(fixtures['ordered-list']); q.content[1].items[0].label = ''; reject(q)
  q = clone(fixtures.sequence); q.options[0].content[0].segments.pop(); reject(q)
  assert.ok(nodesHtml(blockNodes([{ type: 'paragraph', text: '<script>alert(1)</script>' }])).includes('&lt;script&gt;'))
})

test('same place IDs resolve by exact ID, name, alias, normalized spelling and Wikidata identity only', () => {
  assert.equal(resolveEntity(index, 'in.pass.nathu-la').placeId, 'in.pass.nathu-la')
  assert.equal(resolveEntity(index, 'Nathu La').placeId, 'in.pass.nathu-la')
  assert.equal(resolveEntity(index, 'Nathu-La').placeId, 'in.pass.nathu-la')
  assert.equal(resolveEntity(index, 'Allahabad').placeId, atlas.places.find((p) => p.name === 'Prayagraj').id)
  assert.equal(resolveEntity(index, 'Nathu Lax').placeId, null)
  assert.equal(resolveEntity(index, 'New Delhi').placeId, 'in.capital.new-delhi')
  assert.deepEqual(resolveEntity(index, 'New Delhi').alsoPlaceIds, ['w.capital.new-delhi'])
  assert.equal(resolveEntity(index, 'Barak River').placeId, 'in.river.barak')
  assert.equal(resolveEntity(index, 'Krishna').placeId, null)
  const p = atlas.places.find((p) => p.wikidata && atlas.places.filter((a) => a.wikidata === p.wikidata).length === 1)
  const wd = buildEntityIndex(atlas, { ...mappings, wikidata: [{ mention: 'Verified alternate identity', wikidataId: p.wikidata, sourceUrl: 'https://www.wikidata.org/wiki/' + p.wikidata, reason: 'fixture' }] })
  assert.equal(resolveEntity(wd, 'Verified alternate identity').placeId, p.id)
  assert.throws(() => buildEntityIndex(atlas, { ...mappings, aliases: [{ mention: 'New place', placeId: 'does-not-exist' }] }), /Invalid/)
})

test('mention spans preserve exact source text, structured location, ambiguity and coverage outside quiz gates', () => {
  const q = clone(fixtures.paragraph); q.content[0].text = 'The Nathu-La pass connects Sikkim. Krishna may refer to a person.'
  const x = extractMentions('canonical-id', q, index)
  const pass = x.mentions.find((m) => m.placeId === 'in.pass.nathu-la')
  assert.equal(pass.mentionText, 'Nathu-La pass')
  assert.equal(q.content[0].text.slice(pass.start, pass.end), pass.mentionText)
  assert.ok(x.mentions.some((m) => m.mentionText === 'Krishna' && m.placeId === null))
  assert.ok(x.mentions.every((m) => m.questionId === 'canonical-id'))
  assert.ok(!extractMentions('fixture', { content: [{ type: 'paragraph', text: 'to go to the test' }] }, index).mentions.length)
  assert.ok(!extractMentions('fixture', { content: [{ type: 'paragraph', text: 'Indian economy' }] }, index).mentions.length)
  assert.equal(resolveEntity(index, 'Uruguay').placeId, null)
  const namedPlateau = extractMentions('fixture', { content: [{ type: 'paragraph', text: 'Chota Nagpur' }] }, index).mentions
  assert.ok(!namedPlateau.some((m) => m.placeId === 'in.city.nagpur'))
  const table = clone(fixtures.table); table.content[1].rows[0][0] = 'Nathu La'
  assert.ok(extractMentions('canonical-id', table, index).mentions.some((m) => m.placeId === 'in.pass.nathu-la' && m.locationInQuestion === 'table'))
})

test('relevance separates actual location/place learning from incidental politics, biography, organizations and statistics', () => {
  const classify = (text, choice = 'Nathu La') => {
    const q = clone(fixtures.paragraph); q.content[0].text = text; q.options[0].content[0].text = choice
    return classifyRelevance(q, extractMentions('fixture', q, index).mentions, index).classification
  }
  assert.equal(classify('Where is Nathu La pass located?'), 'direct-spatial')
  assert.equal(classify('With reference to Chilika Lake, which statement is correct?'), 'place-centric')
  for (const prompt of ['An organization met in Nathu La. Which Act was passed?', 'Which philosopher visited Nathu La?', 'Which country is an ASEAN member near Nathu La?', 'Which place has the highest literacy: Nathu La?', 'Consider the physical capital in the Indian economy.']) assert.ok(['incidental', 'none'].includes(classify(prompt)), prompt)
  const q = clone(fixtures.pairs); q.content[0].text = 'Tributary River – Main River'; q.content[1].items[0].left = 'Beas'; q.content[1].items[0].right = 'Indus'
  assert.equal(classifyRelevance(q, extractMentions('fixture', q, index).mentions, index).classification, 'spatial-association')
})

test('incorrect options never grant mastery; unmatched and comparison statements never imply truth', () => {
  const m = { questionId: 'id', placeId: 'in.pass.nathu-la', locationInQuestion: 'option', optionKey: 'B' }
  const roles = assignRoles([m, { ...m, locationInQuestion: 'stem' }, { ...m, locationInQuestion: 'pair' }], { classification: 'direct-spatial' }, { correct_options: ['A'] }, true)
  assert.equal(roles[0].semanticRole, 'distractor'); assert.equal(roles[0].masteryEligible, false)
  assert.equal(roles[1].masteryEligible, true); assert.equal(roles[2].masteryEligible, false)
})

test('malformed JSON structures return explicit render rejection rather than crashing the validator', () => {
  for (const q of [null, {}, { ...fixtures.table, content: [{ type: 'table', columns: null, rows: [] }] }, { ...fixtures.paragraph, content: [null] }]) assert.equal(premiumRenderability(q).pass, false)
})

integration('every runtime question passes all gates, retains exact representation and final answer, maps to meaningful permanent IDs', () => {
  const manifest = JSON.parse(readFileSync(new URL('../../../public/pyq-atlas/v1/manifest.json', import.meta.url)))
  let total = 0
  const families = { CSE: 0, PCS: 0, CDS: 0 }
  for (const entry of manifest.papers) {
    const paper = JSON.parse(readFileSync(new URL('../../../public/pyq-atlas/v1/' + entry.questions, import.meta.url)))
    const answers = JSON.parse(readFileSync(new URL('../../../public/pyq-atlas/v1/' + entry.answers, import.meta.url)))
    for (const q of paper.questions) {
      const source = byId.get(q.id)
      assert.ok(source)
      assert.deepEqual(q.question, source.record.question)
      assert.equal(canonicalHash(q.question), q.baseQuestionHash)
      assert.equal(runtimeEligibility(source.meta, source.answer).pass, true)
      assert.equal(premiumRenderability(q.question).pass, true)
      assert.ok(['direct-spatial', 'place-centric', 'spatial-association'].includes(q.relevance))
      assert.ok(q.relations.some((r) => r.placeId && !['incidental', 'distractor'].includes(r.semanticRole)))
      assert.ok(q.relations.every((r) => index.byId.has(r.placeId) && r.questionId === q.id && !(r.masteryEligible && r.semanticRole !== 'primary')))
      assert.deepEqual(answers.answers.find((a) => a.questionId === q.id).correctOptions, source.answer.correct_options)
      assert.equal(q.exam.corpus_role, q.family === 'CDS' ? 'secondary' : 'primary')
      assert.ok(!JSON.stringify(q).includes('source_filename'))
      families[q.family]++; total++
    }
  }
  assert.equal(total, manifest.count)
  assert.deepEqual(families, manifest.byFamily)
  assert.equal(report.candidates.length, 6982)
  assert.equal(report.counts.activeCanonicalRecords, total + report.counts.excludedByRuntimeGate + report.counts.excludedByRenderabilityGate + report.counts.excludedByRelevanceGate)
  assert.ok(report.candidates.filter((r) => !r.included).every((r) => r.reasons.length))
})

integration('deterministic curation and runtime artifacts are invariant to source pack traversal order', () => {
  const a = curate(canonical, atlas, index)
  const b = curate({ ...canonical, records: [...canonical.records].reverse() }, atlas, index)
  assert.deepEqual(a.counts, b.counts)
  assert.deepEqual(a.allMentions, b.allMentions)
  assert.deepEqual([...runtimeArtifacts(a, canonical.identity)], [...runtimeArtifacts(b, canonical.identity)])
})
