/** Exact v1/v2 schema: dropping a store during an upgrade would erase existing lodestar data.
 * Historical rows are opaque, have no hooks or product mutations, and are read only for explicit backups.
 */
import type Dexie from 'dexie'
export const V1_STORES = {
  labels: 'id, parentId, order, updatedAt',
  projects: 'id, order, updatedAt',
  tasks: 'id, done, projectId, labelId, plannedFor, dueDate, completedAt, seriesId, updatedAt',
  sessions: 'id, date, startedAt, labelId, taskId, projectId, updatedAt',
  profiles: 'id, order, updatedAt',
  goals: 'id, order, updatedAt',
  habits: 'id, order, updatedAt',
  habitLogs: 'id, habitId, date, updatedAt',
  events: 'id, date, kind, taskId, updatedAt',
  audioPresets: 'id, order, updatedAt',
  playlists: 'id, order, updatedAt',
  unlocks: 'id, item, updatedAt',
  claims: 'id, challengeId, period, updatedAt',
  settings: 'id',
  tombstones: 'id, table, deletedAt',
  reminderLog: 'id, firedAt',
}
export const BACKUP_TABLES = ['labels', 'projects', 'tasks', 'sessions', 'profiles', 'goals', 'habits', 'habitLogs', 'events', 'audioPresets', 'playlists', 'claims', 'recalls', 'expeditions'] as const
export type BackupTable = typeof BACKUP_TABLES[number]
export function preserveSchema(db: Dexie) {
  db.version(1).stores(V1_STORES)
  db.version(2).stores({ unlocks: null, recalls: 'id, placeId, date, at, updatedAt', expeditions: 'id, expeditionId, startedAt, updatedAt' }).upgrade(async tx => {
    await tx.table('settings').toCollection().modify((s: Record<string, unknown>) => {
      delete s.skyTheme
      s.atlasStyle ??= 'physical'
      s.baseCamp ??= null
      s.breakReview ??= true
    })
  })
}
