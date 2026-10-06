/** Feed metadata is transient; no article bodies or learner state belong here. (The reader's article text lives only in memory: reader/extract.ts.) */
export interface NewsSource {
  id: string
  publisher: string
  label: string
  feedUrl: string
  siteUrl: string
  kind: 'newspaper' | 'international' | 'newsletter'
  section: string
  subjectHints: string[]
  priority: number
  enabled: boolean
}
export interface NewsItem { title: string; url: string; publisher: string; sourceId: string; section: string; publishedAt: string | null; description: string; thumbnailUrl?: string }
export interface FeedResponse { version: 1; fetchedAt: string; items: NewsItem[]; sources: { sourceId: string; status: 'ok' | 'empty' | 'failed'; count: number }[] }
/** One syllabus concept. Counts are lexical document frequencies over past papers, never question-to-topic mappings. */
export interface RelevanceSignal {
  concept: string
  /** Spellings news feeds use; a leading ^ is matched case-sensitively. */
  aliases: string[]
  /** Past-paper questions containing each spelling, parallel to aliases. */
  aliasCounts?: number[]
  subject: string; topic: string; subtopic: string
  /** 3 a named institution, law, scheme, treaty or place; 2 a syllabus theme; 1 a broad or ambiguous term. */
  tier?: 1 | 2 | 3
  /** global: meaningful worldwide; domestic: an Indian institution whose name other countries share; india: Indian by default. */
  scope?: 'india' | 'global' | 'domestic'
  mined?: boolean
  taxonomyIds: string[]; prelimsCount: number; mainsCount: number; uppcsCount?: number; prelimsDemand: boolean; mainsDemand: boolean
}
export interface RelevanceIndex { version: 2; provenance: Record<string, unknown>; signals: RelevanceSignal[]; /** Editorial vocabulary with no past-paper or taxonomy support. */ context?: RelevanceSignal[] }
/** One weighed observation behind a verdict; points sum to the score. */
export interface RelevanceEvidence { kind: 'concept' | 'recurrence' | 'framing' | 'india' | 'state' | 'source' | 'foreign' | 'noise'; label: string; points: number; where?: 'title' | 'description' | 'feed' }
export interface Relevance { accepted: boolean; score: number; exam: 'prelims' | 'mains' | 'both' | 'general'; subjects: string[]; topics: string[]; staticAnchors: string[]; signals: string[]; rejectionReason?: string; /** Acceptance threshold the score was compared with. */ threshold?: number; evidence?: RelevanceEvidence[]; /** The substantive-value gate: what the article reports, and what makes it low-value. Applies after the score. */ substance?: { score: number; signals: string[]; lowValue: string[] } }
export interface ClassifiedItem extends NewsItem { relevance: Relevance }
/** members are the articles a story shows (best first, at most five); overflow holds the URLs of further reports of the same event. */
export interface NewsEvent { id: string; primary: ClassifiedItem; members: ClassifiedItem[]; overflow?: string[] }
