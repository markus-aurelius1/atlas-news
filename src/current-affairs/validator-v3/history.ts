/** Additive local metadata ledger. No learner stores, synced cursor or body data. */
import { articleMetadata } from '../archive'
import { storyFrame, STORY_POLICY, type MetadataObservation, type SelectedReading, type SelectionSnapshot } from './stories'

export const SELECTION_DB = 'tars-validator-v3-reading-v1'
export type { SelectionSnapshot }
function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(SELECTION_DB, 1)
    request.onupgradeneeded = () => { request.result.createObjectStore('history', { keyPath: 'id' }); request.result.createObjectStore('selected', { keyPath: 'id' }) }
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('Reading history is busy'))
    request.onsuccess = () => resolve(request.result)
  })
}
function cleanObservation(row: MetadataObservation): MetadataObservation | null {
  if (!row?.item || !Number.isFinite(row.observedAt) || !Number.isFinite(row.firstSeenAt) || row.firstSeenAt > row.observedAt) return null
  const clean = articleMetadata(row.item, row.observedAt)
  if (!clean) return null
  const { firstSeenAt: _first, lastSeenAt: _last, ...item } = clean
  return { item, observedAt: row.observedAt, firstSeenAt: row.firstSeenAt }
}
function cleanSelected(row: SelectedReading): SelectedReading | null {
  if (!row || typeof row.id !== 'string' || row.id.length > 8192 || !Number.isFinite(row.selectedAt) || !Number.isFinite(row.lastSelectedAt) || row.selectedAt > row.lastSelectedAt || !Array.isArray(row.members)) return null
  const article = cleanObservation({ item: row.representative, observedAt: row.lastSelectedAt, firstSeenAt: row.selectedAt })
  if (!article) return null
  return { id: row.id, selectedAt: row.selectedAt, lastSelectedAt: row.lastSelectedAt, representative: article.item,
    members: [...new Set([article.item.url, ...row.members.filter(m => typeof m === 'string' && m.length <= 2048 && /^https?:\/\//.test(m))])].sort(), frame: storyFrame(article.item) }
}
export async function readSelection(factory: IDBFactory = indexedDB): Promise<SelectionSnapshot> {
  const db = await open(factory)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['history', 'selected'], 'readonly'), history = tx.objectStore('history').getAll(), selected = tx.objectStore('selected').getAll()
    tx.oncomplete = () => { db.close(); resolve({ history: history.result.flatMap(row => cleanObservation(row) ?? []), selected: selected.result.flatMap(row => cleanSelected(row) ?? []) }) }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Reading history unavailable')) }
  })
}
/** Atomic monotonic merge; selected identities are never pruned by a cooldown.
 * Only disposable metadata observations beyond 14 days expire. */
export async function retainSelection(snapshot: SelectionSnapshot, now: number, factory: IDBFactory = indexedDB): Promise<void> {
  if (!Number.isFinite(now)) throw new Error('Explicit history clock required')
  const db = await open(factory), cutoff = now - STORY_POLICY.historyDays * 86400000
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['history', 'selected'], 'readwrite'), history = tx.objectStore('history'), selected = tx.objectStore('selected')
    const cursor = history.openCursor()
    cursor.onsuccess = () => { const row = cursor.result; if (!row) return; if (row.value.observedAt < cutoff) row.delete(); row.continue() }
    for (const raw of snapshot.history) {
      const clean = cleanObservation(raw)
      if (!clean || clean.observedAt < cutoff || clean.observedAt > now) continue
      const id = JSON.stringify([clean.item.url, clean.item.title, clean.item.description, clean.item.updatedAt]), request = history.get(id)
      request.onsuccess = () => { const prior = request.result as MetadataObservation | undefined; if (!prior || prior.observedAt <= clean.observedAt) history.put({ ...clean, id, firstSeenAt: Math.min(clean.firstSeenAt, prior?.firstSeenAt ?? clean.firstSeenAt) }) }
    }
    for (const raw of snapshot.selected) {
      const clean = cleanSelected(raw)
      if (!clean || clean.lastSelectedAt > now) continue
      const request = selected.get(clean.id)
      request.onsuccess = () => {
        const prior = request.result as SelectedReading | undefined
        if (!prior) selected.put(clean)
        else selected.put({ ...(prior.lastSelectedAt > clean.lastSelectedAt ? prior : clean), selectedAt: Math.min(prior.selectedAt, clean.selectedAt), members: [...new Set([...prior.members, ...clean.members])].sort() })
      }
    }
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Reading selection not retained')) }
  })
}
