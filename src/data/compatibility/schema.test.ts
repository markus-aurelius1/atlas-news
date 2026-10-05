import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, TarsDB } from '../db'
import { ensureSeed } from '../seed'
import { createBackup, parseBackup, restoreBackup } from '../backup'
import { V1_STORES, BACKUP_TABLES } from './schema'

beforeEach(async () => { await db.delete(); await db.open() })

describe('database and backup compatibility', () => {
  it('upgrades a real v1 schema and retains every historical row and current reward', async () => {
    const name = 'tars-compatibility-v1'
    await Dexie.delete(name)
    const old = new Dexie(name)
    old.version(1).stores(V1_STORES)
    await old.open()
    const row = { id: 'stored', createdAt: 1, updatedAt: 2, custom: { preserve: true } }
    for (const name of BACKUP_TABLES.filter(n => n in V1_STORES)) await old.table(name).put(row)
    await old.table('settings').put({ id: 'settings', updatedAt: 2, theme: 'dark', customPreference: 'keep' })
    old.close()
    const current = new TarsDB(name)
    await current.open()
    for (const name of BACKUP_TABLES.filter(n => n in V1_STORES)) expect(await current.table(name).get('stored')).toEqual(row)
    expect(await current.settings.get('settings')).toMatchObject({ theme: 'dark', customPreference: 'keep', atlasStyle: 'physical' })
    current.close()
    await Dexie.delete(name)
  })
  it('boots an existing v2 database and round-trips opaque records and preferences in v3 backups', async () => {
    const record = { id: 'stored', createdAt: 1, updatedAt: 2, arbitrary: { text: 'unaltered' } }
    for (const name of BACKUP_TABLES) await db.table(name).put(record)
    await db.settings.put({ id: 'settings', updatedAt: 2, theme: 'dark', weekStartsOn: 1, haptics: true, atlasStyle: 'physical', customPreference: 'keep' })
    await ensureSeed()
    const backup = parseBackup(JSON.stringify(await createBackup()))
    await restoreBackup(backup, 'replace')
    for (const name of BACKUP_TABLES) expect(await db.table(name).get('stored')).toEqual(record)
    expect((await db.settings.get('settings'))?.customPreference).toBe('keep')
  })
  it('imports older lodestar backups and merges by timestamp without losing stored fields', async () => {
    const row = { id: 'r', createdAt: 1, updatedAt: 4, placeId: 'in.pass.nathu-la', correct: 1, date: '2026-10-05', at: 4, type: 'state', source: 'review' }
    const backup = parseBackup(JSON.stringify({ app: 'lodestar', version: 1, exportedAt: '2026-10-05', tables: { recalls: [row] }, tombstones: [] }))
    await restoreBackup(backup, 'merge')
    expect(await db.recalls.get('r')).toEqual(row)
    const older = { ...backup, tables: { recalls: [{ ...row, updatedAt: 2, correct: 0 }] } }
    await restoreBackup(older, 'merge')
    expect((await db.recalls.get('r'))?.correct).toBe(1)
  })
})
