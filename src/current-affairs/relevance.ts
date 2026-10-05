/**
 * Deterministic UPSC/UPPCS relevance: weighted evidence from the headline, the feed summary, past-paper recurrence,
 * framing, setting and the feed an item arrived in, weighed against noise. No single observation decides; an item
 * qualifies when the evidence accumulates past one threshold, and every verdict lists what was weighed.
 */
import { ABROAD, FRAMING, INDIA, NOISE, UNITED_STATES, US_DOMESTIC, sourcePrior, type NoiseCategory } from './evidence-lexicon.ts'
import { PhraseMatcher, parseTerm, tokenize, type Token } from './match.ts'
import { NEWS_SOURCES } from './sources.ts'
import type { NewsItem, Relevance, RelevanceEvidence, RelevanceIndex, RelevanceSignal } from './types'

export const normalize = (s: string) => s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
/** Evidence needed to enter the reading list. */
export const ACCEPT_THRESHOLD = 6.5
/** A named institution, law or place can carry an article; a theme needs support; a broad word only supports. */
const TIER_POINTS = { 1: 2, 2: 3.5, 3: 5 } as const
/** The summary is weaker evidence than the headline; under an opaque headline it carries the article and counts for more. */
const DESCRIPTION_WEIGHT = 0.5, DESCRIPTION_WEIGHT_OPAQUE_TITLE = 0.75
/** Editorial vocabulary without past-paper support counts for less and never earns a recurrence bonus. */
const UNBACKED_WEIGHT = 0.7
/** An Indian institution's name in a story set abroad (another country's Supreme Court, say) is weak evidence. */
const ABROAD_WEIGHT = 0.3
/** Each further concept adds less, so a long summary cannot out-score a focused headline by volume. */
const DIMINISHING = [1, 0.6, 0.4, 0.25, 0.15]
const CONCEPT_CAP = 11, FRAMING_TITLE = 1, FRAMING_DESCRIPTION = 0.5, FRAMING_CAP = 1.5
/** Recurrence in past papers strengthens a concept; a broad word (tier 1) earns a third of it. */
const recurrenceBonus = (count: number, tier: number) => Math.min(1.5, 0.75 * Math.log10(1 + count)) * (tier === 1 ? 1 / 3 : 1)
const round = (n: number) => Math.round(n * 10) / 10

interface ConceptTerm { signal: RelevanceSignal; backed: boolean; recurrence: number; spelling: string }
const compiled = new WeakMap<RelevanceIndex, PhraseMatcher<ConceptTerm>>()
function conceptMatcher(index: RelevanceIndex) {
  let matcher = compiled.get(index)
  if (!matcher) {
    matcher = new PhraseMatcher<ConceptTerm>()
    const add = (signal: RelevanceSignal, backed: boolean) => signal.aliases.forEach((alias, i) => matcher!.add(alias, { signal, backed, recurrence: backed ? signal.aliasCounts?.[i] ?? signal.prelimsCount + signal.mainsCount : 0, spelling: parseTerm(alias).text }, signal.concept))
    for (const signal of index.signals) add(signal, true)
    for (const signal of index.context ?? []) add(signal, false)
    compiled.set(index, matcher)
  }
  return matcher
}
const phrases = <T>(groups: { terms: string[]; value: T }[]) => { const m = new PhraseMatcher<T>(); groups.forEach((g, i) => g.terms.forEach(t => m.add(t, g.value, String(i)))); return m }
const framing = phrases(FRAMING.map(f => ({ terms: f.terms, value: f })))
const india = phrases([{ terms: INDIA, value: true }]), abroad = phrases([{ terms: ABROAD, value: true }])
const noise = phrases(NOISE.map(n => ({ terms: n.terms, value: n })))
const unitedStates = phrases([{ terms: UNITED_STATES, value: true }]), usDomestic = phrases([{ terms: US_DOMESTIC, value: true }])
/** Concepts that give a foreign story an international dimension of its own. */
const INTERNATIONAL_SUBJECTS = new Set(['International relations', 'Security']), INTERNATIONAL_CONCEPTS = new Set(['Global economy', 'Trade policy', 'WTO', 'IMF and World Bank', 'Maritime chokepoints and seas'])
const SCIENCE_SUBJECTS = new Set(['Sci-Tech', 'Environment', 'Geography'])
const PIB_SOURCE = 'substack-people-policies-progress-pib-india'
const PRESS_RELEASE = /^[^.]{0,40}\[India\],|\/PRNewswire\/|Business ?Wire India/
const sourceKind = new Map(NEWS_SOURCES.map(s => [s.id, s.kind]))

interface ConceptHit { term: ConceptTerm; title: boolean; points: number }
export function classify(item: Pick<NewsItem, 'title' | 'description' | 'publisher' | 'section'> & Partial<Pick<NewsItem, 'sourceId'>>, index: RelevanceIndex): Relevance {
  const title = tokenize(item.title), description = tokenize(item.description), matcher = conceptMatcher(index)
  const evidence: RelevanceEvidence[] = []
  const add = (kind: RelevanceEvidence['kind'], label: string, points: number, where?: RelevanceEvidence['where']) => { if (points) evidence.push({ kind, label, points: round(points), ...(where ? { where } : {}) }) }

  // Noise is judged on the headline alone: a teaser that mentions a court or regulator cannot rescue it, and vice versa.
  const noiseHits = new Map<NoiseCategory, string>()
  for (const hit of noise.scan(title)) if (!noiseHits.has(hit.value)) noiseHits.set(hit.value, title.slice(hit.start, hit.start + hit.length).map(t => t.raw).join(' '))
  const hard = [...noiseHits].find(([category]) => category.hard) ?? (PRESS_RELEASE.test(item.description) ? [NOISE.find(n => n.id === 'press-release')!, 'press-release dateline'] as const : undefined)

  // The strongest spelling of each concept, wherever it appears; a headline match outranks a summary match.
  const best = new Map<RelevanceSignal, { term: ConceptTerm; title: boolean }>()
  const collect = (tokens: Token[], inTitle: boolean) => { for (const { value } of matcher.scan(tokens)) { const seen = best.get(value.signal); if (!seen || inTitle && !seen.title || inTitle === seen.title && value.recurrence > seen.term.recurrence) best.set(value.signal, { term: value, title: inTitle || !!seen?.title }) } }
  collect(description, false); collect(title, true)

  // Setting: explicit India anchoring, or a story set abroad with none.
  const indiaTitle = india.scan(title).length > 0 || [...best].some(([s, hit]) => hit.title && (s.topic === 'Uttar Pradesh' || s.tier === 3 && s.scope === 'india'))
  const indiaDescription = india.scan(description).length > 0
  const kind = item.sourceId ? sourceKind.get(item.sourceId) : undefined
  const setAbroad = !indiaTitle && !indiaDescription && (kind === 'international' || /world|international|europe|asia|middle east|ukraine/i.test(item.section) || abroad.scan(title).length > 0)

  const opaqueTitle = ![...best.values()].some(hit => hit.title)
  const hits: ConceptHit[] = [...best].map(([signal, { term, title: inTitle }]) => {
    const where = inTitle ? 1 : opaqueTitle ? DESCRIPTION_WEIGHT_OPAQUE_TITLE : DESCRIPTION_WEIGHT, setting = setAbroad && signal.scope !== 'global' ? ABROAD_WEIGHT : 1
    const base = TIER_POINTS[signal.tier ?? 2] * (term.backed ? 1 : UNBACKED_WEIGHT) + (term.backed ? Math.max(recurrenceBonus(term.recurrence, signal.tier ?? 2), 0.5 * recurrenceBonus(signal.prelimsCount + signal.mainsCount + (signal.uppcsCount ?? 0), signal.tier ?? 2)) + (signal.taxonomyIds.length && (signal.tier ?? 2) >= 2 ? 0.5 : 0) : 0)
    return { term, title: inTitle, points: base * where * setting }
  }).sort((a, b) => b.points - a.points || a.term.signal.concept.localeCompare(b.term.signal.concept))
  let conceptPoints = 0
  hits.forEach((hit, i) => {
    const points = Math.min(hit.points * (DIMINISHING[i] ?? 0.1), CONCEPT_CAP - conceptPoints)
    conceptPoints += points
    const s = hit.term.signal, counts = hit.term.backed ? `CSE P${s.prelimsCount}/M${s.mainsCount}${s.uppcsCount ? ` · UPPCS ${s.uppcsCount}` : ''}; “${hit.term.spelling}” in ${hit.term.recurrence} past questions` : 'editorial context, no past-paper match'
    add('concept', `${s.concept} (${counts})${setAbroad && s.scope !== 'global' ? ' – discounted: story set abroad' : ''}`, points, hit.title ? 'title' : 'description')
  })

  let framingPoints = 0
  const inTitle = new Set(framing.scan(title).map(h => h.value)), inDescription = new Set(framing.scan(description).map(h => h.value))
  for (const category of FRAMING) {
    const points = Math.min(inTitle.has(category) ? FRAMING_TITLE : inDescription.has(category) ? FRAMING_DESCRIPTION : 0, FRAMING_CAP - framingPoints)
    framingPoints += points
    add('framing', category.label, points, inTitle.has(category) ? 'title' : 'description')
  }
  if (indiaTitle) add('india', 'India named in the headline', 1, 'title')
  else if (indiaDescription) add('india', 'India named in the summary', 0.5, 'description')
  const state = [...best].find(([s]) => s.topic === 'Uttar Pradesh')
  if (state) add('state', 'Uttar Pradesh focus (UPPCS)', state[1].title ? 1.5 : 0.75, state[1].title ? 'title' : 'description')
  const prior = sourcePrior(item.sourceId, item.section)
  if (prior) add('source', prior.label, prior.points, 'feed')
  // An Indian paper's editorial or explainer on a world event is already an editorial judgment of significance.
  if (setAbroad && !(kind !== 'international' && /editorial|opinion|explained|upsc/i.test(item.section)) && !hits.some(h => h.term.signal.scope === 'global' && (h.term.signal.tier ?? 2) >= 2)) add('foreign', 'Set abroad with no India link or global syllabus concept', -2.5)
  // United States: kept for India, international relations, the global economy, security or science; dropped when domestic.
  const inAmerica = unitedStates.scan(title).length > 0 || item.publisher === 'New York Times' || hits.some(h => h.title && h.term.signal.concept === 'United States')
  if (inAmerica && !indiaTitle && !indiaDescription) {
    const international = hits.some(h => h.title && h.term.signal.concept !== 'United States' && (INTERNATIONAL_SUBJECTS.has(h.term.signal.subject) || INTERNATIONAL_CONCEPTS.has(h.term.signal.concept)))
    const science = !!hits[0] && hits[0].title && SCIENCE_SUBJECTS.has(hits[0].term.signal.subject) && usDomestic.scan(title).length === 0
    if (!international && !science) add('foreign', 'US domestic story with no India or international dimension', -4, 'title')
  }
  // PIB explainers are primary material on schemes, policies and institutions, but only when a syllabus concept leads them.
  if (item.sourceId === PIB_SOURCE && hits.some(h => h.title && (h.term.signal.tier ?? 2) >= 2)) add('source', 'PIB explainer led by a syllabus concept', 1.5, 'feed')
  for (const [category, phrase] of noiseHits) if (!category.hard) add('noise', `${category.label} (“${phrase}”)`, category.points, 'title')

  const total = round(evidence.reduce((n, e) => n + e.points, 0)), score = hard ? 0 : Math.max(0, total)
  const accepted = !hard && conceptPoints > 0 && total >= ACCEPT_THRESHOLD
  // Anchors name what the article is about: specific concepts first, broad ones only when nothing else matched.
  const meaningful = hits.filter(h => h.points >= 0.8), ordered = (meaningful.length ? meaningful : hits).slice().sort((a, b) => Number((b.term.signal.tier ?? 2) >= 2) - Number((a.term.signal.tier ?? 2) >= 2) || Number(b.title) - Number(a.title) || b.points - a.points)
  const unique = (values: string[]) => [...new Set(values)]
  const backed = hits.filter(h => h.term.backed), prelims = backed.some(h => h.term.signal.prelimsDemand), mains = backed.some(h => h.term.signal.mainsDemand)
  const negative = evidence.filter(e => e.points < 0).sort((a, b) => a.points - b.points)[0]
  return {
    accepted, score, threshold: ACCEPT_THRESHOLD,
    exam: prelims && mains ? 'both' : mains ? 'mains' : prelims ? 'prelims' : 'general',
    subjects: unique(ordered.map(h => h.term.signal.subject)).slice(0, 2),
    topics: unique(ordered.map(h => h.term.signal.topic)).slice(0, 3),
    staticAnchors: unique(ordered.map(h => h.term.signal.concept)).slice(0, 3),
    signals: ordered.slice(0, 6).map(h => { const s = h.term.signal; return h.term.backed ? `${s.concept} · CSE P${s.prelimsCount}/M${s.mainsCount}${s.uppcsCount ? ` · UPPCS ${s.uppcsCount}` : ''}${h.title ? '' : ' · summary only'}` : `${s.concept} · editorial context` }),
    evidence: hard ? [{ kind: 'noise', label: `${hard[0].label} (“${hard[1]}”)`, points: 0, where: 'title' }, ...evidence] : evidence,
    ...(!accepted ? { rejectionReason: hard ? `Noise headline: ${hard[0].label.toLowerCase()}` : !hits.length ? 'No syllabus concept in headline or summary' : `Evidence ${total} below threshold ${ACCEPT_THRESHOLD}${negative ? `; ${negative.label.replace(/ \(.*$/, '').toLowerCase()}` : ''}` } : {}),
  }
}
