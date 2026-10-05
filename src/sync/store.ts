/**
 * What this device knows about sync, in a database of its own (`tars-sync-v1`), apart from the learner
 * database and the article archive. `rows` holds, per key, the value last agreed with the server or changed
 * here since, so a local change is found by comparing the app's own storage with it; `outbox` names the rows
 * the server has not accepted yet. Neither table has a secondary index: every write is one keyed put.
 * Clearing this database loses no personal data: the device simply links again and merges.
 */
import Dexie, { type Table } from 'dexie'
import type { Collection, SyncRow } from './protocol.ts'

export const SYNC_DB = 'tars-sync-v1'

export type StoredRow = SyncRow
export type RowKey = [Collection, string]
export const rowKey = (row: Pick<SyncRow, 'c' | 'k'>): RowKey => [row.c, row.k]

export interface SyncMeta {
  id: 'meta'
  cursor: number
  /** The account this device is linked to. */
  account?: string
  lastSyncedAt?: number
}

export class SyncStore extends Dexie {
  rows!: Table<StoredRow, RowKey>
  outbox!: Table<Pick<SyncRow, 'c' | 'k'>, RowKey>
  meta!: Table<SyncMeta, 'meta'>
  constructor(name = SYNC_DB, options?: ConstructorParameters<typeof Dexie>[1]) {
    super(name, options)
    this.version(1).stores({ rows: '[c+k]', outbox: '[c+k]', meta: 'id' })
  }
  async readMeta(): Promise<SyncMeta> {
    return (await this.meta.get('meta')) ?? { id: 'meta', cursor: 0 }
  }
  async collection(c: Collection): Promise<Map<string, StoredRow>> {
    // Keys sort by collection first, so one collection is one range of the primary key.
    return new Map((await this.rows.where('[c+k]').between([c, Dexie.minKey], [c, Dexie.maxKey]).toArray()).map((row) => [row.k, row]))
  }
  /** Forget the link and everything agreed so far. Personal data in the app's own storage is not touched. */
  async reset(): Promise<void> {
    await this.transaction('rw', this.rows, this.outbox, this.meta, async () => {
      await this.rows.clear()
      await this.outbox.clear()
      await this.meta.clear()
    })
  }
}

let shared: SyncStore | undefined
export const syncStore = () => (shared ??= new SyncStore())

/** Used by "Erase all data" and "Replace everything": the device starts over as a new one and merges. */
export async function resetSyncState(): Promise<void> {
  if (typeof indexedDB === 'undefined') return
  await syncStore().reset()
}
