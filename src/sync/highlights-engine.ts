import type { HighlightRepository } from '../current-affairs/reader/highlights/repository'
import { authored, compareHighlights, HIGHLIGHT_BATCH, HIGHLIGHT_BODY_BYTES, HIGHLIGHT_SYNC, highlightValue, parseAuthored, parseHighlightResponse, type AuthoredHighlight, type HighlightRequest, type HighlightResponse } from './highlights-protocol'
import type { SyncOutcome } from './engine'

export type HighlightTransport = (request: HighlightRequest) => Promise<{ ok: true; response: HighlightResponse } | { ok: false; reason: 'offline' | 'signin' | 'unavailable' | 'mismatch' | 'clock' | 'error'; detail?: string }>
export function createHighlightSync({ repository: repo, transport, linkedAccount, now = Date.now, maxRounds = 100 }: { repository: HighlightRepository; transport?: HighlightTransport; linkedAccount?: () => Promise<string | undefined>; now?: () => number; maxRounds?: number }) {
  let needsPull = false
  /** Discovery includes pre-H3 records and imported records, never local derived changes. */
  async function scan(): Promise<number> {
    return repo.transaction('rw', repo.records, repo.syncRows, repo.syncOutbox, async () => {
      const known = new Map((await repo.syncRows.toArray()).map(r => [r.highlightId, r.value]))
      const queued = new Map((await repo.syncOutbox.toArray()).map(r => [r.highlightId, r.value]))
      for (const record of await repo.records.toArray()) {
        const row = parseAuthored(authored(record)), value = highlightValue(row)
        if (known.get(row.highlightId) === value) {
          if (queued.has(row.highlightId)) await repo.syncOutbox.delete(row.highlightId)
        } else if (queued.get(row.highlightId) !== value) await repo.syncOutbox.put({ highlightId: row.highlightId, value })
      }
      // A missing local row (explicit erase/replace) is never interpreted as deletion.
      const ids = new Set(await repo.records.toCollection().primaryKeys())
      await repo.syncOutbox.bulkDelete([...queued.keys()].filter(id => !ids.has(id)))
      return repo.syncOutbox.count()
    })
  }
  async function batch(): Promise<AuthoredHighlight[]> {
    const rows: AuthoredHighlight[] = []
    let bytes = 4096
    for (const queued of await repo.syncOutbox.limit(HIGHLIGHT_BATCH).toArray()) {
      const row = parseAuthored(JSON.parse(queued.value))
      const size = new TextEncoder().encode(JSON.stringify(row)).length + 1
      if (rows.length && bytes + size > HIGHLIGHT_BODY_BYTES) break
      rows.push(row); bytes += size
    }
    return rows
  }
  async function receive(raw: HighlightResponse, request: HighlightRequest) {
    // Validate everything before opening a write transaction. A malformed page cannot move the cursor.
    const response = parseHighlightResponse(raw, request.cursor, request.account)
    const sentIds = new Set(request.changes.map(r => r.highlightId))
    if (response.receipts.length !== sentIds.size || response.receipts.some(r => !sentIds.has(r.highlightId))) throw new Error('Missing highlights receipts')
    await repo.transaction('rw', repo.records, repo.syncRows, repo.syncOutbox, repo.syncMeta, async () => {
      const meta = await repo.syncMeta.get('meta')
      if ((meta?.account && meta.account !== response.account) || (meta?.cursor ?? 0) !== request.cursor) throw new Error('Highlights account/cursor changed during exchange')
      const winners = new Map<string, AuthoredHighlight>()
      for (const remote of [...response.rows, ...response.receipts]) {
        const prior = winners.get(remote.highlightId)
        if (!prior || compareHighlights(remote, prior) > 0) winners.set(remote.highlightId, remote)
      }
      for (const remote of winners.values()) {
        const local = await repo.records.get(remote.highlightId)
        // Unknown future local rows stop sync rather than being overwritten.
        const localValue = local ? parseAuthored(authored(local)) : undefined
        const known = await repo.syncRows.get(remote.highlightId)
        const shadow = known ? parseAuthored(JSON.parse(known.value)) : undefined
        const agreed = shadow && compareHighlights(shadow, remote) > 0 ? shadow : remote
        const winner = localValue && compareHighlights(localValue, agreed) > 0 ? localValue : agreed
        if (!local || highlightValue(winner) !== highlightValue(localValue!)) await repo.records.put({ ...winner, resolution: local?.resolution ?? 'pending' })
        await repo.syncRows.put({ highlightId: remote.highlightId, value: highlightValue(agreed) })
        if (highlightValue(winner) === highlightValue(agreed)) await repo.syncOutbox.delete(remote.highlightId)
        else await repo.syncOutbox.put({ highlightId: winner.highlightId, value: highlightValue(winner) })
      }
      // Applying rows, recording versions, settling the outbox, binding account and cursor are atomic.
      await repo.syncMeta.put({ id: 'meta', account: response.account, cursor: response.cursor, lastSyncedAt: now() })
    })
    return response
  }
  async function sync(options: { onlyIfChanged?: boolean } = {}): Promise<SyncOutcome> {
    let pending = await scan()
    if (!transport) return { state: 'local', pending }
    const legacyAccount = await linkedAccount?.()
    let meta = await repo.syncMeta.get('meta')
    if (meta?.account && legacyAccount && meta.account !== legacyAccount) return { state: 'mismatch', pending }
    if (options.onlyIfChanged && !pending && !needsPull) return { state: 'local', pending }
    let sent = 0, received = 0
    for (let round = 0; round < maxRounds; round++) {
      meta = await repo.syncMeta.get('meta')
      // First exchange has NO writes. Persist authenticated binding before any authored payload is sent.
      const changes = meta?.account ? await batch() : []
      const account = meta?.account ?? legacyAccount
      const request: HighlightRequest = { protocol: HIGHLIGHT_SYNC, cursor: meta?.cursor ?? 0, ...(account ? { account } : {}), changes }
      const result = await transport(request)
      if (!result.ok) return { state: result.reason, pending, detail: result.detail }
      const response = await receive(result.response, request)
      needsPull = response.more
      sent += changes.length; received += response.rows.length
      pending = await scan()
      if (!response.more && !pending) return { state: 'synced', account: response.account, pending, sent, received, at: now() }
    }
    return { state: 'synced', account: (await repo.syncMeta.get('meta'))!.account!, pending, sent, received, at: now(), more: needsPull }
  }
  return { scan, sync }
}
