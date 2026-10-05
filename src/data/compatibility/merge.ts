/**
 * Sync-ready merge layer.
 *
 * Tars is local-first and needs no account. Every record has a UUID and an
 * `updatedAt`, and deletions leave tombstones, so any two copies of the data
 * can be merged with last-write-wins semantics. JSON import uses this today;
 * a future cloud backend only has to implement `SyncAdapter` (exchange change
 * sets since a cursor) and call `applyChanges` with what it pulls.
 */
import type { Table } from 'dexie'
import { db } from '../db'
import { BACKUP_TABLES as SYNC_TABLES, type BackupTable as SyncTable } from './schema'
import type { Entity, Tombstone } from '../types'

export interface ChangeSet {
  /** Exclusive lower bound (ms) the changes were collected from. */
  since: number
  /** Upper bound – becomes the next cursor. */
  until: number
  records: Partial<Record<SyncTable, Entity[]>>
  tombstones: Tombstone[]
}


const tableOf = (name: SyncTable) => db.table(name) as Table<Entity, string>

export async function changesSince(since: number): Promise<ChangeSet> {
  const until = Date.now()
  const records: ChangeSet['records'] = {}
  for (const name of SYNC_TABLES) {
    const changed = await tableOf(name).where('updatedAt').above(since).toArray()
    if (changed.length) records[name] = changed
  }
  const tombstones = await db.tombstones.where('deletedAt').above(since).toArray()
  return { since, until, records, tombstones }
}

export interface MergeReport {
  inserted: number
  updated: number
  skipped: number
  deleted: number
}

const isEntity = (r: unknown): r is Entity =>
  !!r && typeof r === 'object' && typeof (r as Entity).id === 'string' && typeof (r as Entity).updatedAt === 'number'

/**
 * Merge a change set into the local database. For each record the newest
 * `updatedAt` wins; a tombstone newer than a record deletes it, and a record
 * newer than a tombstone resurrects it.
 */
export async function applyChanges(changes: Pick<ChangeSet, 'records' | 'tombstones'>): Promise<MergeReport> {
  const report: MergeReport = { inserted: 0, updated: 0, skipped: 0, deleted: 0 }
  const tables = [...SYNC_TABLES.map(tableOf), db.tombstones]
  await db.transaction('rw', tables, async () => {
    const localTombs = new Map((await db.tombstones.toArray()).map((t) => [t.id, t]))

    for (const t of changes.tombstones ?? []) {
      if (!SYNC_TABLES.includes(t.table as SyncTable)) continue
      const table = tableOf(t.table as SyncTable)
      const existing = await table.get(t.entityId)
      if (existing && existing.updatedAt > t.deletedAt) continue
      if (existing) {
        await table.delete(t.entityId)
        report.deleted++
      }
      const prev = localTombs.get(t.id)
      if (!prev || prev.deletedAt < t.deletedAt) {
        await db.tombstones.put(t)
        localTombs.set(t.id, t)
      }
    }

    for (const name of SYNC_TABLES) {
      const incoming = (changes.records?.[name] ?? []).filter(isEntity)
      if (!incoming.length) continue
      const table = tableOf(name)
      const existing = new Map((await table.bulkGet(incoming.map((r) => r.id))).filter(isEntity).map((r) => [r.id, r]))
      const writes: Entity[] = []
      for (const record of incoming) {
        const tomb = localTombs.get(`${name}:${record.id}`)
        if (tomb && tomb.deletedAt >= record.updatedAt) {
          report.skipped++
          continue
        }
        const cur = existing.get(record.id)
        if (!cur) report.inserted++
        else if (record.updatedAt > cur.updatedAt) report.updated++
        else {
          report.skipped++
          continue
        }
        writes.push(record)
      }
      if (writes.length) await table.bulkPut(writes)
    }
  })
  return report
}

