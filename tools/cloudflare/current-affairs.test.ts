/** Verify the Pages transport contract and the free-plan request budget without fetching live publishers. */
import assert from 'node:assert/strict'
import { it as test, vi } from 'vitest'
import { onRequest } from '../../functions/api/current-affairs.ts'
import { FEED_CACHE_CONTROL, FEED_CONCURRENCY } from '../../src/current-affairs/gateway.ts'
import { FEED_SHARD_SIZE, FEED_SHARDS, FEED_REGISTRY_GENERATION, feedShards, mergeShards, shardIndex } from '../../src/current-affairs/shards.ts'
import { NEWS_SOURCES } from '../../src/current-affairs/sources.ts'
import type { FeedResponse } from '../../src/current-affairs/types.ts'

/** Cloudflare Workers Free: subrequests per invocation and simultaneous outgoing connections. */
const FREE_SUBREQUESTS = 50, FREE_CONNECTIONS = 6
const empty = '<rss><channel></channel></rss>'
const shardUrl = (shard: number | string, extra = '') => `https://example.test/api/current-affairs?shard=${shard}&generation=${FEED_REGISTRY_GENERATION}${extra}`

test('every registry source belongs to exactly one shard, and no shard nears the free-plan limits', () => {
  const ids = FEED_SHARDS.flat().map(s => s.id)
  assert.deepEqual([...ids].sort(), NEWS_SOURCES.filter(s => s.enabled).map(s => s.id).sort())
  assert.equal(new Set(ids).size, ids.length)
  assert.equal(FEED_SHARDS.length, Math.ceil(NEWS_SOURCES.length / FEED_SHARD_SIZE))
  for (const shard of FEED_SHARDS) {
    assert.ok(shard.length >= 1 && shard.length <= FEED_SHARD_SIZE)
    // Upstream fetches plus the invocation's own cache read and write, with a wide margin.
    assert.ok(shard.length + 2 <= FREE_SUBREQUESTS / 4)
  }
  assert.ok(FEED_CONCURRENCY <= FREE_CONNECTIONS)
  // Even a registry at its 99-source cap stays inside the budget per invocation.
  const full = Array.from({ length: 99 }, (_, i) => ({ ...NEWS_SOURCES[0], id: 's' + i }))
  assert.ok(feedShards(full).every(shard => shard.length <= FEED_SHARD_SIZE))
  // Disabled sources are never assigned, so they are never fetched.
  assert.equal(feedShards([{ ...NEWS_SOURCES[0], enabled: false }]).length, 0)
})

test('one invocation fetches only its own shard, with bounded concurrency and manual redirects', async () => {
  const originalFetch = globalThis.fetch
  try {
    for (const [k, shard] of FEED_SHARDS.entries()) {
      const fetched: string[] = []; let inFlight = 0, peak = 0
      globalThis.fetch = async (input, init) => {
        assert.equal(init?.redirect, 'manual')
        assert.ok(init?.signal)
        fetched.push(String(input)); peak = Math.max(peak, ++inFlight)
        await new Promise(r => setTimeout(r, 1))
        inFlight--
        return new Response(empty)
      }
      const response = await onRequest({ request: new Request(shardUrl(k, '&url=https://untrusted.test')), waitUntil: () => {} })
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('Cache-Control'), FEED_CACHE_CONTROL)
      const data = await response.json() as FeedResponse
      assert.equal(data.version, 1)
      assert.deepEqual(fetched.sort(), shard.map(s => s.feedUrl).sort())
      assert.deepEqual(data.sources.map(s => s.sourceId), shard.map(s => s.id))
      assert.ok(fetched.length <= FEED_SHARD_SIZE && peak <= FREE_CONNECTIONS)
    }
  } finally { globalThis.fetch = originalFetch }
})

test('a missing, malformed or out-of-range shard makes no upstream request', async () => {
  const originalFetch = globalThis.fetch
  try {
    globalThis.fetch = async () => { throw new Error('No upstream request is allowed here') }
    for (const url of ['https://example.test/api/current-affairs', shardUrl(''), shardUrl('abc'), shardUrl('-1'), shardUrl('1.5'), shardUrl(FEED_SHARDS.length), shardUrl('9999'), 'https://example.test/api/current-affairs?url=https://untrusted.test']) {
      const response = await onRequest({ request: new Request(url), waitUntil: () => {} })
      assert.equal(response.status, 400, url)
      assert.equal(response.headers.get('Cache-Control'), 'no-store')
      assert.deepEqual(await response.json(), { error: 'A shard number is required', shards: FEED_SHARDS.length })
    }
    const unsupported = await onRequest({ request: new Request(shardUrl(0), { method: 'POST' }), waitUntil: () => {} })
    assert.equal(unsupported.status, 405)
    assert.equal(unsupported.headers.get('Allow'), 'GET')
    assert.equal(unsupported.headers.get('Content-Type'), 'application/json; charset=utf-8')
    assert.equal(shardIndex(new URLSearchParams('shard=0')), 0)
    assert.equal(shardIndex(new URLSearchParams('shard=00012')), null)
  } finally { globalThis.fetch = originalFetch }
})

test('a shard isolates partial failure, reports total failure, and refuses publisher redirects', async () => {
  const originalFetch = globalThis.fetch
  const request = new Request(shardUrl(1))
  try {
    let calls = 0
    globalThis.fetch = async () => { calls++; return calls === 1 ? new Response(empty) : new Response('', { status: 502 }) }
    const partial = await onRequest({ request, waitUntil: () => {} })
    assert.equal(partial.status, 200)
    const statuses = (await partial.json() as FeedResponse).sources.map(s => s.status)
    assert.ok(statuses.includes('failed') && statuses.some(s => s !== 'failed'))
    globalThis.fetch = async () => new Response('', { status: 502 })
    const failed = await onRequest({ request, waitUntil: () => {} })
    assert.equal(failed.status, 503)
    assert.equal(failed.headers.get('Cache-Control'), 'no-store')
    assert.equal((await failed.json()).error, 'All publishers in this shard are unavailable')
    globalThis.fetch = async () => new Response('', { status: 302, headers: { Location: 'https://untrusted.test' } })
    const redirects = await onRequest({ request, waitUntil: () => {} })
    assert.equal(redirects.status, 503)
    assert.ok((await redirects.json()).sources.every((source: { status: string }) => source.status === 'failed'))
  } finally { globalThis.fetch = originalFetch }
})

test('each shard has its own two-hour cache entry, and force refresh replaces only that entry', async () => {
  const originalFetch = globalThis.fetch
  const entries = new Map<string, Response>()
  let calls = 0
  const jobs: Promise<unknown>[] = []
  vi.stubGlobal('caches', { default: {
    match: async (key: Request) => entries.get(key.url)?.clone(),
    put: async (key: Request, response: Response) => { entries.set(key.url, response.clone()) },
  } })
  const waitUntil = (job: Promise<unknown>) => { jobs.push(job) }
  try {
    globalThis.fetch = async (_input, init) => { assert.equal(init?.redirect, 'manual'); calls++; return new Response(empty) }
    const first = await onRequest({ request: new Request(shardUrl(0)), waitUntil })
    assert.equal(first.headers.get('X-Tars-News-Cache'), 'miss')
    await Promise.all(jobs)
    assert.equal(calls, FEED_SHARDS[0].length)
    const hit = await onRequest({ request: new Request(shardUrl(0, '&ignored=1')), waitUntil })
    assert.equal(hit.headers.get('X-Tars-News-Cache'), 'hit')
    assert.equal(calls, FEED_SHARDS[0].length)
    // Another shard is a different entry and its own collection.
    const other = await onRequest({ request: new Request(shardUrl(1)), waitUntil })
    assert.equal(other.headers.get('X-Tars-News-Cache'), 'miss')
    await Promise.all(jobs)
    assert.equal(calls, FEED_SHARDS[0].length + FEED_SHARDS[1].length)
    const forced = await onRequest({ request: new Request(shardUrl(0, '&refresh=1')), waitUntil })
    assert.equal(forced.headers.get('Cache-Control'), 'no-store')
    assert.equal(forced.headers.get('X-Tars-News-Cache'), 'bypass')
    await Promise.all(jobs)
    assert.equal(calls, FEED_SHARDS[0].length * 2 + FEED_SHARDS[1].length)
    assert.deepEqual([...entries.keys()].sort(), [shardUrl(0), shardUrl(1)])
    assert.equal(entries.get(shardUrl(0))?.headers.get('Cache-Control'), FEED_CACHE_CONTROL)
    // Concurrent requests for one shard share one collection.
    entries.clear(); calls = 0
    await Promise.all([onRequest({ request: new Request(shardUrl(2)), waitUntil }), onRequest({ request: new Request(shardUrl(2)), waitUntil })])
    assert.equal(calls, FEED_SHARDS[2].length)
  } finally { globalThis.fetch = originalFetch; vi.unstubAllGlobals() }
})

test('the client merge keeps a failed shard’s previous articles and dates the feed by its oldest shard', () => {
  const shards = [[{ ...NEWS_SOURCES[0], id: 'a' }], [{ ...NEWS_SOURCES[0], id: 'b' }], [{ ...NEWS_SOURCES[0], id: 'c' }]]
  const item = (sourceId: string, n: number) => ({ title: `${sourceId} ${n}`, url: `https://example.org/${sourceId}/${n}`, publisher: 'P', sourceId, section: 'S', publishedAt: null, description: '' })
  const part = (sourceId: string, fetchedAt: string, n: number): FeedResponse => ({ version: 1, fetchedAt, items: [item(sourceId, n)], sources: [{ sourceId, status: 'ok', count: 1 }] })
  const previous: FeedResponse = { version: 1, fetchedAt: '2026-10-05T06:00:00.000Z', items: [item('a', 1), item('b', 1), item('c', 1)], sources: [] }
  const merged = mergeShards([part('a', '2026-10-05T09:00:00.000Z', 2), null, part('c', '2026-10-05T08:00:00.000Z', 2)], previous, shards)!
  assert.equal(merged.fetchedAt, '2026-10-05T08:00:00.000Z')
  assert.deepEqual(merged.items.map(i => i.title), ['a 2', 'c 2', 'b 1'])
  assert.deepEqual(merged.sources.find(s => s.sourceId === 'b'), { sourceId: 'b', status: 'failed', count: 0 })
  assert.equal(mergeShards([null, null, null], previous, shards), null)
  assert.deepEqual(mergeShards([part('a', '2026-10-05T09:00:00.000Z', 2), null, null], null, shards)!.items.map(i => i.title), ['a 2'])
})
