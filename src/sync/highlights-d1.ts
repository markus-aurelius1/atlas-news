import type { D1Like, ExchangeUsage } from './d1.ts'
import { HIGHLIGHT_BATCH, HIGHLIGHT_BODY_BYTES, HIGHLIGHT_SYNC, highlightValue, parseAuthored, type HighlightRequest, type HighlightResponse } from './highlights-protocol.ts'

const PUSH = `INSERT INTO highlight_sync_records (user_id, highlight_id, value, updated_at, deleted, seq)
SELECT ?1, json_extract(j.value, '$.id'), json_extract(j.value, '$.value'), json_extract(j.value, '$.time'), json_extract(j.value, '$.deleted'),
 (SELECT seq FROM highlight_sync_users WHERE user_id = ?1) + j.key + 1
FROM json_each(?2) j WHERE true
ON CONFLICT (user_id, highlight_id) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, deleted = excluded.deleted, seq = excluded.seq
WHERE excluded.deleted > highlight_sync_records.deleted OR
 (excluded.deleted = highlight_sync_records.deleted AND (excluded.updated_at > highlight_sync_records.updated_at OR
 (excluded.updated_at = highlight_sync_records.updated_at AND excluded.value COLLATE BINARY > highlight_sync_records.value COLLATE BINARY)))`
const PULL = 'SELECT value, seq FROM highlight_sync_records WHERE user_id = ?1 AND seq > ?2 ORDER BY seq LIMIT ?3'
const RECEIPTS = "SELECT value, seq FROM highlight_sync_records WHERE user_id = ?1 AND highlight_id IN (SELECT json_extract(value, '$.id') FROM json_each(?2))"

/** Push, pull and receipts are one D1 transaction. Pull is AFTER push, so rejected stale writes are settled. */
export async function exchangeHighlights(db: D1Like, user: string, request: HighlightRequest): Promise<{ response: HighlightResponse; usage: ExchangeUsage }> {
  const changes = request.changes.map(r => ({ id: r.highlightId, value: highlightValue(r), time: r.updatedAt, deleted: r.deletedAt === undefined ? 0 : 1 }))
  const push = changes.length > 0, json = JSON.stringify(changes)
  const pull = db.prepare(PULL).bind(user, request.cursor, HIGHLIGHT_BATCH + 1)
  const statements = push ? [
    db.prepare('INSERT INTO highlight_sync_users (user_id, seq) VALUES (?1, 0) ON CONFLICT DO NOTHING').bind(user),
    db.prepare(PUSH).bind(user, json),
    db.prepare('UPDATE highlight_sync_users SET seq = seq + ?2 WHERE user_id = ?1').bind(user, changes.length),
    pull, db.prepare(RECEIPTS).bind(user, json),
  ] : [pull]
  const results = await db.batch<{ value: string; seq: number }>(statements)
  const found = results[push ? 3 : 0].results ?? []
  // Bound response bytes as well as count, including receipts for large quotes.
  const receipts = (push ? results[4].results ?? [] : []).map(r => parseAuthored(JSON.parse(r.value)))
  let bytes = new TextEncoder().encode(JSON.stringify(receipts)).length + 4096
  const page: typeof found = []
  for (const row of found.slice(0, HIGHLIGHT_BATCH)) {
    const size = new TextEncoder().encode(row.value).length + 16
    if (page.length && bytes + size > HIGHLIGHT_BODY_BYTES * 2) break
    page.push(row); bytes += size
  }
  const usage = { queries: statements.length, rowsRead: 0, rowsWritten: 0 }
  for (const r of results) { usage.rowsRead += r.meta?.rows_read ?? 0; usage.rowsWritten += r.meta?.rows_written ?? 0 }
  return { response: { protocol: HIGHLIGHT_SYNC, account: user, cursor: page.at(-1)?.seq ?? request.cursor, more: found.length > page.length, rows: page.map(r => parseAuthored(JSON.parse(r.value))), receipts }, usage }
}
