/** Evaluation contracts only. Production does not import this directory. */
export const SUBJECTS = ['Polity', 'Governance', 'Economy', 'International relations', 'Security', 'Sci-Tech', 'Environment', 'Geography', 'History & Culture'] as const
export type Subject = typeof SUBJECTS[number]
export type Partition = 'development' | 'validation' | 'holdout_unseen' | 'holdout_forward' | 'legacy_regression' | 'synthetic_adversarial'
export type ContentType = 'news_report' | 'explainer' | 'editorial' | 'column' | 'analysis' | 'digest' | 'interview' | 'official_release' | 'other' | 'unknown'
export type Scope = 'india_domestic' | 'india_impact' | 'global_knowledge' | 'global_systemic' | 'foreign_domestic_no_impact' | 'unknown'
export type Novelty = 'new_development' | 'distinct_analysis' | 'repeat' | 'uncertain' | 'not_applicable'
export interface Byline { name: string; provenance: 'rss:dc:creator' | 'rss:author' | 'atom:author' }
export interface Metadata {
  url: string; title: string; description: string; publisher: string
  memberships: { sourceId: string; feedUrl: string; section: string }[]
  categories: string[]; bylines: Byline[]
  publishedAt: string | null; updatedAt: string | null
}
export interface Observation {
  id: string; captureId: string; sourceId: string; ordinal: number; capturedAt: string
  parserVersion: string; registryHash: string; metadataHash: string; metadata: Metadata
}
export interface SourceCapture {
  sourceId: string; feedUrl: string; capturedAt: string; status: 'ok' | 'empty' | 'failed'
  httpStatus: number | null; failure: 'http' | 'redirect' | 'timeout' | 'network' | 'too_large' | 'parse' | 'budget' | null
  countBefore: number | null; countAfter: number; invalidEntries: number | null; truncatedEntries: number | null
  observations: Observation[]
}
export interface RawCapture {
  version: 'tars-news-raw/v1'; id: string; shardIndex: number; capturedAt: string
  registryHash: string; parserVersion: string; sources: SourceCapture[]
}
export interface EvidenceSpan { observationId: string; field: 'title' | 'description' | 'categories' | 'bylines'; start: number; end: number }
export interface Labels {
  value: 'must_read' | 'useful' | 'reject' | null
  primarySubject: Subject | 'not_applicable' | null; secondarySubjects: Subject[]
  contentType: ContentType | null; partyPoliticsPrimary: boolean | null; partyMention: boolean | null
  scope: Scope | null; scopeReason: string | null
  storyId: string | null; themeId: string | null; angleId: string | null
  novelty: { status: Novelty; relativeTo: string[]; cutoff: string } | null
  materialDelta: { description: string; evidence: EvidenceSpan[] } | null
  rejectReasons: string[]; rationale: string | null
  metadataSufficiency: { level: 'sufficient' | 'limited' | 'insufficient'; missingFields: ('title' | 'description' | 'bylines' | 'categories' | 'publication_time' | 'scope' | 'development' | 'angle')[] } | null
  reviewBasis: 'feed_metadata' | null
}
export interface Sampling {
  panel: 'representative' | 'coverage' | 'stress'; stratum: string; seed: string
  inclusionProbability: number | null; populationDenominator: number | null
  window: { start: string; end: string }; manifestHash: string; synthetic: boolean
}
export interface Annotation {
  reviewerId: string; reviewedAt: string; rubricVersion: string; labels: Labels; evidence: EvidenceSpan[]
}
export interface GoldRecord {
  version: 'tars-news-gold/v1'; id: string; observationIds: string[]; metadata: Metadata; sampling: Sampling
  review: {
    status: 'unreviewed' | 'in_review' | 'disputed' | 'adjudicated' | 'unresolvable'
    annotations: Annotation[]
    adjudication: { adjudicatorId: string; reviewedAt: string; rationale: string; resolutionVersion: string; labels: Labels } | null
  }
  gold: Labels; partition: Partition
}
export interface Prediction {
  url: string; decision: 'accepted' | 'rejected' | 'deferred'
  primarySubject: Subject | null; eventId: string | null; themeId: string | null; angleId: string | null; novelty: Novelty
}
export interface ReadingUnit { id: string; primaryUrl: string; memberUrls: string[] }
export interface PredictionOutput { articles: Prediction[]; units: ReadingUnit[] }
export interface ReplayVersions { policyId: string; policyHash: string; indexHash: string; registryHash: string; codeHash: string }
export interface RunArtifact extends PredictionOutput {
  version: 'tars-news-run/v1'; clock: string; versions: ReplayVersions
  observationsHash: string; historyHash: string; inputHash: string; outputHash: string
}
export interface LeakageIdentity {
  url: string; aliases: string[]; syndicationIds: string[]; nearDuplicateIds: string[]
  developmentIds: string[]; angleIds: string[]; themeIds: string[]; firstObservedAt: string; lastObservedAt: string
}
export interface PartitionAssignment extends LeakageIdentity { partition: Partition }
export const EMPTY_LABELS: Labels = {
  value: null, primarySubject: null, secondarySubjects: [], contentType: null, partyPoliticsPrimary: null,
  partyMention: null, scope: null, scopeReason: null, storyId: null, themeId: null, angleId: null,
  novelty: null, materialDelta: null, rejectReasons: [], rationale: null, metadataSufficiency: null, reviewBasis: null,
}
