import type { ArticleEvidence, EligibilityDecision } from './contracts.ts'
/** C1 never reads relevance dimensions, author identity, publisher preference or subject. */
export function assessEligibility(e: ArticleEvidence): EligibilityDecision {
  if (e.exclusions.length) return { status: 'reject', scope: e.exclusions.some(x => x.code.includes('foreign_domestic')) ? 'foreign_domestic_no_impact' : 'unknown', reasonCodes: [...new Set(e.exclusions.map(x => x.code))].sort(), evidence: e.exclusions.flatMap(x => x.evidence) }
  const route = e.routes.find(r => r.scope !== 'unknown')
  if (route) return { status: 'eligible', scope: route.scope, reasonCodes: ['C1.substantive_scope.v1'], evidence: e.routes.flatMap(r => r.evidence) }
  // Transferable lending/economic/institutional mechanisms without jurisdiction cannot be invented as Indian news.
  return { status: 'insufficient_metadata', scope: 'unknown', reasonCodes: ['C1.insufficient_metadata.v1'], evidence: e.routes.flatMap(r => r.evidence) }
}
