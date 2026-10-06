/** Validator regression: hand-labelled real feed items plus the properties the weighted-evidence model must keep. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PhraseMatcher, tokenize } from './match'
import { ACCEPT_THRESHOLD, SUBSTANCE_THRESHOLD, classify } from './relevance'
import { NEWS_SOURCES } from './sources'
import type { NewsItem, RelevanceIndex } from './types'

const index: RelevanceIndex = JSON.parse(readFileSync(new URL('../../public/current-affairs/v2/relevance-index.json', import.meta.url), 'utf8'))
interface Case extends Pick<NewsItem, 'title' | 'description' | 'publisher' | 'section' | 'sourceId'> { label: 'relevant' | 'not-relevant' | 'borderline'; group: string }
const cases: Case[] = JSON.parse(readFileSync(new URL('./fixtures/relevance-cases.json', import.meta.url), 'utf8')).cases
const item = (title: string, overrides: Partial<NewsItem> = {}) => ({ title, description: '', publisher: 'Indian Express', section: 'India', sourceId: 'ie-india', ...overrides })
const verdict = (title: string, overrides: Partial<NewsItem> = {}) => classify(item(title, overrides), index)

/** Relevant articles the validator still rejects. Listed so a fix or a regression both show up as a test change. */
const KNOWN_MISSES = [
  'From Amitabh Bachchan to Janhvi Kapoor', // personality rights explainer: "celebrity" in the headline is hard noise
  'Government panel to study AI-copyright', // one theme, no further evidence
  'Delhi women now needs Pink Saheli card', // state scheme named only by its brand
  'RML recalls 10 drug batches',
  'Other than outrage: On women, unsafe public spaces',
  'Industry is growing, but isn’t creating jobs',
  'Monsoon ends with 13% rain deficit',
  'A fighter-jet shortage won’t fly in these times',
  'El Niño calls for wider monitoring of ecological stress',
  'Editorial. CAFE smokescreen', // opaque headline, one concept in the summary
  'NASA’s Roman Space Telescope blasts off',
  'Editorial. Bite the bullet', // opaque headline, one concept in the summary
  'Beyond the patent',
]
/** Noise the validator still admits. */
const KNOWN_FALSE_POSITIVES = [
  'Honda plans highway test of wireless charging',
  'The climate scientist Kate Marvel sheds light on why she left NASA',
  'Indian envoy to US meets US Senator',
]
const known = (list: string[], c: Case) => list.some(prefix => c.title.startsWith(prefix))

describe('labelled feed items', () => {
  it('covers every stratum the audit sampled', () => {
    expect(cases.length).toBeGreaterThanOrEqual(250)
    for (const group of ['polity', 'governance', 'economy', 'ir', 'environment', 'science', 'uppcs', 'substack', 'description', 'noise', 'old-fp', 'new-fp', 'borderline']) expect(cases.some(c => c.group === group), group).toBe(true)
  })
  it.each(cases.filter(c => c.label === 'relevant' && !known(KNOWN_MISSES, c)))('accepts [$group] $title', c => {
    const r = classify(c, index)
    expect(r.accepted, JSON.stringify(r.evidence)).toBe(true)
    expect(r.staticAnchors.length).toBeGreaterThan(0)
    expect(r.subjects.length).toBeGreaterThan(0)
  })
  it.each(cases.filter(c => c.label === 'not-relevant' && !known(KNOWN_FALSE_POSITIVES, c)))('rejects [$group] $title', c => {
    const r = classify(c, index)
    expect(r.accepted, JSON.stringify(r.evidence)).toBe(false)
    expect(r.rejectionReason).toBeTruthy()
  })
  it('keeps the known-error lists exact, so they shrink when the validator improves', () => {
    expect(cases.filter(c => c.label === 'relevant' && !classify(c, index).accepted).map(c => c.title).filter(t => !KNOWN_MISSES.some(p => t.startsWith(p)))).toEqual([])
    for (const prefix of KNOWN_MISSES) expect(cases.filter(c => c.title.startsWith(prefix)).map(c => classify(c, index).accepted), prefix).toEqual([false])
    for (const prefix of KNOWN_FALSE_POSITIVES) expect(cases.filter(c => c.title.startsWith(prefix)).map(c => classify(c, index).accepted), prefix).toEqual([true])
  })
  it('holds recall and noise rejection on the labelled set', () => {
    const rate = (label: Case['label']) => { const of = cases.filter(c => c.label === label); return of.filter(c => classify(c, index).accepted).length / of.length }
    expect(rate('relevant')).toBeGreaterThanOrEqual(0.9)
    expect(rate('not-relevant')).toBeLessThanOrEqual(0.05)
  })
  it('gives every borderline case a scored, explained verdict either way', () => {
    for (const c of cases.filter(c => c.label === 'borderline')) {
      const r = classify(c, index)
      expect(r.evidence!.length).toBeGreaterThan(0)
      expect(r.accepted || !!r.rejectionReason).toBe(true)
    }
  })
})

describe('weighted evidence', () => {
  it('explains every verdict: evidence points add up to the score against one threshold', () => {
    for (const c of cases) {
      const r = classify(c, index), total = Math.round(r.evidence!.reduce((n, e) => n + e.points, 0) * 10) / 10
      expect(r.threshold).toBe(ACCEPT_THRESHOLD)
      if (r.rejectionReason?.startsWith('Noise headline')) { expect(r.score).toBe(0); continue }
      expect(r.score).toBeCloseTo(Math.max(0, total), 1)
      if (r.accepted) expect(r.score).toBeGreaterThanOrEqual(ACCEPT_THRESHOLD)
      else expect(r.rejectionReason).toMatch(/^(?:No syllabus concept|No substantive development|Evidence -?[\d.]+ below threshold)/)
    }
  })
  it('weighs a headline concept above the same concept in the summary', () => {
    const headline = verdict('Ramsar wetland conservation framework expands'), summary = verdict('A quiet change in the marshes', { description: 'Ramsar wetland conservation framework expands' })
    expect(headline.score).toBeGreaterThan(summary.score)
    expect(headline.evidence!.find(e => e.kind === 'concept')!.where).toBe('title')
    expect(summary.evidence!.find(e => e.kind === 'concept')!.where).toBe('description')
  })
  it('lets the summary alone qualify an article with an opaque headline', () => {
    const r = verdict('Editorial. Unfinished business', { section: 'Editorial', sourceId: 'bl-editorial', publisher: 'BusinessLine', description: 'The GST Council must fix input tax credit refunds, and the Finance Commission should revisit tax devolution to states' })
    expect(r.accepted).toBe(true)
    expect(r.evidence!.filter(e => e.kind === 'concept').every(e => e.where === 'description')).toBe(true)
    expect(r.signals.every(s => s.endsWith('summary only'))).toBe(true)
    // One passing mention in a summary is not enough.
    expect(verdict('Editorial. Unfinished business', { section: 'Editorial', description: 'The fog over airports also delayed a GST notice' }).accepted).toBe(false)
  })
  it('accumulates evidence instead of requiring one rigid headline match', () => {
    const theme = verdict('Offshore wind prototype planned'), supported = verdict('India’s first offshore wind prototype planned off Tamil Nadu under new policy', { section: 'Economy', sourceId: 'bl-economy' })
    expect(theme.accepted).toBe(false)
    expect(supported.accepted).toBe(true)
    expect(supported.evidence!.map(e => e.kind)).toEqual(expect.arrayContaining(['concept', 'framing', 'india', 'source']))
  })
  it('rewards past-paper recurrence and marks specific concepts above broad ones', () => {
    const points = (title: string) => verdict(title).evidence!.find(e => e.kind === 'concept')!.points
    expect(points('Finance Commission meets')).toBeGreaterThan(points('Supreme Court meets'))
    expect(verdict('Finance Commission meets').evidence![0].label).toMatch(/CSE P\d+\/M\d+.*past questions/)
  })
  it('gives no feed an unconditional pass', () => {
    for (const source of NEWS_SOURCES) {
      const r = classify({ title: 'Notes from a long weekend', description: 'A few personal reflections.', publisher: source.publisher, section: source.section, sourceId: source.id }, index)
      expect(r.accepted, source.id).toBe(false)
    }
    const curated = { sourceId: 'ie-upsc', section: 'UPSC Current Affairs' }
    expect(verdict('Why civic sense matters on our roads', curated)).toMatchObject({ accepted: false, rejectionReason: 'No syllabus concept in headline or summary' })
    expect(verdict('UPSC Key: Poompuhar, NCERT Textbooks and Article 370', curated).evidence).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'source', label: 'Publisher-curated UPSC section' })]))
    expect(verdict('UPSC Essentials daily subject quiz: Polity MCQs on Article 370', curated).accepted).toBe(false)
  })
  it('reserves hard rejection for clear noise and lets substance outweigh softer noise', () => {
    for (const title of ['Horoscope today: what the Supreme Court of stars says', 'IPL 2026: RBI governor attends cricket final', 'New smartphone launch offer after GST cut', 'Bollywood actress on GST and inflation']) expect(verdict(title).rejectionReason, title).toMatch(/^Noise headline/)
    const crime = verdict('ED arrests former minister under PMLA as Supreme Court examines constitutional validity of money laundering law')
    expect(crime.evidence!.some(e => e.kind === 'noise' && e.points < 0)).toBe(true)
    expect(crime.accepted).toBe(true)
    expect(verdict('Man arrested for theft at Supreme Court canteen').accepted).toBe(false)
  })
  it('discounts Indian institutions’ names in stories set abroad, but keeps global syllabus concepts', () => {
    const world = { sourceId: 'ht-world', section: 'World', publisher: 'Hindustan Times' }
    expect(verdict('Israel’s Supreme Court overturns election ban on Arab parties', world).accepted).toBe(false)
    expect(verdict('Black unemployment rose sharply in September, jobs report shows', { sourceId: 'nyt-economy', section: 'Economy', publisher: 'New York Times' }).accepted).toBe(false)
    expect(verdict('Iran says Strait of Hormuz will stay shut as nuclear talks stall', world).accepted).toBe(true)
    expect(verdict('Supreme Court strikes down electoral bonds scheme as unconstitutional').accepted).toBe(true)
  })
  it('drops routine US domestic news but keeps US stories with an India, international or scientific dimension', () => {
    const nyt = { sourceId: 'nyt-climate', section: 'Climate', publisher: 'New York Times' }, world = { sourceId: 'ht-world', section: 'World', publisher: 'Hindustan Times' }
    const domestic = (r: ReturnType<typeof verdict>) => r.evidence!.some(e => e.kind === 'foreign' && e.label.startsWith('US domestic'))
    for (const [title, overrides] of [
      ['A Supreme Court Battle Over Climate Change Begins', nyt],
      ['States Sue Over Trump’s Repeal of Climate Rules for Power Plants', nyt],
      ['Trump names intelligence chief Jay Clayton as new White House AI czar', world],
      ['US heating oil prices set to jump 50% this winter: Why millions of Americans face higher bills', world],
      ['More than 1,200 Colorado students have earned a climate seal', { sourceId: 'guardian-environment', section: 'Environment', publisher: 'Guardian' }],
    ] as const) {
      const r = verdict(title, overrides)
      expect(domestic(r), title).toBe(true)
      expect(r.accepted, title).toBe(false)
    }
    for (const [title, overrides] of [
      ['US sanctions cast shadow on India’s Russian oil imports', world],
      ['US, China agree tariff truce after trade talks in Geneva', world],
      ['US Air Force pulls bombers from UK air base after suspected terror attack', world],
      ['NASA’s space telescope launch to map dark energy and exoplanets', { sourceId: 'nyt-science', section: 'Science', publisher: 'New York Times' }],
    ] as const) expect(domestic(verdict(title, overrides)), title).toBe(false)
    expect(verdict('US sanctions cast shadow on India’s Russian oil imports', world).accepted).toBe(true)
    expect(verdict('US, China agree tariff truce after trade talks in Geneva', world).accepted).toBe(true)
  })
  it('lifts PIB explainers only when a syllabus concept leads them', () => {
    const pib = { sourceId: 'substack-people-policies-progress-pib-india', section: 'Newsletter', publisher: 'People, Policies, Progress — PIB India' }
    const led = verdict('How UPI Is Changing the Way We Pay', pib), plain = verdict('How UPI Is Changing the Way We Pay', { sourceId: 'substack-future-of-india', section: 'Newsletter', publisher: 'Future of India' })
    expect(led.evidence).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'source', label: 'PIB explainer led by a syllabus concept' })]))
    expect(led.score).toBeGreaterThan(plain.score)
    const circular = verdict('Office memorandum on revised timings for the canteen', pib)
    expect(circular.accepted).toBe(false)
    expect(circular.evidence!.some(e => e.kind === 'source')).toBe(false)
  })
  it('treats Uttar Pradesh as its own evidence for UPPCS', () => {
    const r = verdict('UP cabinet approves new industrial policy for Bundelkhand', { sourceId: 'et-uttarpradesh', publisher: 'Economic Times', section: 'Uttar Pradesh' })
    expect(r.accepted).toBe(true)
    expect(r.evidence).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'state' })]))
    expect(r.staticAnchors).toContain('Uttar Pradesh governance')
    expect(verdict('Heavy rain alert in Lucknow; schools shut', { sourceId: 'et-uttarpradesh', section: 'Uttar Pradesh' }).accepted).toBe(false)
  })
})

describe('phrase matching and the index', () => {
  it('matches acronyms case-sensitively, folds accents and simple plurals', () => {
    const m = new PhraseMatcher<string>()
    m.add('^WHO', 'who', 'a'); m.add('^US', 'us', 'b'); m.add('El Nino', 'nino', 'c'); m.add('tiger reserve', 'reserve', 'd')
    const found = (text: string) => m.scan(tokenize(text)).map(h => h.value)
    expect(found('Who told us about it')).toEqual([])
    expect(found('WHO and the US agree')).toEqual(['who', 'us'])
    expect(found('El Niño returns; two tiger reserves notified')).toEqual(['nino', 'reserve'])
    expect(tokenize('U.S.-India 2+2').map(t => t.low)).toEqual(['u', 's', 'india', '2', '2'])
  })
  it('ships only derived counts, with support for every signal', () => {
    expect(index.version).toBe(2)
    expect(index.provenance).toMatchObject({ prelimsQuestions: 3896, uppcsQuestions: 1196, mainsQuestions: 1130 })
    expect(index.signals.length).toBeGreaterThan(150)
    expect(new Set(index.signals.map(s => s.concept)).size).toBe(index.signals.length)
    expect(index.signals.every(s => (s.prelimsDemand || s.mainsDemand) && s.aliasCounts!.length === s.aliases.length && [1, 2, 3].includes(s.tier!))).toBe(true)
    expect(index.context ?? []).toEqual([])
    expect(JSON.stringify(index)).not.toContain('question_text')
  })
  it('stays fast enough to classify a full registry snapshot on the main thread', () => {
    const batch = Array.from({ length: 40 }, () => cases).flat()
    const started = performance.now()
    for (const c of batch) classify(c, index)
    expect(batch.length).toBeGreaterThan(10000)
    expect(performance.now() - started).toBeLessThan(5000)
  })
})

describe('substantive-value gate', () => {
  interface Flagged extends Pick<NewsItem, 'title' | 'description' | 'publisher' | 'section' | 'sourceId'> { pattern: string }
  const flagged: Flagged[] = JSON.parse(readFileSync(new URL('./fixtures/substance-cases.json', import.meta.url), 'utf8')).cases
  it('holds all eleven articles flagged in the live feed', () => {
    expect(flagged.length).toBe(11)
  })
  it.each(flagged)('rejects [$pattern] $title', c => {
    const r = classify(c, index)
    expect(r.accepted, JSON.stringify(r.substance)).toBe(false)
    expect(r.substance!.score < SUBSTANCE_THRESHOLD || r.substance!.lowValue.includes('party statement')).toBe(true)
    expect(r.rejectionReason).toBeTruthy()
  })
  it('rejects for want of substance, not by moving the score: most flagged articles still clear the evidence threshold', () => {
    const cleared = flagged.map(c => classify(c, index)).filter(r => r.score >= ACCEPT_THRESHOLD)
    expect(cleared.length).toBeGreaterThanOrEqual(9)
    for (const r of cleared) expect(r.rejectionReason).toMatch(/^No substantive development/)
  })
  it('a syllabus entity alone is not enough; the same entity with a development is', () => {
    expect(verdict('Election Commission chief addresses officers in Lucknow').accepted).toBe(false)
    expect(verdict('Election Commission notifies new rules for postal ballots').accepted).toBe(true)
    expect(verdict('SEBI chief speaks at investor event in Mumbai').accepted).toBe(false)
    expect(verdict('SEBI bans finfluencer from securities market, orders refund under new norms').accepted).toBe(true)
  })
  it('a party’s statement about a real development is rejected while the development itself is kept', () => {
    const ruling = verdict('Supreme Court strikes down electoral bonds scheme as unconstitutional')
    expect(ruling.accepted).toBe(true)
    for (const title of ['Supreme Court verdict on electoral bonds scheme a slap on government: Congress', 'Electoral bonds verdict vindicates our stand, says BJP', 'Congress after Supreme Court strikes down electoral bonds scheme: ‘Victory for democracy’']) {
      const r = verdict(title)
      expect(r.accepted, title).toBe(false)
      expect(r.substance!.lowValue, title).toContain('party statement')
    }
  })
  it('one low-value pattern cancels one development; two developments outweigh it', () => {
    const recall = verdict('Food regulator orders company to recall spice batch after tests')
    expect(recall.substance!.lowValue).toContain('product recall')
    expect(recall.accepted).toBe(false)
    const reform = verdict('After spice recall, FSSAI notifies new pesticide residue norms, mandates batch testing')
    expect(reform.substance!.lowValue).toContain('product recall')
    expect(reform.substance!.signals).toEqual(expect.arrayContaining(['law or rule', 'regulatory action']))
    expect(reform.accepted).toBe(true)
  })
  it('explainers and editorials carry their own substance, unless they are about a company’s affairs', () => {
    expect(verdict('Appointing the Election Commission: An Expert Explains what Constituent Assembly said', { section: 'Explained', sourceId: 'ie-explained' }).accepted).toBe(true)
    expect(verdict('Must Tata Sons go public? India’s central bank has several other options', { section: 'Opinion', sourceId: 'mint-opinion', publisher: 'Mint', description: 'It’s unclear if the Reserve Bank of India (RBI) can actually force corporate entities such as Tata Sons to list their shares.' }).accepted).toBe(false)
  })
  it('an operational notice stays one however its cause and size are described', () => {
    // Still listed on the live site after the first version of the gate: the feed's full summaries name El Niño, percentages and directions.
    const summaries: Record<string, string> = { 'bs-india': flagged.find(c => c.title.startsWith('Minimum 10% water cut'))!.description, 'ht-india': 'Industries must reuse or recycle at least 30% of water, while irrigation will be allowed only after meeting drinking water, livestock and fodder needs.' }
    for (const [title, sourceId, publisher] of [['Minimum 10% water cut in Maharashtra urban, rural local bodies from Oct 16', 'bs-india', 'Business Standard'], ['Maharashtra govt orders 10% water cut from October 16 across state amid El Niño concerns', 'ht-india', 'Hindustan Times']]) {
      const r = verdict(title, { description: summaries[sourceId], sourceId, publisher })
      expect(r.substance!.lowValue, title).toContain('local operational notice')
      expect(r.accepted, title + ' ' + JSON.stringify(r.substance)).toBe(false)
    }
    expect(verdict('Maharashtra notifies drought policy: water rationing rules, crop relief package for 14 districts amid El Niño').accepted).toBe(true)
  })
  it('leaves the score, and so the ranking, exactly as it was', () => {
    for (const c of flagged) { const r = classify(c, index); expect(r.score).toBe(Math.max(0, Math.round(r.evidence!.reduce((n, e) => n + e.points, 0) * 10) / 10)) }
  })
})
