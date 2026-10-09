import { describe, it, expect, vi } from 'vitest'
import { evaluateStageC } from './stage-c.ts'
import { NEWS_SOURCES } from '../sources.ts'
import type { StageCObservation, StageCInput } from './contracts.ts'
const versions = { policyId: 'tars-validator-stage-c/1', policyHash: 'a'.repeat(64), indexHash: 'a'.repeat(64), registryHash: 'a'.repeat(64), authorHash: 'a'.repeat(64), codeHash: 'a'.repeat(64) }
// Synthetic policy invariants only. These are never natural gold or calibration rows.
function observation(title: string, description = '', source = 'ie-columns'): StageCObservation {
  const s = NEWS_SOURCES.find(s => s.id === source)!
  return { id: 'synthetic:1', captureId: 'synthetic', sourceId: s.id, ordinal: 0, capturedAt: '2026-10-07T00:00:00.000Z', parserVersion: 'synthetic', registryHash: versions.registryHash, metadataHash: 'b'.repeat(64), metadata: { title, description, url: s.siteUrl + '/synthetic', publisher: s.publisher, memberships: [{ sourceId: s.id, feedUrl: s.feedUrl, section: s.section }], categories: [], bylines: [{ name: 'C. Raja Mohan', provenance: 'rss:dc:creator' }], publishedAt: null, updatedAt: null } }
}
const input = (o: StageCObservation): StageCInput => ({ observations: [o], clock: '2026-10-08T00:00:00.000Z', versions })
const run = (title: string, description = '') => evaluateStageC(input(observation(title, description))).articles[0]
describe('Stage C synthetic adjacent controls', () => {
  const pairs = [
    ['India memorial corridor opened to honour bilateral ties', 'India and Japan sign treaty on maritime chokepoint security and blockade risks'],
    ['Congress demands resignation after Supreme Court ruling in India', 'India Supreme Court invalidates electoral rule in petition filed by BJP'],
    ['Party campaign strategy to win seats in India', 'India fiscal federalism: efficiency versus equity in tax devolution'],
    ['NASA personnel dispute over staff politics', 'NASA exoplanet research discovers evidence of a new atmosphere'],
    ['Campus award for quantum computing research', 'Quantum computing research: experiment reveals new mechanism'],
    ['Promotional livestream of quantum computing research', 'Quantum research discovers a new computing mechanism'],
    ['France high school students protest: why it matters', 'Climate change study reveals global ocean warming mechanism'],
    ['US climate lawsuit cites climate change study evidence', 'Climate change research reveals global ocean warming mechanism'],
    ['US local court revises domestic court policy', 'Nuclear enrichment treaty limits proliferation risks'],
    ['US Congress changes energy permitting in federal energy rules', 'Oil prices rise as global supply shock transmits inflation'],
    ['Live streaming of a cricket match: AI and climate change', 'India sports governance law reforms regulation'],
    ['Celebrity gossip: AI rights and Constitution', 'India personality rights judgment reforms AI regulation'],
    ['Recruitment advertisement: apply now for public jobs', 'India recruitment reform: law changes public selection policy'],
    ['Company product launch promises AI revolution', 'India AI governance regulation addresses law enforcement risks'],
    ['Reform probe clears Farage aides caught in donations sting', 'Diplomacy and wars: international order faces climate change risks'],
  ]
  for (const [negative, positive] of pairs) it('distinguishes ' + negative, () => { expect(run(negative).decision).toBe('rejected'); expect(run(positive).accepted).toBe(true) })
  it('institutional action leads despite incidental ceremony, entertainment or party reaction', () => {
    expect(run('India and Japan sign maritime security treaty at memorial ceremony').accepted).toBe(true)
    expect(run('India Supreme Court rules on personality rights after celebrity gossip').accepted).toBe(true)
    expect(run('India Supreme Court invalidates electoral rule after Congress demands changes').accepted).toBe(true)
    expect(run('India Supreme Court rules on Chinese companies under banking regulation').accepted).toBe(true)
    expect(run('US Supreme Court ruling mentions India in domestic legislation').decision).toBe('rejected')
    expect(run('Tell us why India Supreme Court invalidates an electoral rule').accepted).toBe(true)
    expect(run('Congress demands changes after India Supreme Court invalidates electoral rule').decision).toBe('rejected')
  })
  it('hard exclusions survive a substantive summary and verified author', () => {
    const p = run('Congress demands resignation over India policy', 'India fiscal federalism requires reforms to ensure equity and efficiency.')
    expect(p.decision).toBe('rejected'); expect(p.relevance.dimensions.authorPrior).toBe(1)
    expect(p.relevance.reasonCodes).toContain('C2.hard_gate_precedence.v1')
  })
  it('verified byline and source cannot accept opaque, ceremonial or irrelevant items', () => {
    for (const title of ['An unknowable tomorrow', 'The ghosts return', 'Bridging economics and psychology']) { const p = run(title); expect(p.decision).toBe('deferred'); expect(p.verifiedAuthors.length).toBe(1); expect(p.relevance.dimensions.authorPrior).toBe(0) }
    expect(run('Courtesy visit to inaugurate memorial corridor in India').decision).toBe('rejected')
  })
  it('authorship is bound to source, publisher, URL and observed byline', () => {
    for (const change of [(o: StageCObservation) => o.metadata.bylines = [], (o: StageCObservation) => o.metadata.url = 'https://indianexpress.com.evil.example/test', (o: StageCObservation) => o.metadata.publisher = 'Other', (o: StageCObservation) => o.metadata.bylines[0].name = 'C. Raja Mohan and someone else', (o: StageCObservation) => o.sourceId = 'unbound']) {
      const o = observation('C Raja Mohan: India fiscal federalism needs equity reforms'); change(o)
      const p = evaluateStageC(input(o)).articles[0]; expect(p.verifiedAuthors).toEqual([]); expect(p.relevance.dimensions.authorPrior).toBe(0)
    }
  })
  it('bounded priors cannot change acceptance or confer must-read', () => {
    const o = observation('Lending transparency: disclosures protect borrowers'), p = evaluateStageC(input(o)).articles[0]
    expect(p.relevance.status).toBe('useful'); expect(p.relevance.dimensions.authorPrior).toBe(1)
    o.metadata.bylines = []; o.metadata.memberships = []; o.metadata.publisher = 'Other'
    const q = evaluateStageC(input(o)).articles[0]; expect(q.decision).toBe(p.decision); expect(q.relevance.status).toBe(p.relevance.status)
  })
  it('missing and two-word placeholder summaries do not resolve rhetoric', () => {
    expect(run('When faced against a cannon', 'Protests and Education').metadataSufficiency.description).toBe('placeholder')
    expect(run('When faced against a cannon', 'Protests and Education').decision).toBe('deferred')
    const p = run('Why rivers need rejuvenation strategy'); expect(p.accepted).toBe(true); expect(p.metadataSufficiency.level).toBe('limited'); expect(p.relevance.confidence).toBe('moderate')
  })
  it('metadata resolution improves only with topical substance', () => {
    expect(run('A difficult future').accepted).toBe(false)
    expect(run('A difficult future', 'Quantum computing research discovers evidence of a new mechanism.').accepted).toBe(true)
  })
  it('country and publisher changes do not veto universal science', () => {
    for (const place of ['China', 'US', 'UK', 'India']) expect(run(place + ' fossil research discovers evidence of a dinosaur').accepted).toBe(true)
  })
  it('foreign institutions can publish transferable science, but local legislatures cannot borrow global terms', () => {
    expect(run('Canadian campus study discovers fossil evidence of a dinosaur').accepted).toBe(true)
    expect(run('Canada domestic legislation reform discusses global governance').decision).toBe('rejected')
  })
  it('paraphrase and title/description swaps retain mechanism evidence', () => {
    for (const [title, description] of [['Researchers discover a fossil', 'The study identifies evidence of a dinosaur in Antarctica.'], ['A new study from Antarctica', 'Researchers identified fossil evidence of a dinosaur.'], ['New nuclear enrichment treaty limits proliferation', ''], ['Oil markets suffer a global supply shock', '']]) { expect(run(title, description).accepted).toBe(true); expect(run(description, title).accepted).toBe(true) }
  })
  it('keyword accumulation and lexical ambiguities cannot accept by themselves', () => {
    for (const title of ['India NASA economy court science', 'Quantum computing research', 'Independent institutions', 'School enrichment programme cuts tuition fees', 'Quantum research quantum research quantum research', 'CPI(M) picking up campaign strategy', 'US Congress local election campaign strategy', 'Security Company product launch of generic pipeline', 'CPI inflation and UP election', 'Explained: A brighter future']) expect(run(title).accepted).toBe(false)
  })
  it('publisher duplication, identity replacement and category stuffing cannot confer relevance', () => {
    const o = observation('An opaque horizon'), p = evaluateStageC(input(o))
    const duplicate = structuredClone(o); duplicate.id = 'synthetic:2'; duplicate.metadata.publisher = 'Other'; duplicate.metadata.categories = ['Quantum computing research', 'India fiscal federalism reform']
    expect(evaluateStageC({ ...input(o), observations: [duplicate, o] }).articles[0].decision).toBe(p.articles[0].decision)
  })
  it('repeated/permuted observations are byte-identical and frozen inputs stay untouched', () => {
    const a = observation('India fiscal federalism requires equity'), b = observation('Quantum research discovers new mechanism'); b.id = 'synthetic:2'; b.metadata.url += '-2'
    const i = { ...input(a), observations: [a, b] }, before = JSON.stringify(i), out = evaluateStageC(i)
    expect(evaluateStageC(i)).toEqual(out); expect(evaluateStageC({ ...i, observations: [b, a] })).toEqual(out); expect(JSON.stringify(i)).toBe(before)
    expect(out.articles.every(p => !('primarySubject' in p) && !('novelty' in p) && !('rank' in p))).toBe(true)
  })
  it('every evidence span resolves exactly in UTF-16 including astral prefixes', () => {
    const o = observation('🌍 India fiscal federalism requires equity'), p = evaluateStageC(input(o)).articles[0]
    for (const e of [...p.eligibility.evidence, ...p.relevance.evidence]) {
      const value = e.path.split('.').reduce<unknown>((x, key) => (x as Record<string, unknown>)[key], o.metadata)
      expect((value as string).slice(e.start, e.end)).toBe(e.text); expect(e.observationId).toBe(o.id)
    }
  })
  it('never calls the network', () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('network forbidden') })
    try { expect(run('Quantum computing research discovers new mechanism').accepted).toBe(true); expect(spy).not.toHaveBeenCalled() } finally { spy.mockRestore() }
  })
  it('rejects runtime gold, predictions, bodies, personal state and later-stage features', () => {
    for (const field of ['gold', 'v2', 'predictions', 'history', 'subject', 'saved', 'capacity', 'holdout']) expect(() => evaluateStageC({ ...input(observation('opaque')), [field]: {} } as StageCInput)).toThrow()
    const missing = input(observation('opaque')); delete (missing.versions as Partial<typeof versions>).authorHash; expect(() => evaluateStageC(missing)).toThrow()
    for (const field of ['body', 'articleText', 'gold', 'v2Score', 'primarySubject', 'partyPoliticsPrimary']) {
      const i = input(observation('opaque')); Object.assign(i.observations[0].metadata, { [field]: 'forbidden' }); expect(() => evaluateStageC(i)).toThrow()
    }
  })
  it('rejects invalid dates, duplicates, future observations and future revisions', () => {
    for (const change of [(i: StageCInput) => i.clock = 'now', (i: StageCInput) => i.observations.push(i.observations[0]), (i: StageCInput) => i.observations[0].capturedAt = '2027-01-01T00:00:00.000Z', (i: StageCInput) => i.observations[0].metadata.updatedAt = '2027-01-01T00:00:00.000Z', (i: StageCInput) => i.observations[0].registryHash = 'b'.repeat(64)]) { const i = input(observation('opaque')); change(i); expect(() => evaluateStageC(i)).toThrow() }
  })
})
