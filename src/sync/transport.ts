/** The browser's side of /api/sync. Same-origin, so the Access session cookie travels with it. */
import type { Transport } from './engine.ts'
import { SYNC_ENDPOINT, SYNC_VERSION, type SyncResponse } from './protocol.ts'

const TIMEOUT_MS = 20_000

export function fetchTransport(fetcher: typeof fetch = (input, init) => fetch(input, init), endpoint = SYNC_ENDPOINT): Transport {
  return async (request) => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, reason: 'offline' }
    let response: Response
    try {
      // An expired Access session answers with a redirect to the login page; following it would only fail on CORS.
      response = await fetcher(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), credentials: 'same-origin', cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) })
    } catch {
      return { ok: false, reason: 'offline' }
    }
    if (response.type === 'opaqueredirect' || response.status === 401 || response.status === 403 || (response.status >= 300 && response.status < 400)) {
      const code = await errorCode(response)
      return code === 'forbidden_origin' ? { ok: false, reason: 'error', detail: code } : { ok: false, reason: 'signin' }
    }
    if (response.status === 409) return { ok: false, reason: 'mismatch' }
    if (response.status === 422) return { ok: false, reason: 'clock' }
    if (!response.ok) {
      const code = await errorCode(response)
      // No function at this address (local development, a static host) or one that is not set up yet.
      if (response.status === 404 || response.status === 405 || code === 'access_not_configured' || code === 'storage_not_configured') return { ok: false, reason: 'unavailable', detail: code }
      return { ok: false, reason: 'error', detail: code || `HTTP ${response.status}` }
    }
    let body: SyncResponse & { available?: boolean }
    try {
      body = (await response.json()) as SyncResponse & { available?: boolean }
    } catch {
      // A page instead of JSON: a host that answers every path with the app shell.
      return { ok: false, reason: 'unavailable' }
    }
    // The local development server's answer: there is no sync service behind it.
    if (body?.available === false) return { ok: false, reason: 'unavailable' }
    if (body?.v !== SYNC_VERSION || typeof body.account !== 'string' || !Number.isSafeInteger(body.cursor) || !Array.isArray(body.rows)) return { ok: false, reason: 'error', detail: 'Unexpected response' }
    return { ok: true, response: body }
  }
}

async function errorCode(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown }
    return typeof body.error === 'string' ? body.error : ''
  } catch {
    return ''
  }
}
