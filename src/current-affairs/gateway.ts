/** Same-origin gateway: registry-only requests, bounded concurrency, response sizes and time, isolated publisher failures. */
import { parseFeed, dedupeUrls } from './feed.ts'
import { CURRENT_NEWS_SOURCES } from './sources.ts'
import type { FeedResponse, NewsItem, NewsSource } from './types.ts'
export const FEED_CACHE_CONTROL = 'public, max-age=0, s-maxage=7200, stale-while-revalidate=21600'
/** Upstream requests in flight at once; matches the edge runtime's own simultaneous-connection ceiling. */
export const FEED_CONCURRENCY = 6
const FEED_TIMEOUT_MS = 10000
/** Whole-collection budget, kept inside the client's 18 s request timeout; sources not reached by then fail in isolation. */
export const COLLECT_BUDGET_MS = 15000
type SourceResult = { items: NewsItem[]; status: FeedResponse['sources'][number] }
export async function collectFeeds(fetcher: typeof fetch = fetch, sources: NewsSource[] = CURRENT_NEWS_SOURCES, now = Date.now()): Promise<FeedResponse> {
  const active = sources.filter(s => s.enabled), deadline = Date.now() + COLLECT_BUDGET_MS
  const failed = (source: NewsSource): SourceResult => ({ items: [], status: { sourceId: source.id, status: 'failed', count: 0 } })
  const collect = async (source: NewsSource): Promise<SourceResult> => {
    const remaining = deadline - Date.now()
    if (remaining <= 0) return failed(source)
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), Math.min(FEED_TIMEOUT_MS, remaining))
    try {
      const response = await fetcher(source.feedUrl, { signal: controller.signal, redirect: 'error', headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml', 'User-Agent': 'TarsCurrentAffairs/1.0 (RSS link reader)' } })
      if (!response.ok || !response.body) throw new Error('Feed unavailable')
      const reader = response.body.getReader(), decoder = new TextDecoder(); let xml = '', bytes = 0
      try {
        while (true) {
          const chunk = await reader.read(); if (chunk.done) break
          bytes += chunk.value.byteLength
          if (bytes > 4 * 1024 * 1024) throw new Error('Feed too large')
          xml += decoder.decode(chunk.value, { stream: true })
        }
      } finally { await reader.cancel() }
      xml += decoder.decode()
      const items = parseFeed(xml, source)
      return { items, status: { sourceId: source.id, status: items.length ? 'ok' as const : 'empty' as const, count: items.length } }
    } catch { return failed(source) }
    finally { clearTimeout(timeout) }
  }
  // A fixed pool of workers drains the registry in order, so adding sources never widens the upstream fan-out.
  const results: SourceResult[] = new Array(active.length); let next = 0
  await Promise.all(Array.from({ length: Math.min(FEED_CONCURRENCY, active.length) }, async () => {
    while (next < active.length) { const i = next++; results[i] = await collect(active[i]) }
  }))
  return { version: 1, fetchedAt: new Date(now).toISOString(), items: dedupeUrls(results.flatMap(r => r.items)), sources: results.map(r => r.status) }
}
