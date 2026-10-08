import { exchangeHighlights } from '../../src/sync/highlights-d1.ts'
import { HIGHLIGHT_BODY_BYTES, parseHighlightRequest, type HighlightRequest } from '../../src/sync/highlights-protocol.ts'
import type { D1Like } from '../../src/sync/d1.ts'
import type { ApiData, ApiEnv } from './_middleware.ts'

const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
const refuse = (status: number, error: string) => new Response(JSON.stringify({ error }), { status, headers })
export async function onRequest({ request, env, data }: { request: Request; env: ApiEnv; data: ApiData }): Promise<Response> {
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { ...headers, Allow: 'POST' } })
  if (!data.user) return refuse(401, 'unauthenticated')
  const origin = request.headers.get('Origin'), site = request.headers.get('Sec-Fetch-Site')
  if ((origin && origin !== new URL(request.url).origin) || (site && site !== 'same-origin')) return refuse(403, 'forbidden_origin')
  if (!/^application\/json\b/i.test(request.headers.get('Content-Type') ?? '')) return refuse(400, 'bad_request')
  if (!env.SYNC_DB) return refuse(503, 'storage_not_configured')
  // Bound streaming input before JSON parsing, including multibyte excerpts.
  const reader = request.body?.getReader()
  if (!reader) return refuse(400, 'bad_request')
  let bytes = 0, text = ''
  const decoder = new TextDecoder()
  let parsed: HighlightRequest
  try {
    for (;;) {
      const part = await reader.read()
      if (part.done) break
      bytes += part.value.byteLength
      if (bytes > HIGHLIGHT_BODY_BYTES) { await reader.cancel(); return refuse(413, 'too_large') }
      text += decoder.decode(part.value, { stream: true })
    }
    text += decoder.decode()
    parsed = parseHighlightRequest(JSON.parse(text), Date.now())
  } catch (error) {
    return refuse(error instanceof Error && error.message === 'clock_skew' ? 422 : 400, error instanceof Error && error.message === 'clock_skew' ? 'clock_skew' : 'bad_request')
  } finally { reader.releaseLock() }
  if (parsed.account !== undefined && parsed.account !== data.user.email) return refuse(409, 'account_mismatch')
  try {
    const { response, usage } = await exchangeHighlights(env.SYNC_DB as D1Like, data.user.email, parsed)
    return new Response(JSON.stringify(response), { headers: { ...headers, 'X-Tars-Highlight-Sync-Usage': `queries=${usage.queries};read=${usage.rowsRead};written=${usage.rowsWritten}` } })
  } catch { return refuse(503, 'storage_unavailable') }
}
