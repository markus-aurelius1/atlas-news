/** Pages adapter for the registry-only News gateway, with a two-hour edge cache and explicit force-refresh bypass. */
import { collectFeeds, FEED_CACHE_CONTROL } from '../../src/current-affairs/gateway.ts'
import type { FeedResponse } from '../../src/current-affairs/types.ts'

let pending: Promise<FeedResponse> | null = null

const collectShared = () => {
  pending ??= collectFeeds((input, init) => fetch(input, { ...init, redirect: 'manual' })).finally(() => { pending = null })
  return pending
}

export async function onRequest({ request, waitUntil }: { request: Request; waitUntil: (promise: Promise<unknown>) => void }): Promise<Response> {
  const baseHeaders = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' })
  if (request.method !== 'GET') {
    baseHeaders.set('Allow', 'GET')
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: baseHeaders })
  }

  const url = new URL(request.url)
  const force = url.searchParams.get('refresh') === '1'
  const cache = (globalThis as unknown as { caches?: { default?: { match: (request: Request) => Promise<Response | undefined>; put: (request: Request, response: Response) => Promise<void> } } }).caches?.default
  const cacheKey = new Request(`${url.origin}${url.pathname}`, { method: 'GET' })

  if (!force && cache) {
    const hit = await cache.match(cacheKey)
    if (hit) {
      const headers = new Headers(hit.headers)
      headers.set('X-Tars-News-Cache', 'hit')
      return new Response(hit.body, { status: hit.status, statusText: hit.statusText, headers })
    }
  }

  const data = await collectShared()
  const available = data.sources.some(source => source.status !== 'failed')
  const headers = new Headers(baseHeaders)
  headers.set('Cache-Control', force ? 'no-store' : available ? FEED_CACHE_CONTROL : 'no-store')
  headers.set('X-Tars-News-Cache', force ? 'bypass' : 'miss')
  const response = new Response(JSON.stringify(available ? data : { error: 'All publishers are unavailable', sources: data.sources }), { status: available ? 200 : 503, headers })
  if (available && cache) {
    const cachedHeaders = new Headers(response.headers)
    cachedHeaders.set('Cache-Control', FEED_CACHE_CONTROL)
    cachedHeaders.set('X-Tars-News-Cache', 'miss')
    const cachedResponse = force ? new Response(response.clone().body, { status: response.status, statusText: response.statusText, headers: cachedHeaders }) : response.clone()
    waitUntil(cache.put(cacheKey, cachedResponse))
  }
  return response
}
