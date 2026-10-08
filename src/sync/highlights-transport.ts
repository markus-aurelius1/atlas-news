import type { HighlightTransport } from './highlights-engine'
import { HIGHLIGHT_ENDPOINT, parseHighlightResponse } from './highlights-protocol'

export function highlightTransport(fetcher: typeof fetch = (input, init) => fetch(input, init)): HighlightTransport {
  return async request => {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, reason: 'offline' }
    let response: Response
    try {
      response = await fetcher(HIGHLIGHT_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), credentials: 'same-origin', cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(20_000) })
    } catch { return { ok: false, reason: 'offline' } }
    if (response.type === 'opaqueredirect' || response.status === 401 || response.status === 403 || (response.status >= 300 && response.status < 400)) return { ok: false, reason: 'signin' }
    if (response.status === 409) return { ok: false, reason: 'mismatch' }
    if (response.status === 422) return { ok: false, reason: 'clock' }
    if ([404, 405, 503].includes(response.status)) return { ok: false, reason: 'unavailable', detail: 'Highlights sync is unavailable here. Saved passages stay on this device; other personal-state sync is independent.' }
    if (!response.ok) return { ok: false, reason: 'error', detail: `Highlights HTTP ${response.status}` }
    try {
      const body = await response.json()
      if (body?.available === false) return { ok: false, reason: 'unavailable', detail: 'This copy has no sync service. Saved passages stay on this device.' }
      return { ok: true, response: parseHighlightResponse(body, request.cursor, request.account) }
    }
    catch { return { ok: false, reason: 'error', detail: 'Unexpected Highlights response' } }
  }
}
