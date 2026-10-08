/** An independent stream. Never add these records to the legacy collections/cursor. */
import { parseHighlight, type ReaderHighlight } from '../current-affairs/reader/highlights/model.ts'
import { canon, CLOCK_TOLERANCE_MS } from './protocol.ts'

export const HIGHLIGHT_SYNC = 'tars-highlight-sync/v1' as const
export const HIGHLIGHT_ENDPOINT = '/api/highlights-sync'
export const HIGHLIGHT_BATCH = 100
export const HIGHLIGHT_BODY_BYTES = 512_000
export type AuthoredHighlight = Omit<ReaderHighlight, 'resolution'>
export interface HighlightRequest {
  protocol: typeof HIGHLIGHT_SYNC
  cursor: number
  /** Required for writes; an account precondition, never the authenticated identity. */
  account?: string
  changes: AuthoredHighlight[]
}
export interface HighlightResponse {
  protocol: typeof HIGHLIGHT_SYNC
  account: string
  cursor: number
  more: boolean
  rows: AuthoredHighlight[]
  /** Current server winners for every sent ID, including rejected stale writes. */
  receipts: AuthoredHighlight[]
}
const FIELDS = ['version', 'highlightId', 'articleUrl', 'title', 'publisher', 'sourceId', 'publishedAt', 'subjectSnapshot', 'categorySnapshot', 'quote', 'anchor', 'color', 'createdAt', 'updatedAt', 'deletedAt']
const ANCHOR_FIELDS = ['version', 'quote', 'prefix', 'suffix', 'start', 'end']
function exactKeys(raw: unknown, allowed: string[]): asserts raw is Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some(k => !allowed.includes(k))) throw new Error('Unknown highlight fields')
}
/** Strict wire parser, using H1 bounds/URL identity. Local derived fields are forbidden. */
export function parseAuthored(raw: unknown): AuthoredHighlight {
  exactKeys(raw, FIELDS)
  exactKeys(raw.anchor, ANCHOR_FIELDS)
  const row = parseHighlight({ ...raw, resolution: 'pending' })
  if (row.articleUrl !== raw.articleUrl || row.updatedAt < row.createdAt || (row.deletedAt !== undefined && (row.deletedAt < row.createdAt || row.deletedAt > row.updatedAt))) throw new Error('Invalid highlight chronology or URL')
  return authored(row)
}
export function authored(row: ReaderHighlight): AuthoredHighlight {
  const { resolution: _resolution, ...value } = parseHighlight(row)
  return value
}
/** ASCII ensures JS and SQLite BINARY use exactly the same tie ordering, including Unicode. */
export const highlightValue = (row: AuthoredHighlight) => canon(row).replace(/[\u007f-\uffff]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`)
/** Tombstone first, then edit time, then the canonical ASCII payload. Strict total order. */
export function compareHighlights(a: AuthoredHighlight, b: AuthoredHighlight): number {
  const deletion = Number(a.deletedAt !== undefined) - Number(b.deletedAt !== undefined)
  if (deletion) return deletion
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? 1 : -1
  const av = highlightValue(a), bv = highlightValue(b)
  return av === bv ? 0 : av > bv ? 1 : -1
}
export function parseHighlightRequest(raw: unknown, now: number): HighlightRequest {
  exactKeys(raw, ['protocol', 'cursor', 'account', 'changes'])
  if (raw.protocol !== HIGHLIGHT_SYNC || !Number.isSafeInteger(raw.cursor) || (raw.cursor as number) < 0 || !Array.isArray(raw.changes) || raw.changes.length > HIGHLIGHT_BATCH) throw new Error('Invalid highlights request')
  if (raw.account !== undefined && (typeof raw.account !== 'string' || !raw.account || raw.account.length > 320)) throw new Error('Invalid account precondition')
  if (raw.changes.length && !raw.account) throw new Error('Bind the account before writing')
  const changes = raw.changes.map(parseAuthored)
  if (new Set(changes.map(r => r.highlightId)).size !== changes.length) throw new Error('Duplicate highlight IDs')
  if (changes.some(r => r.updatedAt > now + CLOCK_TOLERANCE_MS)) throw new Error('clock_skew')
  return { protocol: HIGHLIGHT_SYNC, cursor: raw.cursor as number, ...(raw.account ? { account: raw.account as string } : {}), changes }
}
export function parseHighlightResponse(raw: unknown, cursor: number, account?: string): HighlightResponse {
  exactKeys(raw, ['protocol', 'account', 'cursor', 'more', 'rows', 'receipts'])
  if (raw.protocol !== HIGHLIGHT_SYNC || typeof raw.account !== 'string' || !raw.account || raw.account.length > 320 || (account && raw.account !== account) || !Number.isSafeInteger(raw.cursor) || (raw.cursor as number) < cursor || typeof raw.more !== 'boolean' || !Array.isArray(raw.rows) || raw.rows.length > HIGHLIGHT_BATCH || !Array.isArray(raw.receipts) || raw.receipts.length > HIGHLIGHT_BATCH) throw new Error('Invalid highlights response')
  const rows = raw.rows.map(parseAuthored), receipts = raw.receipts.map(parseAuthored)
  if ([rows, receipts].some(list => new Set(list.map(r => r.highlightId)).size !== list.length)) throw new Error('Duplicate response IDs')
  if (raw.more && (raw.cursor === cursor || !rows.length)) throw new Error('Non-progressing highlights page')
  return { protocol: HIGHLIGHT_SYNC, account: raw.account, cursor: raw.cursor as number, more: raw.more, rows, receipts }
}
