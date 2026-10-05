/** Feed metadata is transient; no article bodies or learner state belong here. */
export interface NewsSource {
  id: string
  publisher: string
  label: string
  feedUrl: string
  siteUrl: string
  kind: 'newspaper' | 'international'
  section: string
  subjectHints: string[]
  priority: number
  enabled: boolean
}
export interface NewsItem { title: string; url: string; publisher: string; sourceId: string; section: string; publishedAt: string | null; description: string; thumbnailUrl?: string }
export interface FeedResponse { version: 1; fetchedAt: string; items: NewsItem[]; sources: { sourceId: string; status: 'ok' | 'empty' | 'failed'; count: number }[] }
export interface RelevanceSignal { concept: string; aliases: string[]; subject: string; topic: string; subtopic: string; taxonomyIds: string[]; prelimsCount: number; mainsCount: number; prelimsDemand: boolean; mainsDemand: boolean }
export interface RelevanceIndex { version: 1; provenance: Record<string, unknown>; signals: RelevanceSignal[] }
export interface Relevance { accepted: boolean; score: number; exam: 'prelims' | 'mains' | 'both' | 'general'; subjects: string[]; topics: string[]; staticAnchors: string[]; signals: string[]; rejectionReason?: string }
export interface ClassifiedItem extends NewsItem { relevance: Relevance }
export interface NewsEvent { id: string; primary: ClassifiedItem; members: ClassifiedItem[] }
