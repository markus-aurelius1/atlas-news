import { describe, expect, it } from 'vitest'
import { evaluateStageC } from './stage-c'
import { classifySubject } from './subject'
import { buildStories, equivalentDevelopment, storyFrame } from './stories'
import { NEWS_SOURCES } from '../sources'
import type { StageCObservation } from './contracts'
import type { NewsItem } from '../types'

// Synthetic policy controls; never natural gold or production quality labels.
const versions = { policyId: 'tars-validator-stage-c/1', policyHash: 'a'.repeat(64), indexHash: 'a'.repeat(64), registryHash: 'a'.repeat(64), authorHash: 'a'.repeat(64), codeHash: 'a'.repeat(64) }
function decide(title: string, description = '', contextual = false) {
  const source = NEWS_SOURCES.find(s => s.id === 'ie-columns')!
  const o: StageCObservation = { id: 'synthetic-coverage', captureId: 'synthetic', sourceId: source.id, ordinal: 0, capturedAt: '2026-10-07T00:00:00.000Z', parserVersion: 'synthetic', registryHash: versions.registryHash, metadataHash: 'b'.repeat(64), metadata: {
    title, description, url: source.siteUrl + '/synthetic', publisher: source.publisher, publishedAt: null, updatedAt: null, categories: contextual ? ['Science', 'Explained'] : [],
    memberships: contextual ? [{ sourceId: source.id, feedUrl: source.feedUrl, section: source.section }] : [], bylines: contextual ? [{ name: 'C. Raja Mohan', provenance: 'rss:dc:creator' }] : [],
  } }
  return evaluateStageC({ observations: [o], clock: '2026-10-08T00:00:00.000Z', versions }).articles[0]
}
const item = (title: string, extra: Partial<NewsItem> = {}): NewsItem => ({ title, description: '', url: 'https://indianexpress.com/synthetic', publisher: 'Indian Express', sourceId: 'ie-india', section: 'India', publishedAt: '2026-10-07T00:00:00.000Z', ...extra })
describe('coverage recovery synthetic adjacent regressions', () => {
  it.each([
    ['RBI cuts policy rates to control inflation', 'RBI appointment announced'],
    ['Monetary policy analysis: RBI and inflation transmission', 'Overseas monetary policy committee begins meeting'],
    ['India nuclear doctrine: strategic capability assessment', 'India nuclear doctrine'],
    ['Chemistry Nobel 2028 awarded for discovery of autocatalysis', 'Chemistry Nobel 2028 awarded at a ceremony'],
    ['Neutrino experiment reveals a detection mechanism', 'Neutrino conference announced'],
    ['El Niño: pressure differences and evaporation drive rainfall', 'El Niño in the headlines'],
  ])('requires separate substantive evidence: %s', (positive, sparse) => {
    expect(decide(positive).accepted).toBe(true)
    expect(decide(positive).relevance.status).toBe('useful')
    expect(decide(sparse, '', true).decision).toBe('deferred')
    expect(decide(positive, '', true).accepted).toBe(true)
  })
  it.each(['Sensex rises as RBI cuts policy rates', 'News digest: Chemistry Nobel awarded for neutrino discovery & more', 'Congress demands resignation as RBI cuts policy rates', 'US domestic legislation: monetary policy reform and price stability', 'Campus award for neutrino discovery', 'NASA personnel dispute about neutrino experiments'])('new routes cannot borrow a noise headline: %s', title => {
    expect(decide(title, 'RBI cuts policy rates. Neutrino experiments discover a new mechanism.', true).decision).toBe('rejected')
  })
  it('does not infer meaning from author, category or feed', () => {
    for (const title of ['A distant horizon', 'Bridging economics and psychology', 'Power and virtue']) expect(decide(title, '', true).decision).toBe('deferred')
  })
  it('classifies new substantive frames independently of contextual metadata', () => {
    for (const [title, primary] of [['RBI cuts policy rates', 'Economy'], ['Nuclear doctrine and strategic deterrence', 'Security'], ['Chemistry Nobel 2028 and autocatalysis', 'Sci-Tech'], ['El Niño: pressure differences drive rainfall', 'Geography']]) expect(classifySubject({ title, description: '' }).primary).toBe(primary)
  })
  it('retains a bound analytical membership after primary-section merge', () => {
    const s = NEWS_SOURCES.find(s => s.id === 'ie-columns')!
    const a = item('RBI inflation transmission and distributional impact', { memberships: [{ sourceId: s.id, feedUrl: s.feedUrl, section: s.section }] })
    expect(storyFrame(a).angle).toBe('economic-transmission')
    expect(storyFrame({ ...a, memberships: [{ ...a.memberships![0], feedUrl: 'https://evil.example/feed' }] }).angle).toBeNull()
    expect(storyFrame({ ...a, url: 'https://indianexpress.com.evil.example/synthetic' }).angle).toBeNull()
  })
  it('groups only explicit equivalent award reports; no event-year inference or angle collapse', () => {
    const a = item('Chemistry Nobel 2028 awarded for discovery of molecular mechanism')
    const b = item('Researchers win Nobel Prize in Chemistry 2028 for autocatalysis', { url: 'https://example.org/synthetic' })
    expect(equivalentDevelopment(a, b)).toBe(true)
    const now = Date.parse(a.publishedAt!)
    expect(buildStories([a, b].map(item => ({ item, observedAt: now, firstSeenAt: now })), [], [], now).units).toHaveLength(1)
    for (const title of ['Physics Nobel 2028 awarded for neutrino discovery', 'Chemistry Nobel 2027 awarded for molecular discovery', 'Chemistry Nobel awarded for molecular discovery', 'Why Chemistry Nobel 2028 discovery changes scientific instruments']) expect(equivalentDevelopment(a, item(title, { url: 'https://example.org/different' }))).toBe(false)
    expect(equivalentDevelopment(a, { ...b, description: 'Comparison with the 2027 award.' })).toBe(false)
  })
})
