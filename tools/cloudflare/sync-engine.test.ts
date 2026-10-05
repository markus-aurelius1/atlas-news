/**
 * Devices syncing through the real functions and schema. A device here is what a browser profile is: its own
 * key–value storage, article archive and sync store. The learner database is one per process, so for Atlas
 * history and settings the second device is the same one after its storage has been wiped.
 */
import 'fake-indexeddb/auto'
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb'
import assert from 'node:assert/strict'
import { afterAll, beforeAll, beforeEach, it as test } from 'vitest'
import { ARCHIVE_DB, ARCHIVE_STORE, readArchive, retainArticles } from '@/current-affairs/archive'
import { CA_STATE_KEY, parsePersonalState, patchPersonalState, type PersonalEntry, type PersonalState } from '@/current-affairs/personal-state'
import { isActiveSource } from '@/current-affairs/sources'
import type { NewsItem } from '@/current-affairs/types'
import { eraseEverything, restoreBackup, createBackup } from '@/data/backup'
import { mergePersonalState } from '@/data/backup-extras'
import { CA_NOTES_KEY, parseStickyNotes } from '@/data/compatibility/notes'
import { db } from '@/data/db'
import { updateSettings } from '@/data/hooks'
import { create, remove } from '@/data/repo'
import { ensureSeed } from '@/data/seed'
import { adapters, articleAdapter, newsAdapter, noteAdapter } from '@/sync/adapters'
import { forgetAccessKeys } from '@/sync/access'
import { createSyncEngine, type Transport } from '@/sync/engine'
import { readPinnedArticles } from '@/sync/pinned'
import type { SyncResponse, SyncRow } from '@/sync/protocol'
import { SyncStore, syncStore } from '@/sync/store'
import { fetchTransport } from '@/sync/transport'
import { accessIssuer, ORIGIN, service, sqliteD1 } from './sync-fixture.ts'

const originalFetch = globalThis.fetch
let issuer: Awaited<ReturnType<typeof accessIssuer>>
let server: ReturnType<typeof sqliteD1>, handle: ReturnType<typeof service>
let clock = 0, devices = 0
beforeAll(async () => {
  issuer = await accessIssuer()
  globalThis.fetch = (async (input: unknown) => issuer.serveCerts(input)) as typeof fetch
})
afterAll(() => { globalThis.fetch = originalFetch })
beforeEach(async () => {
  server = sqliteD1(); handle = service(server.d1); forgetAccessKeys()
  // Device time, a month behind the server's real clock so a test can move it forward freely.
  clock = Math.floor(Date.now() / 1000) * 1000 - 30 * 86_400_000
  await db.delete(); await db.open()
  await syncStore().reset()
})

const USER = 'reader@example.org'
const U1 = 'https://example.org/ramsar', U2 = 'https://example.org/monsoon', U3 = 'https://example.org/gst'
const article = (url: string, title: string, sourceId = 'dte-news'): NewsItem => ({ title, url, sourceId, publisher: 'Down To Earth', section: 'Environment', publishedAt: '2026-10-01T04:00:00.000Z', description: 'Feed summary' })
const tick = (ms = 1000) => (clock += ms)

/** The browser's transport, with the Access token the edge would attach. */
function transportFor(email: string, link = { online: true }): Transport {
  return fetchTransport(async (input, init) => {
    if (!link.online) throw new TypeError('Failed to fetch')
    return handle(new Request(ORIGIN + String(input), { method: init?.method, body: init?.body as string, headers: { ...(init?.headers as Record<string, string>), Origin: ORIGIN, 'Cf-Access-Jwt-Assertion': await issuer.token(email) } }))
  })
}

function device(email = USER, withTables = false) {
  const map = new Map<string, string>(), link = { online: true }
  const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) }
  const archive = new IDBFactory()
  const store = withTables ? syncStore() : new SyncStore(`device-${++devices}`, { indexedDB: new IDBFactory(), IDBKeyRange })
  const env = { storage, archive }
  const engine = createSyncEngine({ store, adapters: withTables ? adapters(env) : [newsAdapter(env), articleAdapter(env), noteAdapter(env)], transport: transportFor(email, link), now: () => clock })
  const state = () => parsePersonalState(storage.getItem(CA_STATE_KEY))
  /** What a News action does: patch the stored state for these articles. */
  const mark = (urls: string[], patch: PersonalEntry) => storage.setItem(CA_STATE_KEY, JSON.stringify(patchPersonalState(state(), urls, patch)))
  const seen = (items: NewsItem[]) => retainArticles(items, clock, archive)
  return { storage, archive, store, engine, state, mark, seen, link, map, env }
}

const remote = () => server.sqlite.prepare('SELECT collection AS c, key AS k, value AS v, updated_at AS t, deleted AS d FROM sync_records ORDER BY collection, key').all().map(r => ({ ...r })) as unknown as SyncRow[]
const remoteRow = (c: string, k: string) => remote().find(r => r.c === c && r.k === k)
/** Another device, speaking the protocol directly. */
async function otherDevice(changes: SyncRow[], cursor = 0, email = USER): Promise<SyncResponse> {
  const response = await handle(new Request(`${ORIGIN}/api/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Cf-Access-Jwt-Assertion': await issuer.token(email) }, body: JSON.stringify({ v: 1, cursor, changes }) }))
  assert.equal(response.status, 200)
  return response.json() as Promise<SyncResponse>
}

test('first device: everything already on it is uploaded once, and nothing on it changes', async () => {
  const one = device(USER, true)
  await ensureSeed()
  await updateSettings({ theme: 'dark', atlasStyle: 'political' })
  const state: PersonalState = { version: 1, entries: { [U1]: { readAt: 100, savedAt: 150, note: 'Link to wetlands rules' }, [U2]: { ignoredAt: 300 }, [U3]: { readAt: 400 } } }
  one.storage.setItem(CA_STATE_KEY, JSON.stringify(state))
  const notes = { version: 1, entries: { '11111111-1111-4111-8111-111111111111': { id: '11111111-1111-4111-8111-111111111111', text: 'Article 21', createdAt: 1000, createdDate: '2026-10-01' }, '22222222-2222-4222-8222-222222222222': { id: '22222222-2222-4222-8222-222222222222', text: 'Removed', createdAt: 2000, createdDate: '2026-10-01', deletedAt: 2500 } } }
  one.storage.setItem(CA_NOTES_KEY, JSON.stringify(notes))
  await one.seen([article(U1, 'Ramsar sites'), article(U2, 'Monsoon withdrawal'), article(U3, 'GST Council')])
  const kept = await create('recalls', { placeId: 'in-chilika', type: 'locate', correct: 1, at: 5000, date: '2026-10-01', source: 'review' })
  const dropped = await create('recalls', { placeId: 'in-loktak', type: 'locate', correct: 0, at: 6000, date: '2026-10-01', source: 'review' })
  await remove('recalls', dropped.id)
  const claim = await create('claims', { challengeId: 'daily-recall', period: '2026-10-01', reward: 20 })
  const before = { state: one.storage.getItem(CA_STATE_KEY), notes: one.storage.getItem(CA_NOTES_KEY), recalls: await db.recalls.toArray(), claims: await db.claims.toArray(), tombstones: await db.tombstones.toArray(), settings: await db.settings.get('settings'), archive: await readArchive(one.archive) }

  const outcome = await one.engine.sync()
  assert.equal(outcome.state, 'synced')
  assert.deepEqual({ sent: (outcome as { sent: number }).sent, received: (outcome as { received: number }).received, pending: (outcome as { pending: number }).pending }, { sent: 13, received: 0, pending: 0 })
  assert.deepEqual(remote().map(r => `${r.c} ${r.k} ${r.d ? 'deleted' : r.v} @${r.t}`).sort(), [
    `article ${U1} ${JSON.stringify({ description: 'Feed summary', firstSeenAt: clock, lastSeenAt: clock, publishedAt: '2026-10-01T04:00:00.000Z', publisher: 'Down To Earth', section: 'Environment', sourceId: 'dte-news', title: 'Ramsar sites', url: U1 })} @${clock}`,
    `claim ${claim.id} ${JSON.stringify({ challengeId: 'daily-recall', createdAt: claim.createdAt, id: claim.id, period: '2026-10-01', reward: 20, updatedAt: claim.updatedAt })} @${claim.updatedAt}`,
    `news ignoredAt:${U2} 300 @300`,
    `news note:${U1} "Link to wetlands rules" @${clock}`,
    `news readAt:${U1} 100 @100`,
    `news readAt:${U3} 400 @400`,
    `news savedAt:${U1} 150 @150`,
    `note 11111111-1111-4111-8111-111111111111 ${JSON.stringify({ createdAt: 1000, createdDate: '2026-10-01', id: '11111111-1111-4111-8111-111111111111', text: 'Article 21' })} @1000`,
    'note 22222222-2222-4222-8222-222222222222 deleted @2500',
    `recall ${dropped.id} deleted @${(await db.tombstones.get(`recalls:${dropped.id}`))!.deletedAt}`,
    `recall ${kept.id} ${JSON.stringify({ at: 5000, correct: 1, createdAt: kept.createdAt, date: '2026-10-01', id: kept.id, placeId: 'in-chilika', source: 'review', type: 'locate', updatedAt: kept.updatedAt })} @${kept.updatedAt}`,
    `settings atlasStyle "political" @${before.settings!.updatedAt}`,
    `settings theme "dark" @${before.settings!.updatedAt}`,
  ].sort(), 'marks keep their own times; only Saved articles carry metadata; untouched defaults are not uploaded')
  assert.deepEqual({ state: one.storage.getItem(CA_STATE_KEY), notes: one.storage.getItem(CA_NOTES_KEY), recalls: await db.recalls.toArray(), claims: await db.claims.toArray(), tombstones: await db.tombstones.toArray(), settings: await db.settings.get('settings'), archive: await readArchive(one.archive) }, before, 'local storage is byte-for-byte what it was')

  // Nothing changed: the next sync writes nothing, and a change-triggered one does not even ask.
  const written = server.totals.rowsWritten, batches = server.totals.batches
  assert.deepEqual(await one.engine.sync({ onlyIfChanged: true }), { state: 'local', pending: 0 })
  assert.equal(server.totals.batches, batches)
  await one.engine.sync()
  assert.equal(server.totals.rowsWritten, written)
  assert.equal(server.totals.batches, batches + 1)
})

test('second device: downloads and merges on its first sync, and its own marks reach the first', async () => {
  const one = device(), two = device()
  one.mark([U1], { readAt: 100, savedAt: 150, note: 'From device one' }); one.mark([U2], { ignoredAt: 300 })
  await one.seen([article(U1, 'Ramsar sites')])
  await one.engine.sync()
  // The second device was in use too, before sync existed.
  two.mark([U1], { readAt: 120 }); two.mark([U3], { savedAt: 500 })
  await two.seen([article(U3, 'GST Council')])
  const expected = mergePersonalState(two.state(), one.state())
  const outcome = await two.engine.sync()
  assert.equal(outcome.state, 'synced')
  assert.deepEqual(two.state(), expected, 'the same result a backup merge gives: every mark kept, the later time for a shared one')
  assert.deepEqual(two.state().entries, { [U1]: { readAt: 120, savedAt: 150, note: 'From device one' }, [U2]: { ignoredAt: 300 }, [U3]: { savedAt: 500 } })
  assert.deepEqual((await readPinnedArticles(two.store)).map(a => a.title).sort(), ['GST Council', 'Ramsar sites'])
  assert.deepEqual((await readArchive(two.archive)).map(a => a.title).sort(), ['GST Council', 'Ramsar sites'], 'the Saved article arrived with its metadata')
  await one.engine.sync()
  assert.deepEqual(one.state(), two.state())
  assert.deepEqual((await readPinnedArticles(one.store)).map(a => a.url).sort(), [U3, U1].sort())
  // Settled: neither has anything left to send.
  const written = server.totals.rowsWritten
  await one.engine.sync(); await two.engine.sync()
  assert.equal(server.totals.rowsWritten, written)
})

test('unsave, unread and undo travel as deletions; unrelated marks are untouched', async () => {
  const one = device(), two = device()
  one.mark([U1, U2], { readAt: tick(), savedAt: clock }); one.mark([U3], { ignoredAt: clock })
  await one.seen([article(U1, 'Ramsar sites'), article(U2, 'Monsoon withdrawal')])
  await one.engine.sync(); await two.engine.sync()
  assert.deepEqual(two.state(), one.state())
  assert.equal((await readPinnedArticles(two.store)).length, 2)

  tick()
  two.mark([U1], { savedAt: undefined }); two.mark([U2], { readAt: undefined }); two.mark([U3], { ignoredAt: undefined })
  await two.engine.sync()
  assert.deepEqual([remoteRow('news', `savedAt:${U1}`), remoteRow('article', U1), remoteRow('news', `readAt:${U2}`), remoteRow('news', `ignoredAt:${U3}`)].map(r => [r?.d, r?.v, r?.t]), [[1, null, clock], [1, null, clock], [1, null, clock], [1, null, clock]], 'tombstones, stamped when the change was made')
  await one.engine.sync()
  assert.deepEqual(one.state().entries, { [U1]: { readAt: clock - 1000 }, [U2]: { savedAt: clock - 1000 } })
  assert.deepEqual((await readPinnedArticles(one.store)).map(a => a.url), [U2], 'the unsaved article is unpinned everywhere')
  assert.equal((await readArchive(one.archive)).length, 2, 'the local archive is never trimmed by sync')

  // Saving again later is a newer change and wins over the deletion.
  tick()
  one.mark([U1], { savedAt: clock })
  await one.engine.sync(); await two.engine.sync()
  assert.equal(two.state().entries[U1].savedAt, clock)
  assert.deepEqual((await readPinnedArticles(two.store)).map(a => a.url).sort(), [U1, U2].sort())
})

test('conflicts: the later change wins on both devices, and different marks on one article never collide', async () => {
  const one = device(), two = device()
  one.mark([U1], { savedAt: tick() })
  await one.seen([article(U1, 'Ramsar sites')])
  await one.engine.sync(); await two.engine.sync()

  // Offline on both: two unsaves it, then one reads it and saves it again later.
  one.link.online = two.link.online = false
  tick(); two.mark([U1], { savedAt: undefined })
  assert.equal((await two.engine.sync()).state, 'offline')
  tick(); one.mark([U1], { readAt: clock, savedAt: clock })
  const offline = await one.engine.sync()
  assert.deepEqual(offline, { state: 'offline', pending: 2, detail: undefined })
  assert.deepEqual(one.state().entries[U1], { readAt: clock, savedAt: clock }, 'offline changes nothing about how the app works')
  const laterSave = clock
  tick(60_000)
  one.link.online = two.link.online = true
  // The earlier change arrives at the server last; it still loses.
  await one.engine.sync(); await two.engine.sync(); await one.engine.sync()
  assert.deepEqual(one.state().entries[U1], { readAt: laterSave, savedAt: laterSave })
  assert.deepEqual(two.state(), one.state())
  assert.equal(remoteRow('news', `savedAt:${U1}`)?.t, laterSave, 'the change keeps the time it was made offline, not the time it was sent')

  // The other order: one saves first, two removes the save later.
  one.link.online = two.link.online = false
  tick(); one.mark([U1], { savedAt: clock })
  tick(); two.mark([U1], { savedAt: undefined })
  one.link.online = two.link.online = true
  await two.engine.sync(); await one.engine.sync(); await two.engine.sync()
  assert.deepEqual(one.state().entries[U1], { readAt: laterSave })
  assert.deepEqual(two.state(), one.state())
  assert.deepEqual(await readPinnedArticles(one.store), [])

  // One device marks read while the other saves: both survive.
  tick(); one.mark([U2], { readAt: clock }); const read = clock
  tick(); two.mark([U2], { savedAt: clock }); const saved = clock
  await one.engine.sync(); await two.engine.sync(); await one.engine.sync()
  assert.deepEqual(one.state().entries[U2], { readAt: read, savedAt: saved })
  assert.deepEqual(two.state(), one.state())
})

test('a Saved article stays listed after its source is dropped, on this device and on the next', async () => {
  const one = device(), two = device()
  const retired = { ...article(U1, 'RBI master circular', 'rbi-notifications'), url: U1, firstSeenAt: 111, lastSeenAt: 222 }
  assert.equal(isActiveSource('rbi-notifications'), false)
  // Archived while the feed was in the registry; the registry no longer has it.
  await readArchive(one.archive)
  await new Promise<void>((resolve, reject) => {
    const open = one.archive.open(ARCHIVE_DB, 1)
    open.onsuccess = () => { const tx = open.result.transaction(ARCHIVE_STORE, 'readwrite'); tx.objectStore(ARCHIVE_STORE).put(retired); tx.oncomplete = () => { open.result.close(); resolve() }; tx.onerror = () => reject(tx.error) }
  })
  one.mark([U1], { savedAt: tick() })
  assert.deepEqual(await readArchive(one.archive), [], 'the archive view hides the retired source')
  await one.engine.scan()
  assert.deepEqual(await readPinnedArticles(one.store), [{ ...retired, publishedAt: '2026-10-01T04:00:00.000Z' }], 'pinned without any network')
  await one.engine.sync(); await two.engine.sync()
  assert.deepEqual((await readPinnedArticles(two.store)).map(a => [a.title, a.sourceId, a.firstSeenAt, a.lastSeenAt]), [['RBI master circular', 'rbi-notifications', 111, 222]])
  assert.equal(two.state().entries[U1].savedAt, clock)
  // An article that was never saved is never uploaded.
  await one.seen([article(U2, 'Monsoon withdrawal')]); one.mark([U2], { readAt: tick() })
  await one.engine.sync()
  assert.deepEqual(remote().filter(r => r.c === 'article').map(r => r.k), [U1])
})

test('lost or unreadable local storage is never mistaken for deletions', async () => {
  const one = device(), two = device()
  one.mark([U1], { readAt: 100, savedAt: 150 }); one.mark([U2], { ignoredAt: 300 })
  await one.engine.sync(); await two.engine.sync()
  const agreed = one.state()
  // The browser dropped the key (storage pressure, a cleared profile).
  one.map.delete(CA_STATE_KEY)
  await one.engine.sync()
  assert.deepEqual(one.state(), agreed, 'restored from what was agreed')
  await two.engine.sync()
  assert.deepEqual(two.state(), agreed, 'and nothing was deleted elsewhere')
  assert.equal(remote().filter(r => r.d).length, 0)
  // A state this version cannot parse stops sync; it is neither overwritten nor uploaded.
  const future = JSON.stringify({ version: 9, entries: {} }), rows = JSON.stringify(remote())
  one.storage.setItem(CA_STATE_KEY, future)
  await assert.rejects(one.engine.sync(), /Unrecognized Current Affairs state/)
  assert.equal(one.storage.getItem(CA_STATE_KEY), future)
  assert.equal(JSON.stringify(remote()), rows)
})

test('short notes: created once, deleted everywhere, never resurrected', async () => {
  const one = device(), two = device()
  const id = '11111111-1111-4111-8111-111111111111', other = '33333333-3333-4333-8333-333333333333'
  const note = (noteId: string, text: string, createdAt: number, deletedAt?: number) => ({ id: noteId, text, createdAt, createdDate: '2026-10-01', ...(deletedAt ? { deletedAt } : {}) })
  one.storage.setItem(CA_NOTES_KEY, JSON.stringify({ version: 1, entries: { [id]: note(id, 'Article 21', 1000) } }))
  two.storage.setItem(CA_NOTES_KEY, JSON.stringify({ version: 1, entries: { [other]: note(other, 'Schedule VII', 1500) } }))
  await one.engine.sync(); await two.engine.sync(); await one.engine.sync()
  const notesOf = (d: typeof one) => parseStickyNotes(d.storage.getItem(CA_NOTES_KEY)).entries
  assert.deepEqual(notesOf(one), { [id]: note(id, 'Article 21', 1000), [other]: note(other, 'Schedule VII', 1500) })
  assert.deepEqual(notesOf(two), notesOf(one))
  two.storage.setItem(CA_NOTES_KEY, JSON.stringify({ version: 1, entries: { ...notesOf(two), [id]: note(id, 'Article 21', 1000, 9000) } }))
  await two.engine.sync(); await one.engine.sync()
  assert.deepEqual(notesOf(one)[id], note(id, 'Article 21', 1000, 9000))
  assert.deepEqual(remoteRow('note', id), { c: 'note', k: id, v: null, t: 9000, d: 1 }, 'the server keeps no text for a deleted note')
  // A device that still has it, and has never synced, learns of the deletion instead of bringing it back.
  const three = device()
  three.storage.setItem(CA_NOTES_KEY, JSON.stringify({ version: 1, entries: { [id]: note(id, 'Article 21', 1000) } }))
  await three.engine.sync()
  assert.equal(notesOf(three)[id].deletedAt, 9000)
  assert.equal(remoteRow('note', id)?.d, 1)
})

test('Atlas history, reward claims and settings reach a new device; deletions follow', async () => {
  const one = device(USER, true)
  await ensureSeed()
  await updateSettings({ theme: 'dark', atlasLayers: { undiscovered: false, areas: true, groups: ['rivers'] } })
  const chosenAt = (await db.settings.get('settings'))!.updatedAt
  const recalls = [await create('recalls', { placeId: 'in-chilika', type: 'locate', correct: 1, at: 5000, date: '2026-10-01', source: 'review' }), await create('recalls', { placeId: 'in-loktak', type: 'pyq', correct: 0, at: 6000, date: '2026-10-02', source: 'card', pyq: { canonicalQuestionId: 'q1', baseQuestionHash: 'h', suppliedAnswerHash: 'a', selectedAnswer: 'B', acceptedAnswers: ['A'], eligiblePlaceIds: ['in-loktak'] } })]
  const claim = await create('claims', { challengeId: 'daily-recall', period: '2026-10-01', reward: 20 })
  await one.engine.sync()

  // The same account on a new device: empty database, default settings stamped later than the first device's choices.
  await db.delete(); await db.open(); await syncStore().reset()
  clock += 86_400_000
  await ensureSeed()
  await db.settings.update('settings', { updatedAt: chosenAt + 86_400_000 })
  const two = device(USER, true)
  const outcome = await two.engine.sync()
  assert.deepEqual({ state: outcome.state, sent: (outcome as { sent: number }).sent, received: (outcome as { received: number }).received }, { state: 'synced', sent: 0, received: 5 })
  assert.deepEqual(await db.recalls.orderBy('at').toArray(), recalls, 'ids, times and canonical-question history are identical')
  assert.deepEqual(await db.claims.toArray(), [claim])
  const settings = (await db.settings.get('settings'))!
  assert.deepEqual({ theme: settings.theme, atlasLayers: settings.atlasLayers, atlasStyle: settings.atlasStyle, haptics: settings.haptics }, { theme: 'dark', atlasLayers: { undiscovered: false, areas: true, groups: ['rivers'] }, atlasStyle: 'physical', haptics: true }, 'a new device’s defaults do not overwrite chosen settings')
  assert.deepEqual(remote().filter(r => r.c === 'settings').map(r => r.k), ['atlasLayers', 'theme'])

  // A new answer and a deletion on the second device.
  const added = await create('recalls', { placeId: 'in-sambhar', type: 'identify', correct: 1, at: clock, date: '2026-10-03', source: 'review' })
  await remove('recalls', recalls[0].id)
  await two.engine.sync()
  assert.equal(remoteRow('recall', recalls[0].id)?.d, 1)
  assert.equal(remoteRow('recall', added.id)?.d, 0)

  // Another device deletes a record and changes a setting; this one follows, through the backup merge rules.
  const cursor = (await syncStore().readMeta()).cursor, later = Date.now() + 5
  await otherDevice([{ c: 'recall', k: recalls[1].id, v: null, t: later, d: 1 }, { c: 'settings', k: 'theme', v: '"light"', t: later, d: 0 }, { c: 'settings', k: 'atlasStyle', v: '"not-a-style"', t: later, d: 0 }], cursor)
  await two.engine.sync()
  assert.deepEqual((await db.recalls.toArray()).map(r => r.id), [added.id])
  assert.deepEqual(await db.tombstones.get(`recalls:${recalls[1].id}`), { id: `recalls:${recalls[1].id}`, table: 'recalls', entityId: recalls[1].id, deletedAt: later })
  const after = (await db.settings.get('settings'))!
  assert.deepEqual([after.theme, after.atlasStyle], ['light', 'physical'], 'a value this version does not know is not applied')
})

test('"Erase all data" and "Replace everything" affect this device only', async () => {
  const one = device(USER, true)
  await ensureSeed()
  one.mark([U1], { readAt: 100, savedAt: 150 }); one.mark([U2], { readAt: 200 })
  await one.seen([article(U1, 'Ramsar sites')])
  const recall = await create('recalls', { placeId: 'in-chilika', type: 'locate', correct: 1, at: 5000, date: '2026-10-01', source: 'review' })
  await one.engine.sync()
  const rows = JSON.stringify(remote())
  const backup = await createBackup(one.env as never)

  await eraseEverything({ storage: one.storage, indexedDB: one.archive })
  await ensureSeed()
  assert.equal(one.storage.getItem(CA_STATE_KEY), null)
  assert.equal(await db.recalls.count(), 0)
  await one.engine.sync()
  assert.equal(JSON.stringify(remote()), rows, 'no deletion was passed on')
  assert.deepEqual(one.state().entries, { [U1]: { readAt: 100, savedAt: 150 }, [U2]: { readAt: 200 } }, 'the account’s data returns')
  assert.deepEqual(await db.recalls.toArray(), [recall])

  // Replace with a backup that lacks a later mark: the mark is not deleted from the account.
  tick(); one.mark([U3], { savedAt: clock })
  await one.engine.sync()
  await restoreBackup(backup, 'replace', { storage: one.storage, indexedDB: one.archive })
  assert.equal(one.state().entries[U3], undefined)
  await one.engine.sync()
  assert.equal(remoteRow('news', `savedAt:${U3}`)?.d, 0)
  assert.equal(one.state().entries[U3].savedAt, clock)
})

test('a slow clock, a lapsed session and a different account', async () => {
  const one = device(), two = device()
  one.mark([U1], { savedAt: tick() })
  await one.engine.sync(); await two.engine.sync()
  // Device two's clock is a day behind: its unsave is still later than the save it has seen.
  const real = clock
  clock = real - 86_400_000
  two.mark([U1], { savedAt: undefined })
  await two.engine.sync()
  clock = real
  assert.deepEqual([remoteRow('news', `savedAt:${U1}`)?.d, remoteRow('news', `savedAt:${U1}`)?.t], [1, real + 1])
  await one.engine.sync()
  assert.deepEqual(one.state().entries, {})

  // Signed in as someone else on a linked device: refused, nothing written to either account.
  const rows = JSON.stringify(remote())
  const wrong = createSyncEngine({ store: one.store, adapters: [newsAdapter(one.env), articleAdapter(one.env), noteAdapter(one.env)], transport: transportFor('other@example.org'), now: () => clock })
  one.mark([U2], { readAt: tick() })
  assert.deepEqual(await wrong.sync(), { state: 'mismatch', pending: 1, detail: undefined })
  assert.equal(JSON.stringify(remote()), rows)
  assert.equal(one.state().entries[U2].readAt, clock, 'the change stays on the device')

  // An expired session answers with a redirect to the login page.
  const lapsed = createSyncEngine({ store: one.store, adapters: [newsAdapter(one.env)], transport: fetchTransport(async () => new Response(null, { status: 302, headers: { Location: 'https://team.cloudflareaccess.test/login' } })), now: () => clock })
  assert.deepEqual(await lapsed.sync(), { state: 'signin', pending: 1, detail: undefined })
  const noService = createSyncEngine({ store: one.store, adapters: [newsAdapter(one.env)], transport: fetchTransport(async () => new Response('<!doctype html>', { status: 200, headers: { 'Content-Type': 'text/html' } })), now: () => clock })
  assert.equal((await noService.sync()).state, 'unavailable')
  // Signed in again as the linked account: the waiting change goes through.
  await one.engine.sync()
  assert.equal(remoteRow('news', `readAt:${U2}`)?.v, String(clock))
})

test('a long history uploads in bounded requests and downloads in pages', async () => {
  const one = device(USER, true)
  await ensureSeed()
  const total = 1250
  await db.recalls.bulkPut(Array.from({ length: total }, (_, i) => ({ id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`, createdAt: 1000 + i, updatedAt: 1000 + i, placeId: `place-${i % 40}`, type: 'locate' as const, correct: (i % 2) as 0 | 1, at: 1000 + i, date: '2026-10-01', source: 'review' as const })))
  const up = await one.engine.sync()
  assert.deepEqual({ sent: (up as { sent: number }).sent, batches: server.totals.batches }, { sent: total, batches: 4 }, '400 rows per request')
  await db.delete(); await db.open(); await syncStore().reset(); await ensureSeed()
  const before = server.totals.batches
  const down = await device(USER, true).engine.sync()
  assert.deepEqual({ received: (down as { received: number }).received, requests: server.totals.batches - before, local: await db.recalls.count() }, { received: total, requests: 3, local: total })
}, 60_000)
