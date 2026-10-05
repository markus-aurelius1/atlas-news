/**
 * The registry is collected in small fixed shards so no gateway invocation makes more than a handful of upstream
 * requests: Cloudflare's free plan allows 50 subrequests and little CPU per invocation, and one invocation over all
 * 77 feeds cannot fit. The client requests every shard (each cached at the edge for two hours) and merges them.
 */
import { dedupeUrls } from './feed.ts'
import { NEWS_SOURCES } from './sources.ts'
import type { FeedResponse, NewsSource } from './types.ts'

/** Upstream feeds per invocation: one wave of the gateway's six concurrent connections. */
export const FEED_SHARD_SIZE = 6
/** Round-robin assignment spreads one publisher's (often heavy) section feeds across shards. */
export function feedShards(sources: NewsSource[] = NEWS_SOURCES): NewsSource[][] {
  const enabled = sources.filter(s => s.enabled), count = Math.ceil(enabled.length / FEED_SHARD_SIZE)
  return Array.from({ length: count }, (_, k) => enabled.filter((_, i) => i % count === k))
}
export const FEED_SHARDS = feedShards()
/** The only request parameter the gateway reads besides refresh: a shard number in range, or null. */
export function shardIndex(params: URLSearchParams, count = FEED_SHARDS.length): number | null {
  const raw = params.get('shard')
  if (raw === null || !/^\d{1,3}$/.test(raw)) return null
  const index = Number(raw)
  return index < count ? index : null
}
/**
 * One feed from the shards that answered. A shard that failed keeps its sources' articles from the previous
 * snapshot and reports those sources as failed, so one bad batch never empties part of the reading list.
 * The merged feed is as old as its oldest shard, which is what decides when the next refresh is due.
 */
export function mergeShards(parts: (FeedResponse | null)[], previous: FeedResponse | null, shards: NewsSource[][] = FEED_SHARDS): FeedResponse | null {
  const answered = parts.filter((part): part is FeedResponse => !!part)
  if (!answered.length) return null
  const lost = new Set(shards.flatMap((shard, k) => parts[k] ? [] : shard.map(s => s.id)))
  const status = new Map<string, FeedResponse['sources'][number]>()
  for (const id of lost) status.set(id, { sourceId: id, status: 'failed', count: 0 })
  for (const part of answered) for (const source of part.sources) status.set(source.sourceId, source)
  const kept = (previous?.items ?? []).filter(item => lost.has(item.sourceId))
  const fetchedAt = answered.map(part => part.fetchedAt).sort((a, b) => Date.parse(a) - Date.parse(b))[0]
  return { version: 1, fetchedAt, items: dedupeUrls([...answered.flatMap(part => part.items), ...kept].map(item => ({ ...item }))), sources: [...status.values()] }
}
