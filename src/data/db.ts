/** Existing database identity; only current stores have typed application access. */
import Dexie, { type EntityTable, type Table } from 'dexie'
import type { ChallengeClaim, RecallAttempt, Settings, Tombstone } from './types'
import { preserveSchema } from './compatibility/schema'
export const DB_NAME = 'lodestar'
export class TarsDB extends Dexie {
  claims!: EntityTable<ChallengeClaim, 'id'>
  recalls!: EntityTable<RecallAttempt, 'id'>
  settings!: Table<Settings, 'settings'>
  tombstones!: EntityTable<Tombstone, 'id'>
  constructor(name = DB_NAME) { super(name); preserveSchema(this) }
}
export const db = new TarsDB()
