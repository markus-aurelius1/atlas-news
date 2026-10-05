/** Verify the Pages transport contract without fetching live publishers or changing ingestion. */
import assert from 'node:assert/strict'
import { it as test, vi } from 'vitest'
import { onRequest } from '../../functions/api/current-affairs.ts'
import { FEED_CACHE_CONTROL } from '../../src/current-affairs/gateway.ts'

test('Pages preserves GET, partial failure, total failure and method contracts', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  try {
    globalThis.fetch = async (_input, init) => {
      assert.equal(init?.redirect, 'manual')
      assert.ok(init?.signal)
      calls++
      return new Response('<rss><channel></channel></rss>')
    }
    const request = new Request('https://example.test/api/current-affairs?url=https://untrusted.test')
    const available = await onRequest({ request, waitUntil: () => {} })
    assert.equal(available.status, 200)
    assert.equal(available.headers.get('Cache-Control'), FEED_CACHE_CONTROL)
    const data = await available.json()
    assert.equal(data.version, 1)
    assert.ok(data.sources.length > 0)
    assert.equal(calls, data.sources.length)
    calls = 0
    globalThis.fetch = async () => { calls++; return calls === 1 ? new Response('<rss><channel></channel></rss>') : new Response('', { status: 502 }) }
    const partial = await onRequest({ request })
    assert.equal(partial.status, 200)
    assert.ok((await partial.json()).sources.some((source: { status: string }) => source.status === 'failed'))
    globalThis.fetch = async () => new Response('', { status: 502 })
    const failed = await onRequest({ request })
    assert.equal(failed.status, 503)
    assert.equal(failed.headers.get('Cache-Control'), 'no-store')
    assert.equal((await failed.json()).error, 'All publishers are unavailable')
    globalThis.fetch = async () => new Response('', { status: 302, headers: { Location: 'https://untrusted.test' } })
    const redirects = await onRequest({ request })
    assert.equal(redirects.status, 503)
    assert.ok((await redirects.json()).sources.every((source: { status: string }) => source.status === 'failed'))
    globalThis.fetch = async () => { throw new Error('Unsupported methods must not fetch') }
    const unsupported = await onRequest({ request: new Request(request.url, { method: 'POST' }), waitUntil: () => {} })
    assert.equal(unsupported.status, 405)
    assert.equal(unsupported.headers.get('Allow'), 'GET')
    assert.equal(unsupported.headers.get('Content-Type'), 'application/json; charset=utf-8')
  } finally { globalThis.fetch = originalFetch }
})

test('Pages serves canonical cache hits and force refresh replaces that same cache entry', async () => {
  const originalFetch = globalThis.fetch
  const entries = new Map<string, Response>()
  let calls = 0
  const jobs: Promise<unknown>[] = []
  vi.stubGlobal('caches', { default: {
    match: async (key: Request) => entries.get(key.url)?.clone(),
    put: async (key: Request, response: Response) => { entries.set(key.url, response.clone()) },
  } })
  const request = new Request('https://example.test/api/current-affairs')
  const waitUntil = (job: Promise<unknown>) => { jobs.push(job) }
  try {
    globalThis.fetch = async (_input, init) => { assert.equal(init?.redirect, 'manual'); calls++; return new Response('<rss><channel></channel></rss>') }
    const first = await onRequest({ request, waitUntil })
    assert.equal(first.headers.get('X-Tars-News-Cache'), 'miss')
    await Promise.all(jobs)
    const fetched = calls
    const hit = await onRequest({ request, waitUntil })
    assert.equal(hit.headers.get('X-Tars-News-Cache'), 'hit')
    assert.equal(calls, fetched)
    const forced = await onRequest({ request: new Request(request.url + '?refresh=1'), waitUntil })
    assert.equal(forced.headers.get('Cache-Control'), 'no-store')
    assert.equal(forced.headers.get('X-Tars-News-Cache'), 'bypass')
    await Promise.all(jobs)
    assert.equal(calls, fetched * 2)
    assert.deepEqual([...entries.keys()], [request.url])
    assert.equal(entries.get(request.url)?.headers.get('Cache-Control'), FEED_CACHE_CONTROL)
  } finally { globalThis.fetch = originalFetch; vi.unstubAllGlobals() }
})
