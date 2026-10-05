/**
 * The sync loop. Local-first: the app reads and writes its own storage and never waits for this.
 *
 *   1. scan      compare the app's storage with the rows last agreed; what differs is a local change, stamped
 *                with its time and put in the outbox. This step needs no network, so a change made offline
 *                keeps the time it was made.
 *   2. exchange  send the outbox and the cursor; receive rows this device has not seen.
 *   3. apply     for every received row the newer of the two wins. Winners are written to the app's storage
 *                first, then recorded here, then the cursor moves – an interruption at any point repeats work
 *                but never loses or reverts anything.
 */
import type { Adapter } from './adapters.ts'
import { MAX_BODY_BYTES, MAX_PUSH_ROWS, SYNC_VERSION, type Collection, type SyncRequest, type SyncResponse, type SyncRow } from './protocol.ts'
import { rowKey, type StoredRow, type SyncStore } from './store.ts'

export type TransportResult =
  | { ok: true; response: SyncResponse }
  /** offline: no network. signin: the Access session has lapsed. unavailable: this site has no sync endpoint. */
  | { ok: false; reason: 'offline' | 'signin' | 'unavailable' | 'mismatch' | 'clock' | 'error'; detail?: string }

export type Transport = (request: SyncRequest) => Promise<TransportResult>

export type SyncOutcome =
  | { state: 'synced'; account: string; sent: number; received: number; pending: number; at: number }
  | { state: 'local'; pending: number }
  | { state: 'offline' | 'signin' | 'unavailable' | 'mismatch' | 'clock' | 'error'; pending: number; detail?: string }

export interface EngineOptions {
  store: SyncStore
  adapters: Adapter[]
  /** Absent where there is no server to talk to (the native apps): changes are still tracked. */
  transport?: Transport
  now?: () => number
}

/** One call stops after this many requests; anything still waiting goes with the next call. */
const MAX_ROUNDS = 100
/** Leave room for the envelope around the rows. */
const BODY_BUDGET = MAX_BODY_BYTES - 4096

export function createSyncEngine({ store, adapters, transport, now = Date.now }: EngineOptions) {
  const byCollection = new Map<Collection, Adapter>(adapters.map((adapter) => [adapter.c, adapter]))

  /** Find local changes and queue them. Returns how many rows are waiting to be sent. */
  async function scan(): Promise<number> {
    for (const adapter of adapters) {
      const shadow = await store.collection(adapter.c)
      const changes = await adapter.scan(shadow)
      if (!changes.length) continue
      const at = now()
      const rows = changes.map((change): StoredRow => {
        const known = shadow.get(change.k)
        // Always later than anything this device has seen for the key, even if its clock runs behind.
        const t = Math.max(Math.floor(change.t ?? at), known ? known.t + 1 : 0)
        return { c: adapter.c, k: change.k, v: change.d ? null : change.v, t, d: change.d }
      })
      await store.transaction('rw', store.rows, store.outbox, async () => {
        await store.rows.bulkPut(rows)
        await store.outbox.bulkPut(rows.map(({ c, k }) => ({ c, k })))
      })
    }
    return store.outbox.count()
  }

  async function nextBatch(): Promise<StoredRow[]> {
    const batch: StoredRow[] = []
    let bytes = 0
    const waiting = await store.outbox.limit(MAX_PUSH_ROWS).toArray()
    for (const row of await store.rows.bulkGet(waiting.map(rowKey))) {
      if (!row) continue
      bytes += row.k.length + (row.v?.length ?? 0) + 64
      if (batch.length && bytes * 2 > BODY_BUDGET) break
      batch.push(row)
    }
    return batch
  }

  async function receive(sent: StoredRow[], response: SyncResponse): Promise<number> {
    const winners = new Map<Collection, SyncRow[]>()
    const keys = response.rows.map(rowKey)
    const known = await store.rows.bulkGet(keys), unsent = await store.outbox.bulkGet(keys)
    for (const [i, row] of response.rows.entries()) {
      const mine = known[i]
      // The server keeps a stored row unless the incoming one is strictly newer; decide the same way here.
      if (mine && (unsent[i] ? row.t < mine.t : row.t <= mine.t)) continue
      winners.set(row.c, [...(winners.get(row.c) ?? []), row])
    }
    let received = 0
    for (const [c, rows] of winners) {
      const adapter = byCollection.get(c)
      // A collection this version does not know is left alone: recording it without applying it would later read as a deletion.
      if (!adapter) continue
      await adapter.apply(rows)
      await store.transaction('rw', store.rows, store.outbox, async () => {
        await store.rows.bulkPut(rows)
        await store.outbox.bulkDelete(rows.map(rowKey))
      })
      received += rows.length
    }
    // What was sent is settled, unless it changed again while the request was in flight.
    await store.transaction('rw', store.rows, store.outbox, async () => {
      const current = await store.rows.bulkGet(sent.map(rowKey))
      await store.outbox.bulkDelete(sent.filter((row, i) => { const now = current[i]; return !now || (now.t === row.t && now.v === row.v && now.d === row.d) }).map(rowKey))
    })
    return received
  }

  async function sync(options: { onlyIfChanged?: boolean } = {}): Promise<SyncOutcome> {
    let pending = await scan()
    if (!transport) return { state: 'local', pending }
    if (options.onlyIfChanged && !pending) return { state: 'local', pending }
    let sent = 0, received = 0, account = ''
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const meta = await store.readMeta()
      const batch = await nextBatch()
      const result = await transport({ v: SYNC_VERSION, cursor: meta.cursor, ...(meta.account ? { account: meta.account } : {}), changes: batch.map(({ c, k, v, t, d }) => ({ c, k, v, t, d })) })
      if (!result.ok) return { state: result.reason, pending, detail: result.detail }
      const { response } = result
      const arrived = await receive(batch, response)
      received += arrived
      sent += batch.length
      account = response.account
      await store.meta.put({ id: 'meta', cursor: response.cursor, account: response.account, lastSyncedAt: now() })
      // Rows that arrived may change what is derived here (a Saved mark pins its article): settle that now.
      pending = arrived ? await scan() : await store.outbox.count()
      if (!response.more && !pending) break
    }
    return { state: 'synced', account, sent, received, pending, at: now() }
  }

  return { scan, sync }
}

export type SyncEngine = ReturnType<typeof createSyncEngine>
