/** Same-origin gateway: registry-only requests, bounded response sizes/time, isolated publisher failures. */
import { parseFeed, dedupeUrls } from './feed.ts'
import { NEWS_SOURCES } from './sources.ts'
import type { FeedResponse, NewsSource } from './types.ts'
export const FEED_CACHE_CONTROL = 'public, max-age=0, s-maxage=7200, stale-while-revalidate=21600'
export async function collectFeeds(fetcher: typeof fetch = fetch, sources: NewsSource[] = NEWS_SOURCES, now = Date.now()): Promise<FeedResponse> {
  const results = await Promise.all(sources.filter(s => s.enabled).map(async source => {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 10000)
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
    } catch { return { items: [], status: { sourceId: source.id, status: 'failed' as const, count: 0 } } }
    finally { clearTimeout(timeout) }
  }))
  return { version: 1, fetchedAt: new Date(now).toISOString(), items: dedupeUrls(results.flatMap(r => r.items)), sources: results.map(r => r.status) }
}
