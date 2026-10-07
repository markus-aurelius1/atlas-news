/** Bounded optional evidence only. No inferred prose, subjects, acceptance or body fields. */
import { canonicalUrl, cleanText, thumbnailUrl } from '../feed.ts'
import { NEWS_SOURCES } from '../sources.ts'
import type { FeedByline, FeedMembership, NewsItem, NewsSource, FeedResponse } from '../types.ts'
export const METADATA_VERSION = 'tars-source-metadata/2'
export const METADATA_LIMITS = { memberships: 99, categories: 30, bylines: 20, name: 160, section: 100, url: 2048 } as const
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
export function boundedDistinct<T>(values: T[], key: (v: T) => string, limit: number): T[] {
  return [...new Map(values.map(v => [key(v), v])).values()].sort((a, b) => compare(key(a), key(b))).slice(0, limit)
}
/** Exact registry binding, exact publisher and site host; suffix lookalikes/credentials never establish evidence. */
export function boundSource(url: string, publisher: string, membership: FeedMembership, registry: NewsSource[] = NEWS_SOURCES): NewsSource | null {
  const source = registry.find(s => s.id === membership.sourceId && s.enabled && s.feedUrl === membership.feedUrl && s.section === membership.section && s.publisher === publisher)
  const canonical = canonicalUrl(url)
  if (!source || !canonical) return null
  if (new URL(canonical).port) return null
  const host = new URL(canonical).hostname.replace(/^www\./, '')
  return host === new URL(source.siteUrl).hostname.replace(/^www\./, '') ? source : null
}
export function optionalMetadata(item: NewsItem): Pick<NewsItem, 'memberships' | 'categories' | 'bylines' | 'updatedAt'> {
  const implicit = NEWS_SOURCES.find(s => s.id === item.sourceId && s.publisher === item.publisher)
  const supplied = Array.isArray(item.memberships) ? item.memberships : implicit ? [{ sourceId: implicit.id, feedUrl: implicit.feedUrl, section: implicit.section }] : []
  const memberships = boundedDistinct((implicit ? supplied : []).filter(m => m && typeof m.sourceId === 'string' && typeof m.feedUrl === 'string' && typeof m.section === 'string' && m.feedUrl.length <= 2048 && !!boundSource(item.url, item.publisher, m)).map(m => ({sourceId:m.sourceId,feedUrl:m.feedUrl,section:m.section})), m => m.sourceId, METADATA_LIMITS.memberships)
  const ids = new Set(memberships.map(m => m.sourceId))
  const categories = boundedDistinct((Array.isArray(item.categories) ? item.categories : []).filter(c => typeof c === 'string').map(c => cleanText(c).slice(0, 160)).filter(Boolean), c => c, METADATA_LIMITS.categories)
  const bylines = boundedDistinct((Array.isArray(item.bylines) ? item.bylines : []).filter(b => b && typeof b.name === 'string' && ids.has(b.sourceId) && ['rss:dc:creator', 'rss:author', 'atom:author'].includes(b.provenance)).map(b => ({ name: cleanText(b.name).slice(0, 160), sourceId: b.sourceId, provenance: b.provenance })).filter(b => b.name), b => JSON.stringify([b.sourceId, b.provenance, b.name]), METADATA_LIMITS.bylines)
  // Historical rows with no optional fields stay valid; absent means unknown, never negative evidence.
  const updatedAt = typeof item.updatedAt === 'string' && Number.isFinite(Date.parse(item.updatedAt)) ? new Date(item.updatedAt).toISOString() : null
  return { ...(item.memberships !== undefined || memberships.length ? { memberships } : {}), ...(item.categories !== undefined ? { categories } : {}), ...(item.bylines !== undefined ? { bylines } : {}), ...(item.updatedAt !== undefined ? { updatedAt } : {}) }
}
export function bylineCandidates(nodes: { name: string; text: string }[], atom: boolean, sourceId: string): FeedByline[] {
  return boundedDistinct(nodes.flatMap(n => {
    const kind = n.name.toLowerCase()
    const provenance = atom && kind === 'author' ? 'atom:author' : !atom && kind === 'dc:creator' ? 'rss:dc:creator' : !atom && kind === 'author' ? 'rss:author' : null
    const name = cleanText(n.text).slice(0, 160)
    return provenance && name ? [{ name, provenance, sourceId } as FeedByline] : []
  }), b => JSON.stringify([b.provenance, b.name]), METADATA_LIMITS.bylines)
}
/** Pick actual strings; never join descriptions. Primary source follows pinned registry precedence, not arrival order. */
export function mergeMetadata(rows: NewsItem[]): NewsItem {
  const ordered = [...rows].sort((a, b) => {
    const rank = (id: string) => { const k = NEWS_SOURCES.findIndex(s => s.id === id); return k < 0 ? 999 : k }
    return rank(a.sourceId) - rank(b.sourceId) || compare(JSON.stringify(a), JSON.stringify(b))
  })
  const primary = ordered[0]
  const longest = (field: 'title' | 'description') => [...ordered].sort((a,b) => b[field].length - a[field].length || compare(a[field], b[field]))[0][field]
  const optional = ordered.map(optionalMetadata)
  const memberships = boundedDistinct(optional.flatMap(m => m.memberships ?? []), m => m.sourceId, METADATA_LIMITS.memberships)
  const categories = boundedDistinct(optional.flatMap(m => m.categories ?? []), c => c, METADATA_LIMITS.categories)
  const bylines = boundedDistinct(optional.flatMap(m => m.bylines ?? []), b => JSON.stringify([b.sourceId,b.provenance,b.name]), METADATA_LIMITS.bylines)
  const updatedAt = optional.map(m => m.updatedAt).filter((s): s is string => !!s).sort().at(-1)
  const thumbnail = ordered.map(m => m.thumbnailUrl).find(Boolean)
  return { title: longest('title').slice(0,400), description: longest('description').slice(0,600), url: primary.url, publisher: primary.publisher, sourceId: primary.sourceId, section: primary.section, publishedAt: ordered.map(m => m.publishedAt).find(Boolean) ?? null,
    ...(thumbnail ? { thumbnailUrl: thumbnail } : {}), ...(memberships.length ? { memberships } : {}), ...(categories.length ? { categories } : {}), ...(bylines.length ? { bylines } : {}), ...(updatedAt ? { updatedAt } : {}) }
}
/** Cache ingress has the same allowlist as feed/archive metadata, including old snapshots. */
export function cleanFeedResponse(data: FeedResponse): FeedResponse {
  const items = data.items.flatMap(item => {
    const url = canonicalUrl(item.url)
    if (!url || url.length > METADATA_LIMITS.url) return []
    const { thumbnailUrl: rawImage, ...merged } = mergeMetadata([{ ...item, url }]), image = rawImage && thumbnailUrl(rawImage)
    return [{ ...merged, publishedAt: typeof merged.publishedAt === 'string' && Number.isFinite(Date.parse(merged.publishedAt)) ? new Date(merged.publishedAt).toISOString() : null, publisher: merged.publisher.slice(0,100), sourceId: merged.sourceId.slice(0,100), section: merged.section.slice(0,100), ...(image ? { thumbnailUrl:image } : {}) }]
  })
  return { version:1, fetchedAt:data.fetchedAt, ...(typeof data.registryGeneration === 'string' && data.registryGeneration.length <= 100 ? { registryGeneration:data.registryGeneration } : {}), items,
    sources:data.sources.filter(s=>s && typeof s.sourceId==='string' && ['ok','empty','failed'].includes(s.status) && Number.isFinite(s.count)).map(s=>({sourceId:s.sourceId.slice(0,100),status:s.status,count:Math.max(0,Math.min(200,Math.floor(s.count))) })) }
}
