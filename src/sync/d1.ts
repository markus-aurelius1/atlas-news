/**
 * D1 storage for sync: one row per (account, collection, key), numbered per account so a device can ask for
 * "everything after N". One exchange is one transaction: read what the device has not seen, then write what it
 * sent, keeping the newer of each key. Schema: migrations/0001_sync.sql.
 */
import { MAX_PULL_ROWS, SYNC_VERSION, type Collection, type SyncRequest, type SyncResponse, type SyncRow } from './protocol.ts'

/** The part of the D1 binding this module uses. */
export interface D1Statement {
  bind(...values: unknown[]): D1Statement
}
export interface D1Result<T = unknown> {
  results?: T[]
  meta?: { rows_read?: number; rows_written?: number }
}
export interface D1Like {
  prepare(sql: string): D1Statement
  batch<T = unknown>(statements: D1Statement[]): Promise<D1Result<T>[]>
}

interface StoredRow { collection: Collection; key: string; value: string | null; updated_at: number; deleted: number; seq: number }

const PULL = 'SELECT collection, key, value, updated_at, deleted, seq FROM sync_records WHERE user_id = ?1 AND seq > ?2 ORDER BY seq LIMIT ?3'

const ENSURE_USER = 'INSERT INTO sync_users (user_id, seq, created_at) VALUES (?1, 0, ?2) ON CONFLICT (user_id) DO NOTHING'

/** The whole change set arrives as one JSON array. A row replaces the stored one only when it is newer. */
const PUSH = `INSERT INTO sync_records (user_id, collection, key, value, updated_at, deleted, seq)
SELECT ?1, json_extract(j.value, '$.c'), json_extract(j.value, '$.k'), json_extract(j.value, '$.v'), json_extract(j.value, '$.t'), json_extract(j.value, '$.d'),
  (SELECT seq FROM sync_users WHERE user_id = ?1) + j.key + 1
FROM json_each(?2) AS j WHERE true
ON CONFLICT (user_id, collection, key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, deleted = excluded.deleted, seq = excluded.seq
WHERE excluded.updated_at > sync_records.updated_at`

const ADVANCE = 'UPDATE sync_users SET seq = seq + ?2 WHERE user_id = ?1'
const HEAD = 'SELECT seq FROM sync_users WHERE user_id = ?1'

export interface ExchangeUsage { queries: number; rowsRead: number; rowsWritten: number }

/**
 * Exchange change sets for one account. `user` must come from a validated Access token.
 * A device with nothing to send costs one indexed read and no write.
 */
export async function exchange(db: D1Like, user: string, request: SyncRequest, now: number): Promise<{ response: SyncResponse; usage: ExchangeUsage }> {
  const pull = db.prepare(PULL).bind(user, request.cursor, MAX_PULL_ROWS + 1)
  const pushing = request.changes.length > 0
  const statements = pushing
    ? [db.prepare(ENSURE_USER).bind(user, now), pull, db.prepare(PUSH).bind(user, JSON.stringify(request.changes)), db.prepare(ADVANCE).bind(user, request.changes.length), db.prepare(HEAD).bind(user)]
    : [pull]
  const results = await db.batch<StoredRow & { seq: number }>(statements)
  const pulled = (results[pushing ? 1 : 0].results ?? []) as StoredRow[]
  const more = pulled.length > MAX_PULL_ROWS
  const page = more ? pulled.slice(0, MAX_PULL_ROWS) : pulled
  const rows: SyncRow[] = page.map((r) => ({ c: r.collection, k: r.key, v: r.deleted ? null : r.value, t: r.updated_at, d: r.deleted ? 1 : 0 }))
  const last = page.length ? page[page.length - 1].seq : request.cursor
  // After a full read and a write in the same transaction nothing can lie between the two, so the cursor may
  // skip this device's own rows. A truncated read keeps its place; the rows it wrote come back later, harmlessly.
  const head = pushing ? Number((results[4].results?.[0] as { seq?: number } | undefined)?.seq ?? last) : last
  const usage: ExchangeUsage = { queries: statements.length, rowsRead: 0, rowsWritten: 0 }
  for (const r of results) {
    usage.rowsRead += r.meta?.rows_read ?? 0
    usage.rowsWritten += r.meta?.rows_written ?? 0
  }
  return { response: { v: SYNC_VERSION, account: user, cursor: more ? last : Math.max(head, last), more, rows }, usage }
}
