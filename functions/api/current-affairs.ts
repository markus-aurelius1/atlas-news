/**
 * Pages adapter for the registry-only News gateway. Each request collects one fixed shard of the registry
 * (?shard=N), so an invocation makes at most FEED_SHARD_SIZE upstream requests plus its own cache read and write.
 * Every shard has its own two-hour edge cache entry and an explicit force-refresh bypass.
 */
import { collectFeeds, FEED_CACHE_CONTROL } from '../../src/current-affairs/gateway.ts'
import { FEED_SHARDS, shardIndex, requestLayout, registryGeneration } from '../../src/current-affairs/shards.ts'
import type { FeedResponse } from '../../src/current-affairs/types.ts'

const pending = new Map<string, Promise<FeedResponse>>()

/** Concurrent requests for one shard share a single collection. */
function collectShared(shard: number, layout = FEED_SHARDS): Promise<FeedResponse> {
  const generation = registryGeneration(layout), key = generation + ':' + shard
  let job = pending.get(key)
  if (!job) {
    job = collectFeeds((input, init) => fetch(input, { ...init, redirect: 'manual' }), layout[shard]).then(data => ({ ...data, registryGeneration: generation })).finally(() => { pending.delete(key) })
    pending.set(key, job)
  }
  return job
}

export async function onRequest({ request, waitUntil }: { request: Request; waitUntil: (promise: Promise<unknown>) => void }): Promise<Response> {
  const baseHeaders = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' })
  if (request.method !== 'GET') {
    baseHeaders.set('Allow', 'GET')
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: baseHeaders })
  }

  const url = new URL(request.url)
  const layout = requestLayout(url.searchParams)
  if (!layout) return new Response(JSON.stringify({ error: 'Unsupported feed generation' }), { status: 409, headers: { ...Object.fromEntries(baseHeaders), 'Cache-Control': 'no-store' } })
  const shard = shardIndex(url.searchParams, layout.length)
  if (shard === null) {
    // No upstream request is made without a valid shard: the whole registry never fits one invocation.
    baseHeaders.set('Cache-Control', 'no-store')
    return new Response(JSON.stringify({ error: 'A shard number is required', shards: FEED_SHARDS.length }), { status: 400, headers: baseHeaders })
  }
  const force = url.searchParams.get('refresh') === '1'
  const cache = (globalThis as unknown as { caches?: { default?: { match: (request: Request) => Promise<Response | undefined>; put: (request: Request, response: Response) => Promise<void> } } }).caches?.default
  const cacheKey = new Request(`${url.origin}${url.pathname}?shard=${shard}&generation=${registryGeneration(layout)}`, { method: 'GET' })

  if (!force && cache) {
    const hit = await cache.match(cacheKey)
    if (hit) {
      const headers = new Headers(hit.headers)
      headers.set('X-Tars-News-Cache', 'hit')
      return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers })
    }
  }

  const data = await collectShared(shard, layout)
  const available = data.sources.some(source => source.status !== 'failed')
  const headers = new Headers(baseHeaders)
  headers.set('Cache-Control', force ? 'no-store' : available ? FEED_CACHE_CONTROL : 'no-store')
  headers.set('X-Tars-News-Cache', force ? 'bypass' : 'miss')
  const response = new Response(JSON.stringify(available ? data : { error: 'All publishers in this shard are unavailable', sources: data.sources }), { status: available ? 200 : 503, headers })
  if (available && cache) {
    const cachedHeaders = new Headers(response.headers)
    cachedHeaders.set('Cache-Control', FEED_CACHE_CONTROL)
    cachedHeaders.set('X-Tars-News-Cache', 'miss')
    const cachedResponse = force ? new Response(response.clone().body, { status: response.status, statusText: response.statusText, headers: cachedHeaders }) : response.clone()
    waitUntil(cache.put(cacheKey, cachedResponse))
  }
  return response
}
