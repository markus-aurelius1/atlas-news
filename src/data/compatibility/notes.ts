/** Historical note wire format, used only by backup import/export. */
export const CA_NOTES_KEY = 'tars.current-affairs.notes.v1'
export const STICKY_NOTE_LIMIT = 300
export interface StickyNote { id: string; text: string; createdAt: number; createdDate: string; deletedAt?: number }
export interface StickyNotes { version: 1; entries: Record<string, StickyNote> }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export function parseStickyNotes(raw: string | null): StickyNotes {
  if (raw === null) return { version: 1, entries: {} }
  const value = JSON.parse(raw)
  if (value?.version !== 1 || !value.entries || typeof value.entries !== 'object' || Array.isArray(value.entries)) throw new Error('Unrecognized notes format')
  const entries: Record<string, StickyNote> = {}
  for (const [id, row] of Object.entries(value.entries) as [string, StickyNote][]) {
    if (!uuid.test(id) || !row || typeof row.text !== 'string' || !Number.isFinite(row.createdAt) || row.createdAt <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(row.createdDate) || !Number.isFinite(Date.parse(row.createdDate))) continue
    entries[id] = { id, text: row.text.slice(0, STICKY_NOTE_LIMIT), createdAt: row.createdAt, createdDate: row.createdDate, ...(typeof row.deletedAt === 'number' && Number.isFinite(row.deletedAt) && row.deletedAt > 0 ? { deletedAt: row.deletedAt } : {}) }
  }
  return { version: 1, entries }
}
