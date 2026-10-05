/**
 * Sync exchange for the signed-in account: POST the rows this device changed and the last sequence number it
 * has seen; receive the rows it has not. The account is the one _middleware.ts verified, never one in the body.
 */
import { exchange, type D1Like } from '../../src/sync/d1.ts'
import { MAX_BODY_BYTES, parseSyncRequest, type SyncErrorCode } from '../../src/sync/protocol.ts'
import type { ApiData, ApiEnv } from './_middleware.ts'

const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
const refuse = (status: number, error: SyncErrorCode, extra: Record<string, string> = {}) => new Response(JSON.stringify({ error }), { status, headers: { ...headers, ...extra } })

export async function onRequest({ request, env, data }: { request: Request; env: ApiEnv; data: ApiData }): Promise<Response> {
  if (request.method !== 'POST') return refuse(405, 'method_not_allowed', { Allow: 'POST' })
  if (!data.user) return refuse(401, 'unauthenticated')
  // The Access cookie travels with any request to this origin, so only this origin's own pages may write.
  const origin = request.headers.get('Origin'), site = request.headers.get('Sec-Fetch-Site')
  if ((origin && origin !== new URL(request.url).origin) || (site && site !== 'same-origin')) return refuse(403, 'forbidden_origin')
  if (!/^application\/json\b/i.test(request.headers.get('Content-Type') ?? '')) return refuse(400, 'bad_request')
  if (!env.SYNC_DB) return refuse(503, 'storage_not_configured')

  const text = await request.text()
  if (text.length > MAX_BODY_BYTES) return refuse(413, 'too_large')
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return refuse(400, 'bad_request')
  }
  const now = Date.now()
  const parsed = parseSyncRequest(body, now)
  if ('error' in parsed) return refuse(parsed.error === 'too_large' ? 413 : parsed.error === 'clock_skew' ? 422 : 400, parsed.error)
  // A device linked to one account must not pour its data into another that signs in on it later.
  if (parsed.account !== undefined && parsed.account !== data.user.email) return refuse(409, 'account_mismatch')

  const { response, usage } = await exchange(env.SYNC_DB as D1Like, data.user.email, parsed, now)
  return new Response(JSON.stringify(response), { headers: { ...headers, 'X-Tars-Sync-Usage': `queries=${usage.queries};read=${usage.rowsRead};written=${usage.rowsWritten}` } })
}
