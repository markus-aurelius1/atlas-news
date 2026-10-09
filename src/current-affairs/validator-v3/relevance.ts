import type { ArticleEvidence, EligibilityDecision, RelevanceDecision } from './contracts.ts'
/** C2 exposes substance and confidence independently from missing-field coverage. */
export function assessRelevance(e: ArticleEvidence, eligibility: EligibilityDecision): RelevanceDecision {
  const supported = e.routes.length > 0, exceptional = e.routes.some(r => r.exceptional)
  const dimensions: RelevanceDecision['dimensions'] = { topicalConnection: supported ? 2 : 0, substantiveSupport: supported ? 2 : 0, consequence: exceptional ? 1 : 0,
    sourcePrior: supported && e.context.some(x => x.rule === 'C2.source_context.v1') ? 1 : 0, authorPrior: supported && e.verifiedAuthors.length ? 1 : 0 }
  const status = eligibility.status === 'reject' ? 'below_floor' : eligibility.status === 'insufficient_metadata' ? 'insufficient_metadata' : exceptional ? 'must_read_candidate' : 'useful'
  return { status, confidence: status === 'insufficient_metadata' ? 'unresolved' : e.coverage.level === 'sufficient' ? 'high' : 'moderate', dimensions,
    reasonCodes: status === 'below_floor' ? ['C2.hard_gate_precedence.v1'] : status === 'insufficient_metadata' ? ['C2.unresolved_substance.v1'] : [...new Set(e.routes.map(r => r.id))].sort(),
    evidence: [...e.routes.flatMap(r => r.evidence), ...e.context] }
}
