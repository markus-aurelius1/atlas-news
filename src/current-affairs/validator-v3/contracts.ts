/** Stage C metadata-only contract. No subject, story, novelty or rank features. */
export interface StageCMetadata {
  url: string; title: string; description: string; publisher: string
  memberships: { sourceId: string; feedUrl: string; section: string }[]
  categories: string[]; bylines: { name: string; provenance: 'rss:dc:creator' | 'rss:author' | 'atom:author' }[]
  publishedAt: string | null; updatedAt: string | null
}
export interface StageCObservation {
  id: string; captureId: string; sourceId: string; ordinal: number; capturedAt: string
  parserVersion: string; registryHash: string; metadataHash: string; metadata: StageCMetadata
}
export interface StageCVersions { policyId: string; policyHash: string; indexHash: string; registryHash: string; authorHash: string; codeHash: string }
export interface StageCInput { observations: StageCObservation[]; clock: string; versions: StageCVersions }
export interface Evidence {
  rule: string; observationId: string; field: 'title' | 'description' | 'memberships' | 'bylines'
  path: string; start: number; end: number; text: string
}
export type Scope = 'india_domestic' | 'india_impact' | 'global_knowledge' | 'global_systemic' | 'foreign_domestic_no_impact' | 'unknown'
export interface Route { id: string; scope: Scope; evidence: Evidence[]; exceptional: boolean }
export interface ArticleEvidence {
  url: string; observations: string[]; routes: Route[]; exclusions: { code: string; evidence: Evidence[] }[]
  context: Evidence[]; verifiedAuthors: string[]
  coverage: { level: 'sufficient' | 'limited' | 'insufficient'; missingFields: string[]; description: 'missing' | 'placeholder' | 'present' }
}
export interface EligibilityDecision { status: 'eligible' | 'reject' | 'insufficient_metadata'; scope: Scope; reasonCodes: string[]; evidence: Evidence[] }
export interface RelevanceDecision {
  status: 'must_read_candidate' | 'useful' | 'below_floor' | 'insufficient_metadata'
  confidence: 'high' | 'moderate' | 'unresolved'; reasonCodes: string[]; evidence: Evidence[]
  dimensions: { topicalConnection: 0 | 2; substantiveSupport: 0 | 2; consequence: 0 | 1; sourcePrior: 0 | 1; authorPrior: 0 | 1 }
}
export interface StageCDecision {
  url: string; accepted: boolean; decision: 'accepted' | 'rejected' | 'deferred'
  eligibility: EligibilityDecision; relevance: RelevanceDecision; metadataSufficiency: ArticleEvidence['coverage']
  observationIds: string[]; verifiedAuthors: string[]
}
export interface StageCOutput { version: 'tars-validator-stage-c/v1'; clock: string; versions: StageCVersions; articles: StageCDecision[] }
