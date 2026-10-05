/**
 * Wire contract shared by the app and the Pages function.
 *
 * Everything that syncs is a row: a collection, a key, a JSON value and the time it last changed. The newest
 * `t` wins for a key; a deletion is a row with `d: 1` and no value (a tombstone), so it wins or loses by the
 * same rule. The server numbers every accepted row per account (`seq`), and a device asks only for rows after
 * the last number it has seen (its cursor).
 */
export const SYNC_VERSION = 1
export const SYNC_ENDPOINT = '/api/sync'
export const SESSION_ENDPOINT = '/api/session'

/**
 * news      `${field}:${url}` → the Read / Saved / Removed time or the article note
 * article   url → publisher metadata of a Saved article
 * note      id → a short note
 * recall    id → one Atlas recall attempt        claim  id → one recall reward claim
 * settings  field → one preference
 */
export const COLLECTIONS = ['news', 'article', 'note', 'recall', 'claim', 'settings'] as const
export type Collection = (typeof COLLECTIONS)[number]

export interface SyncRow {
  c: Collection
  k: string
  /** JSON text; null for a tombstone. */
  v: string | null
  /** Last-change time in ms. The larger one wins. */
  t: number
  d: 0 | 1
}

export interface SyncRequest {
  v: typeof SYNC_VERSION
  /** Last server sequence number this device has applied. */
  cursor: number
  /** The account this device is linked to, as the server reported it. A precondition, never an identity. */
  account?: string
  changes: SyncRow[]
}

export interface SyncResponse {
  v: typeof SYNC_VERSION
  /** The signed-in account, from the validated Access token. */
  account: string
  cursor: number
  /** More rows are waiting after `cursor`. */
  more: boolean
  rows: SyncRow[]
}

export type SyncErrorCode = 'unauthenticated' | 'access_not_configured' | 'storage_not_configured' | 'account_mismatch' | 'clock_skew' | 'bad_request' | 'too_large' | 'forbidden_origin' | 'method_not_allowed'

export const MAX_PUSH_ROWS = 400
export const MAX_PULL_ROWS = 500
export const MAX_KEY_LENGTH = 2048
export const MAX_VALUE_LENGTH = 32 * 1024
/** D1 binds the whole change set as one JSON parameter, which may not exceed 2 MB. */
export const MAX_BODY_BYTES = 1_000_000
/** A device whose clock runs further ahead than this would win every conflict; it is refused instead. */
export const CLOCK_TOLERANCE_MS = 10 * 60 * 1000

const isCollection = (value: unknown): value is Collection => typeof value === 'string' && (COLLECTIONS as readonly string[]).includes(value)

/** Check a request body. Returns the cleaned request, or the reason it was refused. */
export function parseSyncRequest(raw: unknown, now: number): SyncRequest | { error: SyncErrorCode } {
  const bad = { error: 'bad_request' as const }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return bad
  const body = raw as Partial<SyncRequest>
  if (body.v !== SYNC_VERSION || !Number.isSafeInteger(body.cursor) || body.cursor! < 0 || !Array.isArray(body.changes)) return bad
  if (body.account !== undefined && (typeof body.account !== 'string' || body.account.length > 320)) return bad
  if (body.changes.length > MAX_PUSH_ROWS) return { error: 'too_large' }
  const changes: SyncRow[] = []
  const seen = new Set<string>()
  for (const row of body.changes as Partial<SyncRow>[]) {
    if (!row || typeof row !== 'object' || !isCollection(row.c) || typeof row.k !== 'string' || !row.k || row.k.length > MAX_KEY_LENGTH) return bad
    if (!Number.isSafeInteger(row.t) || row.t! <= 0 || (row.d !== 0 && row.d !== 1)) return bad
    if (row.d === 1 ? row.v !== null && row.v !== undefined : typeof row.v !== 'string') return bad
    if (typeof row.v === 'string' && row.v.length > MAX_VALUE_LENGTH) return { error: 'too_large' }
    if (row.t! > now + CLOCK_TOLERANCE_MS) return { error: 'clock_skew' }
    // One statement writes the whole set, so a key may appear only once in it.
    const id = `${row.c}\n${row.k}`
    if (seen.has(id)) return bad
    seen.add(id)
    changes.push({ c: row.c, k: row.k, v: row.d === 1 ? null : (row.v as string), t: row.t!, d: row.d })
  }
  return { v: SYNC_VERSION, cursor: body.cursor!, ...(body.account !== undefined ? { account: body.account } : {}), changes }
}

/** JSON with object keys in a fixed order, so equal values are equal strings. */
export function canon(value: unknown): string {
  return JSON.stringify(value, (_key, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, (v as Record<string, unknown>)[k]])) : v))
}
