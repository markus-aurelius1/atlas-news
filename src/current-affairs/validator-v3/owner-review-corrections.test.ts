import { describe, expect, it } from 'vitest'
import { evaluateStageC } from './stage-c'
import { classifySubject } from './subject'
import { buildStories, equivalentDevelopment } from './stories'
import type { StageCObservation } from './contracts'
import type { NewsItem } from '../types'

// Mechanism regressions for the defects recorded in docs/production-release/OWNER_REVIEW_RESULTS.md.
// Natural rows quote captured feed metadata from that review; every other row is a
// synthetic adjacent control. Neither is a production quality estimate.
const versions = { policyId: 'tars-validator-stage-c/1', policyHash: 'a'.repeat(64), indexHash: 'a'.repeat(64), registryHash: 'a'.repeat(64), authorHash: 'a'.repeat(64), codeHash: 'a'.repeat(64) }
function decide(title: string, description = '') {
  const o: StageCObservation = { id: 'owner-review', captureId: 'synthetic', sourceId: 'unbound', ordinal: 0, capturedAt: '2026-10-07T00:00:00.000Z', parserVersion: 'synthetic', registryHash: versions.registryHash, metadataHash: 'b'.repeat(64), metadata: {
    title, description, url: 'https://example.org/owner-review', publisher: 'Unbound', publishedAt: null, updatedAt: null, categories: [], memberships: [], bylines: [],
  } }
  return evaluateStageC({ observations: [o], clock: '2026-10-08T00:00:00.000Z', versions }).articles[0]
}
const item = (title: string, url: string, extra: Partial<NewsItem> = {}): NewsItem => ({ title, description: '', url, publisher: 'Unbound', sourceId: 'unbound', section: 'India', publishedAt: '2026-10-07T07:00:00.000Z', ...extra })

describe('owner review: admission coverage', () => {
  it.each([
    ['El Niño arrived early. Why its impact was felt from India to the Panama Canal', 'El Niño\'s early onset has triggered a cascade of atypical weather events worldwide. India faced not only monsoon challenges but also significant shifts in policy due to insufficient rainfall.', 'Geography'],
    ['India’s Model BIT — a decade later, amid changes', 'India must draw lessons from a decade of investment treaty experience', 'International relations'],
    ['SC to examine plea to recall split verdict on CEC, EC appointment law', 'The Supreme Court on Wednesday agreed to examine a plea seeking recall of its recent split verdict on whether challenges to the 2023 law governing the appointment of the Chief Election Commissioner and Election Commissioners should be referred to a larger Constitution bench.', 'Polity'],
    ['Bird islands: On India’s bustard conservation programme', 'India’s conservation efforts must go beyond symbolism', 'Environment'],
    ['Yemen’s Houthis attack Aden airport as fighting intensifies', 'Yemen’s Houthis attacked Aden’s international airport with ballistic missiles and explosive-laden drones on Wednesday. Fighting has been focused in recent days on areas around the Bab el-Mandeb Strait, a shipping route that has become more crucial for energy exports since the conflict between the US and Iran restricted trade through the Strait of Hormuz.', 'Security'],
    ['AI cooperation: On Artificial Intelligence at a crossroads', 'The BRICS framework is an alternative to a geopolitical view of AI development', 'International relations'],
    ['Punjab reforms its PDS, checks pilferage, boosts savings', '', 'Governance'],
    ['COP31 hosts Australia and Türkiye face the fossil-fuel question', 'There is likely to be pressure on the COP31 presidencies to include fossil fuel language as part of the agenda', 'Environment'],
    ['Delhi HC refuses to direct security personnel to wear body cameras during protests', 'The court directed the Union government to decide on the appeal within six months.', 'Polity'],
  ])('admits a stated object with an independent proposition: %s', (title, description, subject) => {
    const decision = decide(title, description)
    expect(decision.accepted).toBe(true)
    expect(decision.relevance.reasonCodes.some(code => code.startsWith('C2.domain.'))).toBe(true)
    expect(classifySubject({ title, description }).primary).toBe(subject)
  })
  it.each([
    // An object without a proposition, a proposition without an object, and place names alone.
    'India’s bustard conservation', 'Appointment law', 'Model BIT', 'Supreme Court to examine plea of actor in cheating case', 'High court refuses bail to businessman',
    'Fighting Intensifies in Yemen, Raising Fresh Fears of All-Out War', 'Strait of Hormuz cruise photographs', 'Trump warns Iran leaders of economic ruin, says ‘make a deal’',
    'All 23 Indians aboard Liberian-flagged oil tanker rescued after attack off Russia’s Black Sea coast', 'Scientists puzzled as baby whales wash up dead in Argentina', 'India key driver of global growth: Shaktikanta Das',
  ])('still abstains on insufficient metadata: %s', title => expect(decide(title).decision).toBe('deferred'))
  it('a domestic object needs textual Indian jurisdiction, never a section or publisher', () => {
    expect(decide('Pension scheme reforms approved after long debate').decision).toBe('deferred')
    expect(decide('Kerala pension scheme reforms approved after long debate').accepted).toBe(true)
    expect(decide('Plague outbreak? Russian lab worker dies in Siberia', 'Quarantine measures have been in place in several hospitals in eastern Russia after an accident at a plague research centre, the public health watchdog said.').decision).toBe('deferred')
  })
  it('the object and its proposition must share a field', () => {
    expect(decide('India’s wetlands', 'The minister approved a new office building on Tuesday after reforms to parking rules.').decision).toBe('deferred')
    expect(decide('India’s wetlands', 'Wetlands in three States must be notified under the new rules, the court ordered.').accepted).toBe(true)
  })
  it.each(['Cartoon: The real threat to global growth', 'UPSC Prelims 2027 Polity Quiz (Week 179): MCQs on right to vote and fundamental rights', 'Rahul Gandhi Dragged Into Bus, Detained By Delhi Police Near Jantar Mantar | Watch', 'DMK slams Centre over GST rate cuts in Tamil Nadu'])('non-reading formats and party reactions stay rejected: %s', title => expect(decide(title).decision).toBe('rejected'))
})

describe('owner review: proper names are not propositions', () => {
  const title = 'India’s constitutional commitment to equality highlighted at UNHRC'
  it('an NGO name cannot supply institutional trust', () => {
    const ngo = decide(title, 'Sveva Fosca Martina Orifici, representing Sambhali Trust, addressed the 63rd Session of the United Nations Human Rights Council (UNHRC) in Geneva, highlighting the need to strengthen efforts against racism, racial discrimination, xenophobia and related forms of intolerance.')
    expect(ngo.decision).toBe('deferred')
  })
  it('the common noun in prose still counts', () => {
    expect(decide(title, 'A new survey finds that public trust in constitutional bodies across the country fell sharply after the ruling.').accepted).toBe(true)
  })
})

describe('owner review: subject frames', () => {
  it.each([
    ['India’s IT sector is surviving artificial intelligence', 'Though the technology is making life still harder for many graduates', 'Economy'],
    ['C Raja Mohan: AI is now a great-power game. That poses a test for India', '', 'International relations'],
    ['As India’s law enforcement agencies turn to AI, the potential benefits, risks', '', 'Governance'],
    ['New AI model solves a protein folding mechanism', '', 'Sci-Tech'],
    ['World’s oceans simmer at record heat, threatening marine life and food security', 'Record-breaking ocean heat is raising concerns over worsening storms, collapsing fisheries, coral loss and growing risks to communities dependent on marine ecosystems', 'Environment'],
    ['Over 20% returns: How NRIs could make a killing after banks hike FCNR(B) deposit rates', '', 'Economy'],
    ['Pvt universities : SC directive seeks accountability', '', 'Governance'],
    ['Museum unveils fossil fuel exhibition', '', 'Environment'],
  ])('%s', (title, description, subject) => expect(classifySubject({ title, description }).primary).toBe(subject))
  it('an agency or country name alone resolves nothing', () => {
    for (const title of ['ISRO chairman visits Chennai', 'Australia and Türkiye', 'Delhi Police near Jantar Mantar']) expect(classifySubject({ title, description: '' }).primary).toBe('Unresolved')
  })
})

describe('owner review: one development under different headlines', () => {
  const pairs: [string, string][] = [
    ['SC to examine plea to recall split verdict on CEC, EC appointment law', 'SC to examine plea for recall of split verdict on law governing appointment of CEC, ECs'],
    ['All 23 Indians aboard Liberian-flagged oil tanker rescued after attack off Russia’s Black Sea coast', '23 Indians rescued after oil tanker attacked off Russia\'s Black Sea coast'],
    ['High court refuses to direct Delhi cops to wear body cameras during stirs: ‘Cannot be said a grey area’', 'Delhi HC refuses to direct security personnel to wear body cameras during protests'],
  ]
  it.each(pairs)('merges: %s', (a, b) => {
    // Summaries of unequal length must not split the pair.
    const left = item(a, 'https://example.org/a', { description: 'The Supreme Court of India on Wednesday agreed in 2023 terms.' }), right = item(b, 'https://example.net/b', { publishedAt: '2026-10-07T12:00:00.000Z' })
    expect(equivalentDevelopment(left, right)).toBe(true)
    const now = Date.parse('2026-10-07T13:00:00.000Z')
    expect(buildStories([left, right].map(i => ({ item: i, observedAt: now, firstSeenAt: now })), [], [], now).units).toHaveLength(1)
  })
  it.each([
    ['SC to examine plea to recall split verdict on CEC, EC appointment law', 'SC refuses to examine plea to recall split verdict on CEC, EC appointment law'],
    ['SC to examine plea to recall split verdict on CEC, EC appointment law', 'Why SC will examine plea to recall split verdict on CEC, EC appointment law'],
    ['23 Indians rescued after oil tanker attacked off Russia’s Black Sea coast', '12 Indians rescued after oil tanker attacked off Russia’s Black Sea coast'],
    ['Indians rescued after oil tanker attacked off Russia’s Black Sea coast', 'Indians rescued after oil tanker attacked off Ukraine’s Black Sea coast'],
    ['Alice Smith wins the national science medal for neutrino discovery', 'Bob Jones wins the national science medal for neutrino discovery'],
    ['Yemen’s Houthis attack Aden airport as fighting intensifies', 'Fighting Intensifies in Yemen, Raising Fresh Fears of All-Out War'],
    ['Trump warns Iran leaders of economic ruin, says ‘make a deal’', 'Cartoon: Donald Trump’s Iran deal'],
  ])('keeps distinct: %s / %s', (a, b) => expect(equivalentDevelopment(item(a, 'https://example.org/a'), item(b, 'https://example.net/b'))).toBe(false))
  it('a report and an editorial, undated rows, and old coverage never merge lexically', () => {
    const [a, b] = pairs[0]
    expect(equivalentDevelopment(item(a, 'https://example.org/a'), item(b, 'https://example.net/b', { section: 'Editorial' }))).toBe(false)
    expect(equivalentDevelopment(item(a, 'https://example.org/a'), item(b, 'https://example.net/b', { publishedAt: null }))).toBe(false)
    expect(equivalentDevelopment(item(a, 'https://example.org/a'), item(b, 'https://example.net/b', { publishedAt: '2026-10-12T07:00:00.000Z' }))).toBe(false)
  })
  it('an earlier selected report makes the differently worded report a repeat', () => {
    const now = Date.parse('2026-10-07T13:00:00.000Z'), first = item(pairs[0][0], 'https://example.org/a'), second = item(pairs[0][1], 'https://example.net/b')
    const selected = buildStories([{ item: first, observedAt: now - 3600000, firstSeenAt: now - 3600000 }], [], [], now - 3600000).units[0]
    const next = buildStories([{ item: second, observedAt: now, firstSeenAt: now }], [], [{ id: selected.id, selectedAt: now - 3600000, lastSelectedAt: now - 3600000, representative: first, members: [first.url], frame: selected.frame }], now)
    expect(next.units[0].novelty).toBe('repeat')
    expect(next.units[0].id).toBe(selected.id)
  })
  it('is independent of input order', () => {
    const now = Date.parse('2026-10-07T13:00:00.000Z'), rows = pairs.flatMap(([a, b], i) => [item(a, `https://example.org/${i}`), item(b, `https://example.net/${i}`)]).map(i => ({ item: i, observedAt: now, firstSeenAt: now }))
    const ids = (input: typeof rows) => buildStories(input, [], [], now).units.map(u => [u.id, u.members.map(m => m.url).sort()])
    expect(ids([...rows].reverse())).toEqual(ids(rows))
  })
})
