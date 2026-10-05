/** The sync service contract: Access identity, account isolation, newest-wins storage and incremental cursors. */
import assert from 'node:assert/strict'
import { afterAll, beforeAll, beforeEach, it as test } from 'vitest'
import { onRequest as session } from '../../functions/api/session.ts'
import { forgetAccessKeys } from '../../src/sync/access.ts'
import { MAX_PULL_ROWS, MAX_PUSH_ROWS, type SyncResponse, type SyncRow } from '../../src/sync/protocol.ts'
import { accessIssuer, AUD, ENV, ISSUER, ORIGIN, service, sqliteD1 } from './sync-fixture.ts'

const originalFetch = globalThis.fetch
let issuer: Awaited<ReturnType<typeof accessIssuer>>, certRequests = 0
let store: ReturnType<typeof sqliteD1>, handle: ReturnType<typeof service>
beforeAll(async () => {
  issuer = await accessIssuer()
  globalThis.fetch = (async (input: unknown) => { certRequests++; return issuer.serveCerts(input) }) as typeof fetch
})
afterAll(() => { globalThis.fetch = originalFetch })
beforeEach(() => { store = sqliteD1(); handle = service(store.d1); forgetAccessKeys(); certRequests = 0 })

const row = (k: string, t: number, v: unknown = t, c: SyncRow['c'] = 'news'): SyncRow => ({ c, k, v: JSON.stringify(v), t, d: 0 })
const gone = (k: string, t: number, c: SyncRow['c'] = 'news'): SyncRow => ({ c, k, v: null, t, d: 1 })
const A = 'readAt:https://example.org/a', B = 'savedAt:https://example.org/b'

async function post(email: string | null, body: unknown, init: { headers?: Record<string, string>; token?: string; method?: string } = {}) {
  const token = init.token ?? (email ? await issuer.token(email) : undefined)
  return handle(new Request(`${ORIGIN}/api/sync`, { method: init.method ?? 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, ...(token ? { 'Cf-Access-Jwt-Assertion': token } : {}), ...init.headers }, ...(init.method === 'GET' ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) }))
}
async function exchange(email: string, cursor: number, changes: SyncRow[] = [], account?: string) {
  const response = await post(email, { v: 1, cursor, changes, ...(account ? { account } : {}) })
  assert.equal(response.status, 200, await response.clone().text())
  return { body: (await response.json()) as SyncResponse, usage: response.headers.get('X-Tars-Sync-Usage') }
}
const error = async (response: Response) => ({ status: response.status, code: ((await response.json()) as { error: string }).error })

test('only a valid Access token opens the route; nothing is read or written otherwise', async () => {
  assert.deepEqual(await error(await post(null, { v: 1, cursor: 0, changes: [row(A, 10)] })), { status: 401, code: 'unauthenticated' })
  const now = Math.floor(Date.now() / 1000)
  const forged = await (await accessIssuer()).token('reader@example.org')
  const tampered = (await issuer.token('reader@example.org')).replace(/\.[^.]+\./, `.${Buffer.from(JSON.stringify({ iss: ISSUER, aud: [AUD], email: 'victim@example.org', exp: now + 600 })).toString('base64url')}.`)
  const unsigned = `${Buffer.from(JSON.stringify({ alg: 'none', kid: 'fixture-key' })).toString('base64url')}.${Buffer.from(JSON.stringify({ iss: ISSUER, aud: [AUD], email: 'reader@example.org', exp: now + 600 })).toString('base64url')}.`
  const refused: Record<string, string> = {
    'signed by another key': forged,
    'payload changed after signing': tampered,
    'no signature': unsigned,
    'another application': await issuer.token('reader@example.org', { aud: ['some-other-app'] }),
    'another issuer': await issuer.token('reader@example.org', { iss: 'https://elsewhere.cloudflareaccess.test' }),
    expired: await issuer.token('reader@example.org', { exp: now - 3600 }),
    'not yet valid': await issuer.token('reader@example.org', { nbf: now + 3600 }),
    'service token without a user': await issuer.token('reader@example.org', { email: undefined, common_name: 'svc' }),
    'unknown key id': await issuer.token('reader@example.org', {}, { kid: 'rotated-away' }),
    garbage: 'not.a.token',
  }
  for (const [name, token] of Object.entries(refused)) assert.deepEqual(await error(await post(null, { v: 1, cursor: 0, changes: [row(A, 10)] }, { token })), { status: 401, code: 'unauthenticated' }, name)
  assert.equal(store.totals.queries, 0)
  // The same token arrives as the Access cookie on requests without the header.
  const cookie = await handle(new Request(`${ORIGIN}/api/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: `other=1; CF_Authorization=${await issuer.token('reader@example.org')}` }, body: JSON.stringify({ v: 1, cursor: 0, changes: [] }) }))
  assert.equal(cookie.status, 200)
})

test('without Access configuration every API route stays closed', async () => {
  for (const env of [{}, { ACCESS_TEAM_DOMAIN: ISSUER }, { ACCESS_AUD: AUD }, { ACCESS_TEAM_DOMAIN: ' ', ACCESS_AUD: ' , ' }]) {
    const closed = service(store.d1, env)
    const response = await closed(new Request(`${ORIGIN}/api/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Cf-Access-Jwt-Assertion': await issuer.token('reader@example.org') }, body: '{}' }))
    assert.deepEqual(await error(response), { status: 503, code: 'access_not_configured' })
  }
  assert.equal(store.totals.queries, 0)
})

test('the account is the token’s email: a body cannot name another, and accounts never see each other', async () => {
  await exchange('Reader@Example.org', 0, [row(A, 10)])
  // A claimed account that is not the signed-in one is refused before any query.
  const before = store.totals.queries
  assert.deepEqual(await error(await post('intruder@example.org', { v: 1, cursor: 0, account: 'reader@example.org', changes: [gone(A, 99)] })), { status: 409, code: 'account_mismatch' })
  assert.equal(store.totals.queries, before)
  // Extra identity fields are ignored, not trusted.
  const smuggled = await post('intruder@example.org', { v: 1, cursor: 0, changes: [row(B, 20)], user: 'reader@example.org', email: 'reader@example.org', user_id: 'reader@example.org' })
  assert.equal(((await smuggled.json()) as SyncResponse).account, 'intruder@example.org')
  assert.deepEqual((await exchange('intruder@example.org', 0)).body.rows.map(r => r.k), [B])
  const reader = await exchange('reader@example.org', 0)
  assert.equal(reader.body.account, 'reader@example.org')
  assert.deepEqual(reader.body.rows, [row(A, 10)])
  assert.deepEqual(store.sqlite.prepare('SELECT user_id, key FROM sync_records ORDER BY user_id').all().map(r => ({ ...r })), [{ user_id: 'intruder@example.org', key: B }, { user_id: 'reader@example.org', key: A }])
})

test('the newer change wins, a tie keeps what is stored, and a deletion is a change like any other', async () => {
  const user = 'reader@example.org'
  await exchange(user, 0, [row(A, 100, 100), row(B, 100, 100)])
  await exchange(user, 0, [row(A, 90, 90)])
  assert.deepEqual((await exchange(user, 0)).body.rows.find(r => r.k === A), row(A, 100, 100), 'an older change is ignored')
  await exchange(user, 0, [row(A, 100, 'tie')])
  assert.deepEqual((await exchange(user, 0)).body.rows.find(r => r.k === A), row(A, 100, 100), 'an equal time keeps the stored row')
  await exchange(user, 0, [gone(A, 150)])
  assert.deepEqual((await exchange(user, 0)).body.rows.find(r => r.k === A), gone(A, 150), 'a newer deletion replaces the value')
  await exchange(user, 0, [row(A, 140, 140)])
  assert.deepEqual((await exchange(user, 0)).body.rows.find(r => r.k === A), gone(A, 150), 'an older value cannot undo a deletion')
  await exchange(user, 0, [row(A, 200, 200)])
  assert.deepEqual((await exchange(user, 0)).body.rows.find(r => r.k === A), row(A, 200, 200), 'a newer value restores it')
  assert.equal(Number(store.sqlite.prepare('SELECT count(*) AS n FROM sync_records').get()!.n), 2, 'one row per key, tombstones included')
})

test('a device reads only what it has not seen, through the cursor index', async () => {
  const user = 'reader@example.org'
  const first = await exchange(user, 0, [row(A, 10), row(B, 11)])
  assert.deepEqual(first.body.rows, [], 'a device does not get its own rows back')
  assert.equal(first.body.cursor, 2)
  const idle = await exchange(user, first.body.cursor)
  assert.deepEqual({ rows: idle.body.rows, cursor: idle.body.cursor, more: idle.body.more }, { rows: [], cursor: 2, more: false })
  assert.equal(idle.usage, 'queries=1;read=0;written=0', 'nothing new costs one indexed query and no write')
  // Another device changes one key; the first receives exactly that row.
  const other = await exchange(user, 0, [row(A, 20)])
  assert.deepEqual(other.body.rows.map(r => r.k).sort(), [A, B].sort())
  const next = await exchange(user, first.body.cursor)
  assert.deepEqual(next.body.rows, [row(A, 20)])
  assert.equal(next.usage, 'queries=1;read=1;written=0')
  assert.equal((await exchange(user, next.body.cursor)).body.rows.length, 0)
  const plan = store.sqlite.prepare('EXPLAIN QUERY PLAN SELECT collection, key, value, updated_at, deleted, seq FROM sync_records WHERE user_id = ?1 AND seq > ?2 ORDER BY seq LIMIT ?3').all('u', 0, 10).map(r => String(r.detail)).join(' | ')
  assert.match(plan, /SEARCH sync_records USING INDEX sync_records_cursor \(user_id=\? AND seq>\?\)/)
  assert.doesNotMatch(plan, /SCAN|TEMP B-TREE/, 'no table scan and no sort')
})

test('a large history is paged, and a full push is one statement', async () => {
  const user = 'reader@example.org', total = MAX_PULL_ROWS * 2 + 30
  for (let from = 0; from < total; from += MAX_PUSH_ROWS) {
    const before = store.totals.queries
    await exchange(user, 0, Array.from({ length: Math.min(MAX_PUSH_ROWS, total - from) }, (_, i) => row(`id-${from + i}`, 1000 + from + i, { n: from + i }, 'recall')))
    assert.equal(store.totals.queries - before, 5, 'ensure account, read, write, advance, head')
  }
  const seen: string[] = []
  let cursor = 0, pages = 0
  for (;;) {
    const { body } = await exchange(user, cursor)
    seen.push(...body.rows.map(r => r.k)); cursor = body.cursor; pages++
    assert.ok(body.rows.length <= MAX_PULL_ROWS)
    if (!body.more) break
  }
  assert.equal(pages, 3)
  assert.equal(new Set(seen).size, total)
  assert.equal(seen.length, total, 'no row twice, none skipped')
})

test('malformed, oversized, future-dated, cross-site and non-POST requests are refused without touching storage', async () => {
  const user = 'reader@example.org', far = Date.now() + 3600_000
  const cases: Array<[string, Promise<Response>, number, string]> = [
    ['unknown collection', post(user, { v: 1, cursor: 0, changes: [{ c: 'tasks', k: 'x', v: '1', t: 1, d: 0 }] }), 400, 'bad_request'],
    ['wrong version', post(user, { v: 2, cursor: 0, changes: [] }), 400, 'bad_request'],
    ['negative cursor', post(user, { v: 1, cursor: -1, changes: [] }), 400, 'bad_request'],
    ['value on a tombstone', post(user, { v: 1, cursor: 0, changes: [{ c: 'news', k: A, v: '1', t: 1, d: 1 }] }), 400, 'bad_request'],
    ['a key twice', post(user, { v: 1, cursor: 0, changes: [row(A, 1), row(A, 2)] }), 400, 'bad_request'],
    ['not JSON', post(user, '{'), 400, 'bad_request'],
    ['form content type', post(user, { v: 1, cursor: 0, changes: [] }, { headers: { 'Content-Type': 'text/plain' } }), 400, 'bad_request'],
    ['too many rows', post(user, { v: 1, cursor: 0, changes: Array.from({ length: MAX_PUSH_ROWS + 1 }, (_, i) => row(`k${i}`, 1)) }), 413, 'too_large'],
    ['oversized value', post(user, { v: 1, cursor: 0, changes: [row(A, 1, 'x'.repeat(40_000))] }), 413, 'too_large'],
    ['a clock far ahead', post(user, { v: 1, cursor: 0, changes: [row(A, far)] }), 422, 'clock_skew'],
    ['another site’s page', post(user, { v: 1, cursor: 0, changes: [row(A, 1)] }, { headers: { Origin: 'https://evil.example' } }), 403, 'forbidden_origin'],
    ['a cross-site fetch', post(user, { v: 1, cursor: 0, changes: [row(A, 1)] }, { headers: { 'Sec-Fetch-Site': 'cross-site' } }), 403, 'forbidden_origin'],
    ['GET', post(user, null, { method: 'GET' }), 405, 'method_not_allowed'],
  ]
  for (const [name, response, status, code] of cases) assert.deepEqual(await error(await response), { status, code }, name)
  assert.equal(store.totals.queries, 0)
  const unbound = await service(undefined as never)(new Request(`${ORIGIN}/api/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Cf-Access-Jwt-Assertion': await issuer.token(user) }, body: JSON.stringify({ v: 1, cursor: 0, changes: [] }) }))
  assert.deepEqual(await error(unbound), { status: 503, code: 'storage_not_configured' })
})

test('the signing keys are fetched once and reused', async () => {
  for (let i = 0; i < 5; i++) await exchange('reader@example.org', 0)
  assert.equal(certRequests, 1)
  assert.deepEqual(ENV, { ACCESS_TEAM_DOMAIN: ISSUER, ACCESS_AUD: AUD })
})

test('the sign-in route only ever returns to the app', () => {
  const response = session({ request: new Request(`${ORIGIN}/api/session?next=https://evil.example`) })
  assert.equal(response.status, 302)
  assert.equal(response.headers.get('Location'), `${ORIGIN}/`)
  assert.equal(response.headers.get('Cache-Control'), 'no-store')
})
