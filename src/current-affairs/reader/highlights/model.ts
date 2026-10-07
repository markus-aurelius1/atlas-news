/** Personal excerpts only. Identity is independent of subject and future review/sync metadata. */
export const HIGHLIGHT_COLORS = ['yellow', 'green', 'blue', 'pink', 'orange'] as const
export type HighlightColor = typeof HIGHLIGHT_COLORS[number]
export interface TextAnchor {
  version: 1
  quote: string
  prefix: string
  suffix: string
  start: number
  end: number
}
export interface HighlightArticle {
  articleUrl: string
  title: string
  publisher: string
  sourceId: string
  publishedAt: string | null
  subjectSnapshot: string | null
  categorySnapshot: string | null
}
export interface ReaderHighlight extends HighlightArticle {
  version: 1
  highlightId: string
  quote: string
  anchor: TextAnchor
  color: HighlightColor
  createdAt: number
  updatedAt: number
  deletedAt?: number
  resolution: 'pending' | 'resolved' | 'unresolved'
}
export const isColor = (v: unknown): v is HighlightColor => HIGHLIGHT_COLORS.includes(v as HighlightColor)

/** Existing News URL identity; fragments do not identify a different article. */
export function articleIdentity(value: string): string {
  const url = new URL(value)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid article address')
  url.hash = ''
  return url.href
}

/** Allowlisted import fields: no extraction result, HTML, body, auth or cookies can enter storage. */
export function parseHighlight(value: unknown): ReaderHighlight {
  if (!value || typeof value !== 'object') throw new Error('Invalid highlight')
  const r = value as ReaderHighlight, a = r.anchor
  const text = (v: unknown, max: number) => typeof v === 'string' && v.length <= max
  const time = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0
  if (r.version !== 1 || !text(r.highlightId, 100) || !r.highlightId || !text(r.articleUrl, 2048) || !text(r.title, 1000) || !text(r.publisher, 200) || !text(r.sourceId, 200) || !text(r.quote, 10000) || !r.quote.trim() || !isColor(r.color) || !time(r.createdAt) || !time(r.updatedAt) || (r.deletedAt !== undefined && !time(r.deletedAt))) throw new Error('Invalid highlight record')
  if (!a || a.version !== 1 || !text(a.quote, 10000) || !a.quote.trim() || !text(a.prefix, 64) || !text(a.suffix, 64) || !Number.isInteger(a.start) || !Number.isInteger(a.end) || a.start < 0 || a.end <= a.start || a.end - a.start !== a.quote.length) throw new Error('Invalid text anchor')
  if (!['pending', 'resolved', 'unresolved'].includes(r.resolution)) throw new Error('Invalid highlight resolution')
  const nullable = (v: unknown, max: number) => v === null || text(v, max)
  if (!nullable(r.publishedAt, 100) || !nullable(r.subjectSnapshot, 200) || !nullable(r.categorySnapshot, 200)) throw new Error('Invalid highlight metadata')
  return { version: 1, highlightId: r.highlightId, articleUrl: articleIdentity(r.articleUrl), title: r.title, publisher: r.publisher, sourceId: r.sourceId, publishedAt: r.publishedAt, subjectSnapshot: r.subjectSnapshot, categorySnapshot: r.categorySnapshot, quote: r.quote, anchor: { version: 1, quote: a.quote, prefix: a.prefix, suffix: a.suffix, start: a.start, end: a.end }, color: r.color, createdAt: r.createdAt, updatedAt: r.updatedAt, ...(r.deletedAt && { deletedAt: r.deletedAt }), resolution: r.resolution }
}
