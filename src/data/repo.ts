/**
 * Thin write layer over Dexie. All mutations go through here so that
 * timestamps and tombstones are maintained consistently – the prerequisite
 * for conflict-free JSON merges and future cloud sync.
 */
import type { Table } from 'dexie'
import { uid } from '@/lib/id'
import { db } from './db'
import type { Entity, SyncTable, TableMap } from './types'

type Draft<T extends Entity> = Omit<T, 'id' | 'createdAt' | 'updatedAt'> & Partial<Entity>

function table<K extends SyncTable>(name: K): Table<TableMap[K], string> {
  return db.table(name) as Table<TableMap[K], string>
}

export async function create<K extends SyncTable>(name: K, draft: Draft<TableMap[K]>): Promise<TableMap[K]> {
  const now = Date.now()
  const record = { ...draft, id: draft.id ?? uid(), createdAt: draft.createdAt ?? now, updatedAt: now } as TableMap[K]
  await table(name).put(record)
  return record
}

export async function patch<K extends SyncTable>(
  name: K,
  id: string,
  changes: Partial<Omit<TableMap[K], 'id' | 'createdAt'>>,
): Promise<void> {
  // Dexie's UpdateSpec typing is stricter than a plain partial; the shape is equivalent.
  await table(name).update(id, { ...changes, updatedAt: Date.now() } as never)
}

export async function upsert<K extends SyncTable>(name: K, record: TableMap[K]): Promise<void> {
  await table(name).put({ ...record, updatedAt: Date.now() })
}

export async function remove<K extends SyncTable>(name: K, ids: string | string[]): Promise<void> {
  const list = Array.isArray(ids) ? ids : [ids]
  if (!list.length) return
  const now = Date.now()
  await db.transaction('rw', [table(name), db.tombstones], async () => {
    await table(name).bulkDelete(list)
    await db.tombstones.bulkPut(list.map((id) => ({ id: `${name}:${id}`, table: name, entityId: id, deletedAt: now })))
  })
}

/** Bring back a record removed with `remove` (undo): the record returns and its tombstone goes. */
export async function restore<K extends SyncTable>(name: K, record: TableMap[K]): Promise<void> {
  await db.transaction('rw', [table(name), db.tombstones], async () => {
    await table(name).put({ ...record, updatedAt: Date.now() })
    await db.tombstones.delete(`${name}:${record.id}`)
  })
}

