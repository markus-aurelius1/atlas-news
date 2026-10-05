import type { Table } from 'dexie'
import { collectExtras, eraseExtras, parseExtras, restoreExtras, type BackupExtras, type ExtrasEnv, type ExtrasReport } from './backup-extras'
import { db } from './db'
import { normalizeSettings } from './seed'
import { applyChanges, type MergeReport } from './compatibility/merge'
import { BACKUP_TABLES as SYNC_TABLES, type BackupTable as SyncTable } from './compatibility/schema'
import type { Entity, Settings, Tombstone } from './types'

export const BACKUP_APP = 'tars'
/** Backups made before the app was renamed from Lodestar to Tars. */
const LEGACY_BACKUP_APPS = ['lodestar']
/**
 * v3: adds `extras` – the short notes and the Current Affairs reading state, which live outside the database (backup-extras.ts).
 * v2: Atlas history and archived records. v1 and v2 backups still import; they have no extras and leave notes and reading state alone.
 * v1's sky-theme unlocks are ignored.
 */
export const BACKUP_VERSION = 3

export interface BackupFile {
  app: string
  version: number
  exportedAt: string
  settings: Settings | null
  tables: Partial<Record<SyncTable, Entity[]>>
  tombstones: Tombstone[]
  /** Notes and Current Affairs reading state (version 3 and later). Absent in older backups. */
  extras?: BackupExtras
}

export interface RestoreReport extends MergeReport {
  extras: ExtrasReport
}

export async function createBackup(env?: ExtrasEnv): Promise<BackupFile> {
  const tables: BackupFile['tables'] = {}
  for (const name of SYNC_TABLES) tables[name] = await (db.table(name) as Table<Entity, string>).toArray()
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: (await db.settings.get('settings')) ?? null,
    tables,
    tombstones: await db.tombstones.toArray(),
    extras: await collectExtras(env),
  }
}

export class BackupError extends Error {}

export function parseBackup(text: string): BackupFile {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new BackupError('This file is not valid JSON.')
  }
  const b = data as Partial<BackupFile>
  if (!b || typeof b !== 'object' || typeof b.app !== 'string' || ![BACKUP_APP, ...LEGACY_BACKUP_APPS].includes(b.app) || typeof b.tables !== 'object' || !b.tables) {
    throw new BackupError('This does not look like a Tars backup.')
  }
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION) {
    throw new BackupError('This backup was made by a newer version of Tars. Update the app and try again.')
  }
  for (const [name, rows] of Object.entries(b.tables)) {
    if (!SYNC_TABLES.includes(name as SyncTable)) continue
    if (!Array.isArray(rows)) throw new BackupError(`Table "${name}" is malformed.`)
    for (const r of rows) {
      if (!r || typeof r !== 'object' || typeof (r as Entity).id !== 'string' || typeof (r as Entity).updatedAt !== 'number') {
        throw new BackupError(`A record in "${name}" is missing its id or timestamp.`)
      }
    }
  }
  let extras: BackupExtras | undefined
  try {
    extras = parseExtras(b.extras)
  } catch (err) {
    throw new BackupError(err instanceof Error ? err.message : 'The notes and reading state in this backup are malformed.')
  }
  return { ...b, tombstones: Array.isArray(b.tombstones) ? b.tombstones : [], extras } as BackupFile
}

export function backupCounts(b: BackupFile): Record<string, number> {
  const counts = Object.fromEntries(Object.entries(b.tables).map(([k, v]) => [k, v?.length ?? 0]))
  if (b.extras?.notes) counts.notes = Object.values(b.extras.notes.entries).filter((n) => !n.deletedAt).length
  if (b.extras?.currentAffairs) counts.articles = Object.keys(b.extras.currentAffairs.state.entries).length
  return counts
}

/**
 * Restore a backup.
 * - `merge`: newest version of each record wins (safe to import on a second device).
 * - `replace`: wipe local data and load the backup exactly.
 */
export async function restoreBackup(b: BackupFile, mode: 'merge' | 'replace', env?: ExtrasEnv): Promise<RestoreReport> {
  if (mode === 'replace') {
    const tables = [...SYNC_TABLES.map((n) => db.table(n)), db.tombstones, db.settings]
    let inserted = 0
    await db.transaction('rw', tables, async () => {
      for (const name of SYNC_TABLES) {
        const table = db.table(name) as Table<Entity, string>
        await table.clear()
        const rows = b.tables[name] ?? []
        await table.bulkPut(rows)
        inserted += rows.length
      }
      await db.tombstones.clear()
      await db.tombstones.bulkPut(b.tombstones ?? [])
      if (b.settings) await db.settings.put(normalizeSettings(b.settings))
    })
    return { inserted, updated: 0, skipped: 0, deleted: 0, extras: await restoreExtras(b.extras, mode, env) }
  }
  const report = await applyChanges({ records: b.tables, tombstones: b.tombstones ?? [] })
  if (b.settings) {
    const local = await db.settings.get('settings')
    if (!local || b.settings.updatedAt > local.updatedAt) await db.settings.put(normalizeSettings(b.settings))
  }
  return { ...report, extras: await restoreExtras(b.extras, mode, env) }
}

/** Remove every record (keeps nothing), the notes and the Current Affairs reading state. Used by "Erase all data". */
export async function eraseEverything(env?: ExtrasEnv): Promise<void> {
  const tables = [...SYNC_TABLES.map((n) => db.table(n)), db.tombstones, db.settings, db.table('reminderLog')]
  await db.transaction('rw', tables, async () => {
    for (const t of tables) await t.clear()
  })
  await eraseExtras(env)
}
