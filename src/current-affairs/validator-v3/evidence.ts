import type { ArticleEvidence, Evidence, Route, StageCObservation, Scope } from './contracts.ts'
import { ROUTE_RULES, NOISE_RULES, PARTY_ACTORS, PARTY_PURPOSE, FOREIGN_DOMESTIC, DOMESTIC_PURPOSE } from './policy.ts'
import { curatedAuthorEvidence } from './author-registry.ts'
import { boundSource } from './metadata.ts'

const rx = (pattern: string) => new RegExp(pattern, 'i')
function span(o: StageCObservation, field: 'title' | 'description', pattern: string, rule: string, flags = 'i'): Evidence[] {
  const text = o.metadata[field]
  return [...text.matchAll(new RegExp(pattern, flags + 'g'))].map(match => ({ rule, observationId: o.id, field, path: field, start: match.index, end: match.index + match[0].length, text: match[0] }))
}
function textual(o: StageCObservation, pattern: string, rule: string) {
  return [...span(o, 'title', pattern, rule), ...(meaningful(o.metadata.description) ? span(o, 'description', pattern, rule) : [])]
}
const meaningful = (s: string) => s.trim().split(/\s+/).filter(Boolean).length >= 5 && !/^(read more|continue reading|click here|latest news|protests and education)[.!\s]*$/i.test(s.trim())
const india = String.raw`\b(India(?:n)?|MeitY|IndiaAI|CJI|Centre[’']s|fiscal federalism|RBI|Reserve Bank of India)\b`
export function extractEvidence(observations: StageCObservation[]): ArticleEvidence {
  const rows = [...observations].sort((a, b) => a.id.localeCompare(b.id, 'en'))
  const routes: Route[] = [], exclusions: ArticleEvidence['exclusions'] = [], context: Evidence[] = [], authors: string[] = []
  for (const o of rows) {
    const m = o.metadata
    // Source/type context is usable only when publisher, URL, feed and section bind to Job B's registry.
    for (const [i, membership] of m.memberships.entries()) {
      if (!boundSource(m.url, m.publisher, membership)) continue
      if (/editorial|opinion|column|analysis|explained|science|upsc/i.test(membership.section)) context.push({ rule: 'C2.source_context.v1', observationId: o.id, field: 'memberships', path: `memberships.${i}.section`, start: 0, end: membership.section.length, text: membership.section })
      const item = { ...m, sourceId: membership.sourceId, section: membership.section, bylines: m.bylines.map(b => ({ ...b, sourceId: membership.sourceId })) }
      for (const author of membership.sourceId === o.sourceId ? curatedAuthorEvidence(item) : []) {
        authors.push(author.authorId)
        for (const [j, b] of m.bylines.entries()) if (author.bylines.some(v => v.name === b.name && v.provenance === b.provenance)) context.push({ rule: 'C2.verified_author.v1', observationId: o.id, field: 'bylines', path: `bylines.${j}.name`, start: 0, end: b.name.length, text: b.name })
      }
    }
    for (const rule of ROUTE_RULES) {
      const topic = textual(o, rule.topic, rule.id), support = textual(o, rule.support, rule.id)
      const independentSupport = support.filter(s => !topic.some(t => s.field === t.field && s.start < t.end && t.start < s.end))
      if (!topic.length || !independentSupport.length) continue
      // A topic token cannot count again as its own substantive proposition. No URL/category/byline topics.
      const scope: Scope = rx(india).test(m.title + ' ' + m.description) ? 'india_domestic' : rule.scope === 'knowledge' ? 'global_knowledge' : rule.scope === 'systemic' ? 'global_systemic' : 'unknown'
      // Generic summary risk language in prospective policy coverage supplies
      // usefulness, not maximum importance. A headline explanation or an
      // explicit transmission mechanism can still confer the existing tier.
      const exceptional = !!rule.exceptional && (rule.id !== 'C2.public-finance.v1' || independentSupport.some(s => s.field === 'title' || /transmission/i.test(s.text)))
      routes.push({ id: rule.id, scope, evidence: [topic[0], independentSupport[0]], exceptional })
    }
    const primaryAction = span(o, 'title', String.raw`\b(?:Supreme Court|court|regulator|parliament|government|India and Japan)\b.{0,45}\b(?:rules?|invalidates?|enacts?|orders?|adopts?|signs?)\b.{0,60}\b(?:law|policy|regulation|rights|treaty|agreement|electoral rule)\b`, 'C1.dominant_institutional_action.v1')
    for (const rule of NOISE_RULES) {
      const evidence = span(o, 'title', rule.pattern, rule.code)
      if (evidence.length && !(primaryAction.length && primaryAction[0].start < evidence[0].start)) exclusions.push({ code: rule.code, evidence })
    }
    if (primaryAction.length) for (const route of routes.filter(r => r.evidence.some(e => e.observationId === o.id))) route.evidence.push(...primaryAction)
    const party = span(o, 'title', PARTY_ACTORS, 'C1.party_primary.v1'), purpose = span(o, 'title', PARTY_PURPOSE, 'C1.party_primary.v1')
    // A substantive cross-border war analysis can discuss elections; a party reaction cannot borrow summary policy terms.
    if (party.length && purpose.length && !(primaryAction.length && primaryAction[0].start < purpose[0].start)) exclusions.push({ code: 'C1.party_primary.v1', evidence: [...party, ...purpose] })
    const foreign = [...textual(o, FOREIGN_DOMESTIC, 'C1.foreign_domestic_no_impact.v1'), ...span(o, 'title', String.raw`\bUS\b`, 'C1.foreign_domestic_no_impact.v1', ''), ...span(o, 'description', String.raw`\bUS\b`, 'C1.foreign_domestic_no_impact.v1', '')]
    const domestic = textual(o, DOMESTIC_PURPOSE, 'C1.foreign_domestic_no_impact.v1')
    const indianInstitution = span(o, 'title', String.raw`\bIndia(?:n)?\b.{0,35}\b(?:Supreme Court|parliament|government|regulator|constitutional court)\b`, 'C1.indian_institutional_jurisdiction.v1')
    const domesticHeadline = span(o, 'title', DOMESTIC_PURPOSE, 'C1.foreign_domestic_no_impact.v1')
    const explicitImpact = textual(o, String.raw`\bIndia(?:n)?\b.{0,70}\b(?:trade|energy exposure|imports?|exports?|diaspora|supply chain|security|treaty obligations)\b|\b(?:trade|energy exposure|imports?|exports?|diaspora|supply chain|security)\b.{0,70}\bIndia(?:n)?\b`, 'C1.india_impact.v1')
    // A foreign domestic legislative story cannot bypass scope with generic energy/environment terms.
    if (foreign.length && domestic.length && !indianInstitution.length && !explicitImpact.length && (domesticHeadline.length > 0 || !routes.some(r => r.scope === 'global_systemic' || r.scope === 'global_knowledge'))) exclusions.push({ code: 'C1.foreign_domestic_no_impact.v1', evidence: [...foreign, ...domestic] })
    if (indianInstitution.length) for (const route of routes.filter(r => r.evidence.some(e => e.observationId === o.id))) { route.scope = 'india_domestic'; route.evidence.push(...indianInstitution) }
    if (explicitImpact.length) for (const route of routes.filter(r => r.evidence.some(e => e.observationId === o.id))) { route.scope = 'india_impact'; route.evidence.push(...explicitImpact) }
  }
  const descriptions = rows.map(o => o.metadata.description), hasDescription = descriptions.some(meaningful)
  const supported = routes.some(r => r.scope !== 'unknown') || exclusions.length > 0
  return { url: rows[0].metadata.url, observations: rows.map(o => o.id), routes, exclusions, context,
    verifiedAuthors: [...new Set(authors)].sort(), coverage: { level: supported ? hasDescription ? 'sufficient' : 'limited' : 'insufficient',
      description: hasDescription ? 'present' : descriptions.some(s => s.trim()) ? 'placeholder' : 'missing',
      missingFields: [...(!hasDescription ? ['description'] : []), ...(!rows.some(o => o.metadata.bylines.length) ? ['bylines'] : []), ...(!supported ? ['development', 'scope', 'angle'] : [])] } }
}
