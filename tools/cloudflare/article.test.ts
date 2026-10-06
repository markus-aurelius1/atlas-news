/** The reader gateway's Pages contract: closed without Access, one upstream request per invocation, nothing cached, never a proxy. */
import assert from 'node:assert/strict'
import { afterEach, it as test, vi } from 'vitest'
import { onRequest as middleware } from '../../functions/api/_middleware.ts'
import { onRequest } from '../../functions/api/article.ts'

const originalFetch = globalThis.fetch
afterEach(() => { globalThis.fetch = originalFetch; vi.unstubAllGlobals() })

const endpoint = (target: string, extra = '') => `https://tars.example/api/article?url=${encodeURIComponent(target)}${extra}`
const html = '<html><head><script>track()</script></head><body><article><p>Body text</p></article></body></html>'

test('an article is returned once, stripped of code, and marked never to be stored', async () => {
  const fetched: string[] = []
  globalThis.fetch = async (input, init) => {
    fetched.push(String(input))
    assert.equal(init?.redirect, 'manual')
    assert.equal(init?.credentials, 'omit')
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }
  // No edge cache is read or written: an article body must not outlive the request.
  vi.stubGlobal('caches', { default: { match: async () => { throw new Error('cache read') }, put: async () => { throw new Error('cache write') } } })
  const response = await onRequest({ request: new Request(endpoint('https://indianexpress.com/article/explained/a-1/'), { headers: { 'Sec-Fetch-Site': 'same-origin' } }) })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
  assert.equal(response.headers.get('Content-Type'), 'application/json; charset=utf-8')
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff')
  assert.deepEqual(await response.json(), { v: 1, url: 'https://indianexpress.com/article/explained/a-1/', html: '<html><head></head><body><article><p>Body text</p></article></body></html>' })
  assert.deepEqual(fetched, ['https://indianexpress.com/article/explained/a-1/'])
})

test('an unlisted, restricted, malformed or missing address makes no upstream request', async () => {
  globalThis.fetch = async () => { throw new Error('No upstream request is allowed here') }
  const cases: Array<[string, number, string]> = [
    ['https://example.org/article', 403, 'publisher_not_listed'],
    ['https://www.thehindu.com.attacker.example/a', 403, 'publisher_not_listed'],
    ['https://www.ft.com/content/abc', 451, 'publisher_restricted'],
    ['https://www.nytimes.com/2026/10/06/world/a.html', 451, 'publisher_restricted'],
    ['http://127.0.0.1:8787/admin', 400, 'invalid_url'],
    ['https://169.254.169.254/latest/meta-data/', 400, 'invalid_url'],
    ['file:///etc/passwd', 400, 'invalid_url'],
    ['javascript:alert(1)', 400, 'invalid_url'],
  ]
  for (const [target, status, error] of cases) {
    const response = await onRequest({ request: new Request(endpoint(target)) })
    assert.equal(response.status, status, target)
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store')
    assert.deepEqual(await response.json(), { error })
  }
  const missing = await onRequest({ request: new Request('https://tars.example/api/article') })
  assert.equal(missing.status, 400)
  const post = await onRequest({ request: new Request(endpoint('https://www.thehindu.com/a.ece'), { method: 'POST' }) })
  assert.equal(post.status, 405)
  assert.equal(post.headers.get('Allow'), 'GET')
  const foreign = await onRequest({ request: new Request(endpoint('https://www.thehindu.com/a.ece'), { headers: { 'Sec-Fetch-Site': 'cross-site' } }) })
  assert.equal(foreign.status, 403)
  assert.deepEqual(await foreign.json(), { error: 'forbidden_origin' })
})

test('a publisher’s refusal, absence and oversize pages are reported, never worked around', async () => {
  const answer = async (response: () => Response) => {
    let requests = 0
    globalThis.fetch = async () => { requests++; return response() }
    const result = await onRequest({ request: new Request(endpoint('https://www.hindustantimes.com/india-news/a.html')) })
    return { status: result.status, body: await result.json() as { error: string }, requests }
  }
  assert.deepEqual(await answer(() => new Response('', { status: 403 })), { status: 502, body: { error: 'upstream_blocked' }, requests: 1 })
  assert.deepEqual(await answer(() => new Response('', { status: 404 })), { status: 502, body: { error: 'upstream_not_found' }, requests: 1 })
  assert.deepEqual(await answer(() => new Response('', { status: 500 })), { status: 502, body: { error: 'upstream_unavailable' }, requests: 1 })
  assert.deepEqual(await answer(() => new Response('<p>x</p>', { headers: { 'Content-Type': 'text/html', 'Content-Length': String(64 * 1024 * 1024) } })), { status: 502, body: { error: 'too_large' }, requests: 1 })
  assert.deepEqual(await answer(() => new Response(null, { status: 301, headers: { Location: 'https://accounts.example.org/login' } })), { status: 502, body: { error: 'upstream_blocked' }, requests: 1 })
})

test('the route is closed to anyone Access has not signed in', async () => {
  globalThis.fetch = async () => { throw new Error('No request is allowed here') }
  const request = new Request(endpoint('https://www.thehindu.com/a.ece'))
  const next = () => onRequest({ request })
  const unconfigured = await middleware({ request, env: {}, data: {}, next })
  assert.equal(unconfigured.status, 503)
  const anonymous = await middleware({ request, env: { ACCESS_TEAM_DOMAIN: 'team.cloudflareaccess.com', ACCESS_AUD: 'aud' }, data: {}, next })
  assert.equal(anonymous.status, 401)
  assert.deepEqual(await anonymous.json(), { error: 'unauthenticated' })
})
