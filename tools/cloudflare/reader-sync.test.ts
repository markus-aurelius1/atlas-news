/** The smry.ai count: unique articles per local day, the same on every device of the account, through the real sync functions and schema. */
import 'fake-indexeddb/auto'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import assert from 'node:assert/strict'
import { afterAll, beforeAll, beforeEach, it as test } from 'vitest'
import { SMRY_KEY, SMRY_MAX_URLS, localDay, parseSmry, readSmry, recordSmry, shiftLocalDay, smryCount, smryUrl } from '@/current-affairs/reader/elsewhere'
import { forgetAccessKeys } from '@/sync/access'
import { readerAdapter } from '@/sync/adapters'
import { createSyncEngine } from '@/sync/engine'
import { COLLECTIONS, type SyncRow } from '@/sync/protocol'
import { SyncStore } from '@/sync/store'
import { fetchTransport } from '@/sync/transport'
import { accessIssuer, ORIGIN, service, sqliteD1 } from './sync-fixture.ts'

const originalFetch = globalThis.fetch
let issuer: Awaited<ReturnType<typeof accessIssuer>>
let server: ReturnType<typeof sqliteD1>, handle: ReturnType<typeof service>
let devices = 0
beforeAll(async () => {
  issuer = await accessIssuer()
  globalThis.fetch = (async (input: unknown) => issuer.serveCerts(input)) as typeof fetch
})
afterAll(() => { globalThis.fetch = originalFetch })
beforeEach(() => { server = sqliteD1(); handle = service(server.d1); forgetAccessKeys() })

const USER = 'reader@example.org'
const A = 'https://www.thehindu.com/a.ece', B = 'https://indianexpress.com/article/b-2/', C = 'https://www.ft.com/content/c'

function device(email = USER) {
  const map = new Map<string, string>(), events: string[] = []
  const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) }
  const store = new SyncStore(`reader-device-${++devices}`, { indexedDB: new IDBFactory(), IDBKeyRange })
  const transport = fetchTransport(async (input, init) => handle(new Request(ORIGIN + String(input), { method: init?.method, body: init?.body as string, headers: { ...(init?.headers as Record<string, string>), Origin: ORIGIN, 'Cf-Access-Jwt-Assertion': await issuer.token(email) } })))
  const engine = createSyncEngine({ store, adapters: [readerAdapter({ storage, notify: (what) => void events.push(what) })], transport })
  return { storage, engine, events, open: (url: string) => recordSmry(storage, url), count: () => smryCount(readSmry(storage)) }
}
const remote = () => server.sqlite.prepare("SELECT key AS k, value AS v, deleted AS d FROM sync_records WHERE collection = 'reader' ORDER BY key").all().map((r) => ({ ...r })) as unknown as Pick<SyncRow, 'k' | 'v' | 'd'>[]

test('the link is the one asked for', () => {
  assert.equal(smryUrl(A), 'https://smry.ai/https://www.thehindu.com/a.ece')
  assert.ok((COLLECTIONS as readonly string[]).includes('reader'))
})

test('an article counts once a day however often it is opened, and the count starts again on the next local day', () => {
  const map = new Map<string, string>(), storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) }
  const monday = new Date(2026, 9, 5, 23, 50), tuesday = new Date(2026, 9, 6, 0, 10)
  recordSmry(storage, A, monday); recordSmry(storage, A, monday); recordSmry(storage, B, monday)
  assert.equal(smryCount(readSmry(storage), monday), 2)
  // Ten minutes later it is another day here: nothing has been opened yet.
  assert.equal(smryCount(readSmry(storage), tuesday), 0)
  recordSmry(storage, A, tuesday)
  assert.equal(smryCount(readSmry(storage), tuesday), 1)
  assert.deepEqual(Object.keys(readSmry(storage).days).sort(), ['2026-10-05', '2026-10-06'])
  // Two days on, the old days are gone from the device.
  recordSmry(storage, C, new Date(2026, 9, 8, 9))
  assert.deepEqual(Object.keys(readSmry(storage).days), ['2026-10-08'])
  assert.equal(localDay(new Date(2026, 0, 3, 0, 0)), '2026-01-03')
  assert.equal(shiftLocalDay('2026-03-01', -1), '2026-02-28')
})

test('stored counts are parsed defensively and bounded', () => {
  assert.deepEqual(parseSmry('{broken'), { version: 1, days: {} })
  assert.deepEqual(parseSmry(JSON.stringify({ version: 1, days: { '2026-10-06': [A, A, 'javascript:alert(1)', 7, B], 'not-a-day': [A] } })), { version: 1, days: { '2026-10-06': [B, A].sort() } })
  const many = Array.from({ length: SMRY_MAX_URLS + 50 }, (_, i) => `https://example.org/${String(i).padStart(4, '0')}`)
  assert.equal(parseSmry(JSON.stringify({ version: 1, days: { '2026-10-06': many } })).days['2026-10-06'].length, SMRY_MAX_URLS)
})

test('two devices of one account agree on the day’s count, whichever opened what', async () => {
  const one = device(), two = device()
  one.open(A); one.open(B)
  two.open(B); two.open(C)
  assert.equal((await one.engine.sync()).state, 'synced')
  // Device two's later set replaces device one's on the server; nothing is lost, because device one still holds its own.
  await two.engine.sync()
  // Device one receives two's set and unites it with its own; its next exchange sends the union, which device two then receives.
  await one.engine.sync()
  assert.equal(one.count(), 3)
  assert.deepEqual(one.events, ['reader'])
  await one.engine.sync()
  await two.engine.sync()
  assert.equal(two.count(), 3)
  assert.deepEqual(JSON.parse(remote()[0].v!), [A, B, C].sort())
  assert.equal(remote().length, 1)
  assert.equal(remote()[0].k, `smry:${localDay()}`)
  // Settled: another round changes nothing and sends nothing.
  const idle = await one.engine.sync() as { sent: number; received: number }
  assert.deepEqual({ sent: idle.sent, received: idle.received }, { sent: 0, received: 0 })
  // A new device starts with the account's count.
  const three = device()
  await three.engine.sync()
  assert.equal(three.count(), 3)
})

test('another account sees none of it, and old days are cleared from the account', async () => {
  const one = device(), stranger = device('other@example.org')
  const old = shiftLocalDay(localDay(), -5)
  one.storage.setItem(SMRY_KEY, JSON.stringify({ version: 1, days: { [localDay()]: [A] } }))
  await one.engine.sync()
  await stranger.engine.sync()
  assert.equal(stranger.count(), 0)
  // A row left from five days ago (written by some device then) is removed the next time a device looks.
  const response = await handle(new Request(`${ORIGIN}/api/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Cf-Access-Jwt-Assertion': await issuer.token(USER) }, body: JSON.stringify({ v: 1, cursor: 0, changes: [{ c: 'reader', k: `smry:${old}`, v: JSON.stringify([B]), t: Date.now() - 5 * 86_400_000, d: 0 }] }) }))
  assert.equal(response.status, 200)
  await one.engine.sync()
  await one.engine.sync()
  assert.equal(one.count(), 1)
  assert.deepEqual(remote().map((r) => [r.k, r.d]), [[`smry:${old}`, 1], [`smry:${localDay()}`, 0]].sort())
})
