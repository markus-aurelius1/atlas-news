import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { mkdirSync, writeFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { HighlightRepository } from '@/current-affairs/reader/highlights/repository'
import { parseHighlight, type ReaderHighlight } from '@/current-affairs/reader/highlights/model'
import { createHighlightSync } from '@/sync/highlights-engine'
import { highlightTransport } from '@/sync/highlights-transport'
import { authored, compareHighlights, HIGHLIGHT_BODY_BYTES, HIGHLIGHT_SYNC, highlightValue, parseAuthored, type AuthoredHighlight, type HighlightRequest, type HighlightResponse } from '@/sync/highlights-protocol'
import { forgetAccessKeys } from '@/sync/access'
import { accessIssuer, ORIGIN, service, sqliteD1 } from './sync-fixture'
import { collectExtras, eraseExtras } from '@/data/backup-extras'

const A = 'a@example.org', B = 'b@example.org'
const base = Date.now() - 86_400_000
const record = (id = 'highlight-1', changes: Partial<ReaderHighlight> = {}): ReaderHighlight => parseHighlight({ version: 1, highlightId: id, articleUrl: 'https://indianexpress.com/article/fixture', title: 'Saved title', publisher: 'Indian Express', sourceId: 'ie-explained', publishedAt: '2026-10-01', subjectSnapshot: 'Economy', categorySnapshot: 'Explained', quote: 'a bounded saved passage', anchor: { version: 1, quote: 'a bounded saved passage', prefix: 'before ', suffix: ' after', start: 7, end: 30 }, color: 'yellow', createdAt: base, updatedAt: base, resolution: 'resolved', ...changes })
let issuer: Awaited<ReturnType<typeof accessIssuer>>, server: ReturnType<typeof sqliteD1>, handle: ReturnType<typeof service>
const originalFetch = globalThis.fetch
const repos: HighlightRepository[] = []
beforeAll(async () => { issuer = await accessIssuer(); globalThis.fetch = (async input => issuer.serveCerts(input)) as typeof fetch })
afterAll(async () => { globalThis.fetch = originalFetch; for (const repo of repos) await repo.delete() })
beforeEach(() => { server = sqliteD1(); handle = service(server.d1); forgetAccessKeys() })
async function post(body: unknown, email = A, endpoint = '/api/highlights-sync') {
  return handle(new Request(ORIGIN + endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'Cf-Access-Jwt-Assertion': await issuer.token(email) }, body: JSON.stringify(body) }))
}
const request = (changes: AuthoredHighlight[] = [], cursor = 0, account: string | undefined = A): HighlightRequest => ({ protocol: HIGHLIGHT_SYNC, cursor, ...(account ? { account } : {}), changes })
async function exchange(changes: AuthoredHighlight[] = [], cursor = 0, email = A) {
  const response = await post(request(changes, cursor, email), email)
  expect(response.status).toBe(200)
  return response.json() as Promise<HighlightResponse>
}
function device(email = A, legacy?: string) {
  const factory = new IDBFactory(), repo = new HighlightRepository(undefined, factory)
  repos.push(repo)
  const link = { email, online: true, crash: false, malformed: false }
  const requests: HighlightRequest[] = []
  const transport = highlightTransport(async (_input, init) => {
    if (!link.online) throw new Error('offline')
    const body = JSON.parse(init!.body as string) as HighlightRequest
    requests.push(body)
    const response = await post(body, link.email)
    if (link.crash) { link.crash = false; throw new Error('Lost response after server commit') }
    if (link.malformed) { link.malformed = false; const raw = await response.json(); raw.rows.push({ ...authored(record('bad')), body: '<html>forbidden</html>' }); return Response.json(raw) }
    return response
  })
  const engine = createHighlightSync({ repository: repo, transport, linkedAccount: async () => legacy })
  return { repo, factory, engine, link, requests }
}
const cloudRows = () => server.sqlite.prepare('SELECT value FROM highlight_sync_records ORDER BY highlight_id').all().map(r => JSON.parse(r.value as string) as AuthoredHighlight)

it('discovers pre-H3 records without changing IDs, timestamps or snapshots; empty new device downloads everything', async () => {
  const a = device(), b = device()
  const local = record()
  await a.repo.records.put(local)
  expect((await a.engine.sync()).state).toBe('synced')
  expect(a.requests[0].changes).toEqual([])
  expect(a.requests[1].account).toBe(A)
  expect(cloudRows()).toEqual([authored(local)])
  expect(await a.repo.records.get(local.highlightId)).toEqual(local)
  await b.engine.sync()
  expect(authored((await b.repo.records.get(local.highlightId))!)).toEqual(authored(local))
  expect((await b.repo.records.get(local.highlightId))!.resolution).toBe('pending')
  expect(b.requests.every(r => r.changes.length === 0)).toBe(true)
})

it('recolor and delete propagate; stale/offline edits with a later clock cannot resurrect; rehighlight has a new ID', async () => {
  const a = device(), b = device()
  await a.repo.records.put(record()); await a.engine.sync(); await b.engine.sync()
  await b.repo.recolor('highlight-1', 'blue'); await b.engine.sync(); await a.engine.sync()
  expect((await a.repo.readAll())[0].color).toBe('blue')
  b.link.online = false
  const stale = (await b.repo.records.get('highlight-1'))!
  await a.repo.remove('highlight-1'); await a.engine.sync()
  await b.repo.records.put({ ...stale, color: 'pink', updatedAt: Date.now() + 1000 })
  expect((await b.engine.sync()).state).toBe('offline')
  b.link.online = true; await b.engine.sync(); await a.engine.sync()
  expect(await b.repo.readAll()).toEqual([])
  expect(cloudRows()[0].deletedAt).toBeDefined()
  const fresh = await b.repo.create({ ...stale }, { quote: stale.quote, anchor: stale.anchor }, 'green', 'before a bounded saved passage after')
  expect(fresh.record.highlightId).not.toBe(stale.highlightId)
  await b.engine.sync(); await a.engine.sync()
  expect((await a.repo.readAll()).map(r => r.highlightId)).toEqual([fresh.record.highlightId])
})

it('equal-time recolors converge regardless of arrival order, including Unicode tie values', async () => {
  for (const [id, title] of [['tie-1', '\u{1f600}'], ['tie-2', '\ue000']]) {
    const x = authored(record(id, { color: 'blue', title })), y = authored(record(id, { color: 'pink', title: 'z' }))
    const winner = compareHighlights(x, y) > 0 ? x : y
    await exchange([x]); await exchange([y]); await exchange([x])
    expect(cloudRows().find(r => r.highlightId === id)).toEqual(winner)
  }
  const a = device(), b = device()
  await a.engine.sync(); await b.engine.sync()
  await a.repo.records.put(record('offline-tie', { color: 'green' }))
  await b.repo.records.put(record('offline-tie', { color: 'orange' }))
  await b.engine.sync(); await a.engine.sync(); await b.engine.sync()
  expect(await a.repo.backup()).toEqual(await b.repo.backup())
})

it('terminal tombstones win even when their timestamp is earlier; equal-time delete conflicts are deterministic', async () => {
  const live = authored(record('terminal', { updatedAt: base + 9000 }))
  const gone = authored(record('terminal', { updatedAt: base + 1, deletedAt: base + 1 }))
  await exchange([live]); await exchange([gone]); await exchange([live])
  expect(cloudRows()).toEqual([gone])
  const other = { ...gone, color: 'pink' as const }
  await exchange([other]); await exchange([gone])
  expect(cloudRows()).toEqual([compareHighlights(gone, other) > 0 ? gone : other])
})

it('legacy clients before/after Highlights advance only their own cursor and cannot consume highlights', async () => {
  const legacy = async (cursor: number, at: number) => {
    const res = await post({ v: 1, cursor, account: A, changes: [{ c: 'news', k: 'readAt:https://example.org/a', v: String(at), t: at, d: 0 }] }, A, '/api/sync')
    expect(res.status).toBe(200); return res.json() as Promise<{ cursor: number; rows: { c: string }[] }>
  }
  const first = await legacy(0, base)
  await exchange([authored(record('h1'))])
  const second = await legacy(first.cursor, base + 1)
  await exchange([authored(record('h2'))])
  const third = await legacy(second.cursor, base + 2)
  expect(third.cursor).toBeGreaterThan(second.cursor)
  expect([...first.rows, ...second.rows, ...third.rows].every(r => r.c !== 'highlight')).toBe(true)
  const highlights = await exchange([], 0)
  expect(highlights.rows.map(r => r.highlightId)).toEqual(['h1', 'h2'])
  expect(server.sqlite.prepare('SELECT seq FROM sync_users WHERE user_id = ?').get(A)!.seq).toBe(third.cursor)
  expect(server.sqlite.prepare('SELECT COUNT(*) AS n FROM sync_records').get()!.n).toBe(1)
  const unknown = await post({ v: 1, cursor: 0, changes: [{ c: 'highlight', k: 'h3', v: '{}', t: base, d: 0 }] }, A, '/api/sync')
  expect(unknown.status).toBe(400)
})

it('account A → B never cross-uploads, including unsent local edits and resetting legacy link', async () => {
  const a = device()
  await a.repo.records.put(record()); await a.engine.sync()
  await a.repo.recolor('highlight-1', 'orange')
  a.link.email = B
  expect((await a.engine.sync()).state).toBe('mismatch')
  expect(await a.repo.syncOutbox.count()).toBe(1)
  expect(server.sqlite.prepare('SELECT COUNT(*) AS n FROM highlight_sync_records WHERE user_id = ?').get(B)!.n).toBe(0)
  expect((await a.repo.readAll())[0].color).toBe('orange')
  await a.repo.resetHighlightSync()
  expect((await a.engine.sync()).state).toBe('mismatch')
  a.link.email = A; await a.engine.sync()
  expect(cloudRows()[0].color).toBe('orange')
})

it('pre-H3 library inherits existing legacy account guard before its first write; separate profiles isolate B', async () => {
  const a = device(B, A)
  await a.repo.records.put(record('legacy-A'))
  expect((await a.engine.sync()).state).toBe('mismatch')
  expect(a.requests.every(r => !r.changes.length)).toBe(true)
  expect(cloudRows()).toEqual([])
  a.link.email = A; await a.engine.sync()
  const b = device(B)
  await b.engine.sync(); expect(await b.repo.readAll()).toEqual([])
  await b.repo.records.put(record('only-B')); await b.engine.sync(); await a.engine.sync()
  expect((await a.repo.readAll()).map(r => r.highlightId)).toEqual(['legacy-A'])
  expect((await b.repo.readAll()).map(r => r.highlightId)).toEqual(['only-B'])
})

it('logout/offline retains excerpts and outbox; network retry is idempotent after server success + lost response', async () => {
  const a = device(); await a.engine.sync()
  await a.repo.records.put(record())
  a.link.online = false
  expect((await a.engine.sync()).state).toBe('offline')
  expect(await a.repo.syncOutbox.count()).toBe(1)
  a.link.online = true; a.link.crash = true
  expect((await a.engine.sync()).state).toBe('offline')
  expect(cloudRows()).toHaveLength(1); expect(await a.repo.syncOutbox.count()).toBe(1)
  await a.engine.sync(); await a.engine.sync()
  expect(await a.repo.syncOutbox.count()).toBe(0); expect(cloudRows()).toHaveLength(1)
  const seq = server.sqlite.prepare('SELECT seq FROM highlight_sync_records').get()!.seq
  await exchange([authored(record())]); await exchange([authored(record())])
  expect(server.sqlite.prepare('SELECT seq FROM highlight_sync_records').get()!.seq).toBe(seq)
  const noToken = await handle(new Request(ORIGIN + '/api/highlights-sync', { method: 'POST', body: '{}' }))
  expect(noToken.status).toBe(401)
})

it('failure applying a remote page rolls back rows, versions, acknowledgements, binding and cursor together', async () => {
  await exchange([authored(record('first')), authored(record('second'))])
  const a = device()
  const fail = (_key: unknown, row: ReaderHighlight) => { if (row.highlightId === 'second') throw new Error('Simulated disk failure') }
  a.repo.records.hook('creating', fail)
  await expect(a.engine.sync()).rejects.toThrow('Simulated disk failure')
  expect(await a.repo.records.count()).toBe(0)
  expect(await a.repo.syncRows.count()).toBe(0)
  expect(await a.repo.syncMeta.get('meta')).toBeUndefined()
  a.repo.records.hook('creating').unsubscribe(fail)
  await a.engine.sync()
  expect(await a.repo.records.count()).toBe(2)
  expect((await a.repo.syncMeta.get('meta'))!.cursor).toBeGreaterThan(0)
})

it('malformed remote records stop the whole page without advancing cursor or corrupting local data', async () => {
  await exchange([authored(record())])
  const a = device(); a.link.malformed = true
  expect((await a.engine.sync()).state).toBe('error')
  expect(await a.repo.records.count()).toBe(0); expect(await a.repo.syncMeta.count()).toBe(0)
  await a.engine.sync(); expect(await a.repo.records.count()).toBe(1)
})

it('remote application preserves local resolution and an edit made during an in-flight exchange', async () => {
  const a = device()
  await a.repo.records.put(record()); await a.engine.sync()
  await a.repo.setResolution([{ highlightId: 'highlight-1', resolution: 'unresolved' }])
  const remote = authored(record('highlight-1', { color: 'blue', updatedAt: base + 100 }))
  await exchange([remote])
  await a.engine.sync()
  expect((await a.repo.records.get('highlight-1'))!.resolution).toBe('unresolved')
  let changed = false
  const racing = createHighlightSync({ repository: a.repo, transport: async req => {
    const res = await exchange(req.changes, req.cursor)
    if (!changed) { changed = true; await a.repo.recolor('highlight-1', 'orange') }
    return { ok: true, response: res }
  } })
  await racing.sync()
  expect(cloudRows()[0].color).toBe('orange')
  expect(await a.repo.syncOutbox.count()).toBe(0)
})

it('resolution, availability, preview and missing News articles generate no authored writes or echo', async () => {
  const a = device(), b = device()
  await a.repo.records.put(record()); await a.engine.sync(); await b.engine.sync()
  const n = a.requests.length, m = b.requests.length, writes = server.totals.rowsWritten
  await a.repo.setResolution([{ highlightId: 'highlight-1', resolution: 'unresolved' }])
  const availability = new Map([['article', 'unavailable']]), preview = { range: 'memory only' }
  expect(availability.size + Object.keys(preview).length).toBe(2)
  await a.engine.sync({ onlyIfChanged: true }); await b.engine.sync({ onlyIfChanged: true })
  expect(a.requests).toHaveLength(n); expect(b.requests).toHaveLength(m)
  expect(server.totals.rowsWritten).toBe(writes)
  expect(cloudRows()[0]).not.toHaveProperty('resolution')
  expect(JSON.stringify(a.requests)).not.toMatch(/resolution|availability|range|<html>/)
  expect((await a.repo.readAll())[0].deletedAt).toBeUndefined()
})

it('backups contain only records; restore triggers upload, terminal IDs survive merge/replace, explicit erase keeps binding', async () => {
  const a = device()
  await a.repo.records.put(record()); await a.engine.sync()
  const extras = await collectExtras({ indexedDB: a.factory })
  expect(Object.keys(extras)).toEqual(['readerHighlights'])
  expect(JSON.stringify(extras)).not.toMatch(/cursor|syncRows|syncOutbox|account/)
  await a.repo.remove('highlight-1'); await a.engine.sync()
  await a.repo.restore([record()], 'merge')
  expect(await a.repo.readAll()).toEqual([])
  await a.repo.restore([record(), record('imported')], 'replace')
  expect((await a.repo.readAll()).map(r => r.highlightId)).toEqual(['imported'])
  await a.engine.sync(); expect(cloudRows().find(r => r.highlightId === 'imported')).toBeDefined()
  await eraseExtras({ indexedDB: a.factory })
  expect(await a.repo.records.count()).toBe(0)
  expect((await a.repo.syncMeta.get('meta'))!.account).toBe(A)
  a.link.email = B
  expect((await a.engine.sync()).state).toBe('mismatch')
  expect(await a.repo.records.count()).toBe(0)
})

it('strict authored allowlist rejects bodies/HTML/unknown/nested fields, oversized and malformed values', async () => {
  const valid = authored(record())
  for (const bad of [
    { ...valid, body: 'article' }, { ...valid, extractedHtml: '<p>body</p>' }, { ...valid, resolution: 'resolved' }, { ...valid, availability: 'available' }, { ...valid, anchor: { ...valid.anchor, range: {} } },
    { ...valid, quote: 'x'.repeat(10001) }, { ...valid, anchor: { ...valid.anchor, prefix: 'x'.repeat(65) } }, { ...valid, articleUrl: 'javascript:alert(1)' }, { ...valid, articleUrl: 'https://user:password@example.org/' },
    { ...valid, updatedAt: base - 1 }, { ...valid, deletedAt: base + 1 }, { ...valid, version: 2 }, { ...valid, color: 'red' },
  ]) {
    expect(() => parseAuthored(bad)).toThrow()
    expect((await post(request([bad as AuthoredHighlight]))).status).toBe(400)
  }
  expect((await post({ ...request([valid]), user_id: B })).status).toBe(400)
  expect((await post({ protocol: HIGHLIGHT_SYNC, cursor: 0, changes: [valid] })).status).toBe(400)
  expect((await post(request(Array.from({ length: 101 }, (_, i) => authored(record(String(i))))))).status).toBe(400)
  expect((await post({ ...request(), padding: 'x'.repeat(HIGHLIGHT_BODY_BYTES) })).status).toBe(413)
  expect((await post(request([authored(record('future', { updatedAt: Date.now() + 1_000_000 }))]))).status).toBe(422)
  expect(cloudRows()).toEqual([])
})

it.each([100, 1000])('bounded %i-record first sync and one-record incremental sync', async count => {
  const a = device(), b = device()
  await a.repo.records.bulkPut(Array.from({ length: count }, (_, i) => record(`perf-${String(i).padStart(4, '0')}`)))
  const start = performance.now(); await a.engine.sync(); const uploaded = performance.now()
  await b.engine.sync(); const downloaded = performance.now()
  expect(await b.repo.records.count()).toBe(count)
  const before = a.requests.length
  await a.repo.recolor('perf-0000', 'blue')
  const incremental = performance.now(); await a.engine.sync(); await b.engine.sync(); const end = performance.now()
  expect(a.requests.slice(before).reduce((n, r) => n + r.changes.length, 0)).toBe(1)
  expect(a.requests.every(r => r.changes.length <= 100 && new TextEncoder().encode(JSON.stringify(r)).length <= HIGHLIGHT_BODY_BYTES)).toBe(true)
  expect((await b.repo.records.get('perf-0000'))!.color).toBe('blue')
  const metrics = { count, uploadMs: Math.round(uploaded - start), downloadMs: Math.round(downloaded - uploaded), incrementalBothMs: Math.round(end - incremental), uploadRequests: before, downloadRequests: b.requests.length - 1 }
  mkdirSync('tools/browser/out/h3', { recursive: true })
  writeFileSync(`tools/browser/out/h3/performance-${count}.json`, JSON.stringify(metrics, null, 2) + '\n')
}, 30000)

it('upgrades a genuine v1 database additively without rewriting highlights', async () => {
  const { default: Dexie } = await import('dexie')
  const factory = new IDBFactory(), old = new Dexie('tars-reader-highlights', { indexedDB: factory, IDBKeyRange: globalThis.IDBKeyRange })
  old.version(1).stores({ records: 'highlightId, articleUrl, updatedAt' })
  await old.table('records').put(record()); old.close()
  const repo = new HighlightRepository(undefined, factory); repos.push(repo)
  expect(await repo.backup()).toEqual([record()])
  expect(await repo.syncOutbox.count()).toBe(0)
  const engine = createHighlightSync({ repository: repo })
  expect(await engine.scan()).toBe(1)
  expect(highlightValue(authored(record()))).not.toContain('resolution')
})

it('account change between the initial read-only bind and first upload refuses all authored writes', async () => {
  const a = device()
  await a.repo.records.put(record())
  const engine = createHighlightSync({ repository: a.repo, transport: async req => {
    const response = await post(req, req.changes.length ? B : A)
    return response.status === 409 ? { ok: false, reason: 'mismatch' } : { ok: true, response: await response.json() }
  } })
  expect((await engine.sync()).state).toBe('mismatch')
  expect((await a.repo.syncMeta.get('meta'))!.account).toBe(A)
  expect(cloudRows()).toEqual([])
  expect(await a.repo.syncOutbox.count()).toBe(1)
})

it('remote apply failure after server acceptance keeps the authored outbox and retries safely', async () => {
  const a = device(); await a.engine.sync()
  await a.repo.records.put(record('mine'))
  await exchange([authored(record('remote'))])
  const cursor = (await a.repo.syncMeta.get('meta'))!.cursor
  const fail = (_key: unknown, row: ReaderHighlight) => { if (row.highlightId === 'remote') throw new Error('Apply interrupted') }
  a.repo.records.hook('creating', fail)
  await expect(a.engine.sync()).rejects.toThrow('Apply interrupted')
  expect(await a.repo.syncOutbox.count()).toBe(1)
  expect((await a.repo.syncMeta.get('meta'))!.cursor).toBe(cursor)
  expect(cloudRows()).toHaveLength(2)
  a.repo.records.hook('creating').unsubscribe(fail)
  await a.engine.sync()
  expect(await a.repo.records.count()).toBe(2); expect(await a.repo.syncOutbox.count()).toBe(0)
})

it('large multibyte excerpts chunk by UTF-8 bytes as well as row count and all pages converge', async () => {
  const a = device(), b = device(), quote = 'म'.repeat(9000)
  await a.repo.records.bulkPut(Array.from({ length: 25 }, (_, i) => record(`large-${i}`, { quote, anchor: { version: 1, quote, prefix: 'before ', suffix: ' after', start: 7, end: 9007 } })))
  await a.engine.sync(); await b.engine.sync()
  expect(await b.repo.records.count()).toBe(25)
  expect(a.requests.filter(r => r.changes.length).length).toBeGreaterThan(1)
  expect(a.requests.every(r => new TextEncoder().encode(JSON.stringify(r)).length <= HIGHLIGHT_BODY_BYTES)).toBe(true)
  expect(cloudRows().every(r => r.quote === quote)).toBe(true)
}, 30000)

it('a bounded run with remote pages remaining continues even with no authored outbox', async () => {
  for (let i = 0; i < 3; i++) await exchange(Array.from({ length: 100 }, (_, j) => authored(record(`page-${i}-${j}`))))
  const a = device(), transport = highlightTransport(async (_input, init) => post(JSON.parse(init!.body as string)))
  const engine = createHighlightSync({ repository: a.repo, transport, maxRounds: 1 })
  const first = await engine.sync()
  expect(first.state === 'synced' && first.more).toBe(true)
  expect(await a.repo.syncOutbox.count()).toBe(0)
  await engine.sync({ onlyIfChanged: true }); await engine.sync({ onlyIfChanged: true })
  expect(await a.repo.records.count()).toBe(300)
  expect((await engine.sync({ onlyIfChanged: true })).state).toBe('local')
})
