/** Precision-first demand rules. Place occurrence alone never admits a question; each classification has reproducible evidence. */
import { textLocations } from '../../../src/atlas/pyq/quality.mjs'

const physical = /\b(?:rivers?|lakes?|seas?|oceans?|straits?|channels?|islands?|coasts?|mountains?|peaks?|ranges?|plateaus?|deserts?|glaciers?|passes|pass|watersheds?|tributar(?:y|ies)|confluence|dams?|ports?|national parks?|wildlife sanctuar(?:y|ies)|tiger reserves?|biosphere reserves?|Ramsar|wetlands?|heritage sites?)\b/i
const spatial = /\b(?:located|situated|location|where|lies|lie|flow(?:s|ing)?|drain(?:s|age)?|tributar(?:y|ies)|confluence|source|mouth|border(?:s|ing)?|neighbou?ring|adjacent|adjoining|north(?:ern)?|south(?:ern)?|east(?:ern)?|west(?:ern)?|downstream|upstream|landlocked|coastal|latitude|longitude|tropic|equator|meridian|map|capital(?:s)?|connects?|separates?)\b/i
const contextual = /\b(?:Act|bill|constitution|article \d|amendment|parliament|legislature|election|president|prime minister|governor|political part(?:y|ies)|wrote|author|poet|philosopher|biograph|born|birth|died|death|mission|organisation|organization|conference|summit|treaty|agreement|declaration|headquarters|headquarter|currency|GDP|inflation|monetary|banking|tax|rocket|missile|satellite|company|companies|corporation|battle|war|dynasty|emperor|king|ruler|rebellion|inscription|sculpture|festival|dance|language|religion|religious|scripture|civilization|civilisation|mineral|crop|cultivat|agricultur|production|energy|power plant|atomic|nuclear|disease|enzyme|protein|invention|technology|chemical|carbon|greenhouse)\w*/i
const explicitSpatial = /\b(?:which|where|match|arrange|order|sequence|identify|consider)\b[\s\S]*\b(?:located|situated|location|river|lake|sea|ocean|strait|island|coast|mountain|peak|range|plateau|desert|glacier|pass|tributary|capital|border|neighbou?r|latitude|longitude|equator|tropic|north|south|east|west)\w*/i
const locationDemand = /\b(?:where (?:is|are)|(?:located|situated|lies|lie)\b[\s\S]{0,90}(?:which|state|country|river|region)|which\b[\s\S]{0,120}(?:state|country|river|region)\b[\s\S]{0,90}(?:located|situated)|match[\s\S]*\b(?:state|country|river|location)|from\b[\s\S]*\b(?:north|south|east|west|source)[\s\S]*\b(?:north|south|east|west|mouth))\b/i
const nonSpatialObjective = /\b(?:literacy|population density|population of|member(?:s|ship)?|ASEAN|NATO|council|symposium|regional cooperation|armed forces|training academy|naval|components?|abacus|shaft|econom(?:y|ic)|physical capital|genetic|animal ['‘]?X|animal X|factors? (?:is|are) responsible|annual range of temperature|Ocean Mean Temperature|Ocean Dipole|El Nino)\b/i
const relationship = /\b(?:located|situated|location|lies|lie|flow(?:s|ing)?|drain(?:s|age)?|tributar(?:y|ies)|confluence|source|mouth|originat(?:e|es)|rise|rises|border(?:s|ing)?|boundary|neighbou?ring|adjacent|adjoining|landlocked|connects?|separat(?:e|es|ed)|longitude|latitude|equator|tropic|meridian|closest|nearest|northward|southward|eastward|westward)\b/i

export function classifyRelevance(question, mentions, index) {
  const body = textLocations(question).filter((x) => x.location !== 'option').map((x) => x.text).join('\n')
  const stem = textLocations(question).filter((x) => x.location === 'stem').map((x) => x.text).join('\n')
  const resolved = mentions.filter((m) => m.placeId)
  const inBody = resolved.filter((m) => m.locationInQuestion !== 'option')
  const geographic = physical.test(body), hasSpatial = spatial.test(body)
  if (!resolved.length) return { classification: mentions.length ? 'incidental' : 'none', reasons: ['relevance:no-resolved-gazetteer-place'], evidence: [] }
  if (nonSpatialObjective.test(body) || (/\b(?:headquarters?|organisation|organization|conference|summit|Act|bill|constitution)\b/i.test(body)) || (contextual.test(body) && !locationDemand.test(body))) return { classification: 'incidental', reasons: ['relevance:non-geographic-demand'], evidence: [(body.match(nonSpatialObjective) ?? body.match(contextual) ?? ['institutional-demand'])[0]] }
  const spatialDemand = relationship.test(body) || /\b(?:capital|capitals)\b/i.test(stem) || /\b(?:from|to|towards|order|sequence)\b[\s\S]*\b(?:north|south|east|west)\b/i.test(body)
  if (question.type === 'assertion-reason' && geographic && relationship.test(body) && inBody.length) return { classification: 'direct-spatial', reasons: [], evidence: ['assertion-reason-spatial-relationship'] }
  if (spatialDemand && explicitSpatial.test(body) && (geographic || /\b(?:country|countries|state|states|capital|city|cities)\b/i.test(stem)) && (inBody.length || resolved.some((m) => m.locationInQuestion === 'option'))) return { classification: 'direct-spatial', reasons: [], evidence: [(body.match(relationship) ?? ['spatial-order-or-capital'])[0], 'explicit-spatial-demand'] }
  const focus = inBody.filter((m) => m.locationInQuestion === 'stem' && !['city', 'capital', 'facility'].includes(index.byId.get(m.placeId)?.kind))
  if (focus.length && geographic && /\b(?:which|consider|with reference|what|how|regarding)\b/i.test(stem)) return { classification: 'place-centric', reasons: [], evidence: ['named-geographic-feature-in-stem'] }
  if (question.type === 'table' && inBody.length >= 2 && geographic && question.content.some((b) => b.type === 'table' && b.columns.some((c) => /\b(?:region|location|state|country)\b/i.test(c)))) return { classification: 'spatial-association', reasons: [], evidence: ['table-geographic-feature-region-association'] }
  if (inBody.length >= 2 && geographic && hasSpatial && ['matching', 'pairs', 'sequence'].includes(question.type)) return { classification: 'spatial-association', reasons: [], evidence: ['structured-spatial-relationship'] }
  return { classification: 'incidental', reasons: ['relevance:place-mention-only'], evidence: [] }
}

export function assignRoles(mentions, relevance, answer, included) {
  const accepted = new Set(answer.correct_options)
  const substantive = ['direct-spatial', 'place-centric', 'spatial-association'].includes(relevance.classification)
  return mentions.map((m) => {
    const role = !substantive ? 'incidental' : m.locationInQuestion === 'option' ? accepted.has(m.optionKey) ? 'supporting' : 'distractor' : m.locationInQuestion === 'stem' ? 'primary' : ['table', 'pair', 'sequence'].includes(m.locationInQuestion) ? 'comparison' : 'supporting'
    // Statement/pair truth and matching-row adjacency are not inferred from an answer code.
    const masteryEligible = Boolean(included && m.placeId && role === 'primary')
    return { ...m, semanticRole: role, relevance: relevance.classification, masteryEligible, quizIncluded: included }
  })
}
