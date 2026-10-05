/** Metadata-free personal state, keyed by canonical publisher URL so changing cluster primaries retain progress. */
import type { NewsEvent } from './types'
export const CA_STATE_KEY = 'tars.current-affairs.state.v1'
export const NOTE_LIMIT = 8000
export interface PersonalEntry { readAt?: number; savedAt?: number; ignoredAt?: number; note?: string }
export interface PersonalState { version: 1; entries: Record<string, PersonalEntry> }
export interface StateStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
const empty = (): PersonalState => ({ version: 1, entries: {} })
const timestamp = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0
export function parsePersonalState(raw: string | null): PersonalState {
  if (raw === null) return empty()
  const value = JSON.parse(raw)
  if (value?.version !== 1 || !value.entries || typeof value.entries !== 'object' || Array.isArray(value.entries)) throw new Error('Unrecognized Current Affairs state')
  const entries: Record<string, PersonalEntry> = {}
  for (const [key, entry] of Object.entries(value.entries)) {
    if (!/^https?:\/\//.test(key) || !entry || typeof entry !== 'object') continue
    const row = entry as PersonalEntry
    // Allowlist fields on read and write. Article metadata/body can never leak into this storage.
    entries[key] = { ...(timestamp(row.readAt) && { readAt: row.readAt }), ...(timestamp(row.savedAt) && { savedAt: row.savedAt }), ...(timestamp(row.ignoredAt) && { ignoredAt: row.ignoredAt }), ...(typeof row.note === 'string' && { note: row.note.slice(0, NOTE_LIMIT) }) }
  }
  return { version: 1, entries }
}
export function readPersonalState(storage: StateStorage): PersonalState { return parsePersonalState(storage.getItem(CA_STATE_KEY)) }
export function eventPersonalState(event: NewsEvent, state: PersonalState): PersonalEntry {
  // Further reports of the same event count too, so a story stays read when a better article replaces the one opened.
  const rows = [...event.members.map(m => m.url), ...(event.overflow ?? [])].map(url => state.entries[url]).filter((row): row is PersonalEntry => !!row)
  const earliest = (field: 'readAt' | 'savedAt' | 'ignoredAt') => { const values = rows.map(r => r[field]).filter(timestamp); return values.length ? Math.min(...values) : undefined }
  return { readAt: earliest('readAt'), savedAt: earliest('savedAt'), ignoredAt: earliest('ignoredAt'), note: rows.find(r => r.note)?.note ?? '' }
}
export function patchPersonalState(state: PersonalState, keys: string[], patch: PersonalEntry): PersonalState {
  const entries = { ...state.entries }
  for (const key of keys) {
    const row = { ...entries[key], ...patch }
    entries[key] = { ...(timestamp(row.readAt) && { readAt: row.readAt }), ...(timestamp(row.savedAt) && { savedAt: row.savedAt }), ...(timestamp(row.ignoredAt) && { ignoredAt: row.ignoredAt }), ...(row.note && { note: row.note.slice(0, NOTE_LIMIT) }) }
    if (!Object.keys(entries[key]).length) delete entries[key]
  }
  return { version: 1, entries }
}
export function writePersonalPatch(storage: StateStorage, event: NewsEvent, patch: PersonalEntry): PersonalState {
  // Reread for every action so another tab's unrelated changes aren't clobbered by a stale component snapshot.
  // A corrupt/future version or a failed write throws; the UI must never claim a durable save in that case.
  const next = patchPersonalState(readPersonalState(storage), event.members.map(m => m.url), patch)
  storage.setItem(CA_STATE_KEY, JSON.stringify(next))
  return next
}
