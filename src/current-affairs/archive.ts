/** Local metadata archive, separate from learner Dexie and Workbox's latest response. No article bodies or stored counters. */
import { canonicalUrl, thumbnailUrl } from './feed.ts'
import { isActiveSource } from './sources.ts'
import { optionalMetadata, mergeMetadata } from './validator-v3/metadata.ts'
import { editionLabel, shiftDay, UNDATED } from './workspace.ts'
import type { NewsItem } from './types.ts'
export const ARCHIVE_DB = 'tars-current-affairs-archive-v1'
export const ARCHIVE_STORE = 'articles'
export interface ArchivedArticle extends NewsItem { firstSeenAt: number; lastSeenAt: number }
export type ArchivePeriod = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly'
export const archivePeriods: ArchivePeriod[] = ['Daily', 'Weekly', 'Monthly', 'Yearly']
/** Allowlisted, length-limited publisher metadata for one article, whatever has since become of its source. */
export function articleMetadata(item: NewsItem, seenAt: number): ArchivedArticle | null {
  const url = canonicalUrl(item.url)
  if (!url || url.length > 2048 || !Number.isFinite(seenAt) || typeof item.title !== 'string' || typeof item.publisher !== 'string' || typeof item.sourceId !== 'string' || typeof item.section !== 'string' || typeof item.description !== 'string') return null
  const image = item.thumbnailUrl && thumbnailUrl(item.thumbnailUrl)
  return { ...optionalMetadata(item), url, title: item.title.slice(0, 400), publisher: item.publisher.slice(0, 100), sourceId: item.sourceId, section: item.section.slice(0, 100), description: item.description.slice(0, 600), publishedAt: item.publishedAt && Number.isFinite(Date.parse(item.publishedAt)) ? new Date(item.publishedAt).toISOString() : null, ...(image ? { thumbnailUrl: image } : {}), firstSeenAt: seenAt, lastSeenAt: seenAt }
}
export function archiveRecord(item: NewsItem, seenAt: number): ArchivedArticle | null {
  return isActiveSource(item.sourceId) ? articleMetadata(item, seenAt) : null
}
export function periodKey(day: string, period: ArchivePeriod): string {
  if (day === UNDATED) return UNDATED
  if (period === 'Yearly') return day.slice(0, 4)
  if (period === 'Monthly') return day.slice(0, 7)
  if (period === 'Weekly') return shiftDay(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7))
  return day
}
export function periodLabel(key: string, period: ArchivePeriod): string {
  if (key === UNDATED) return 'Undated'
  if (period === 'Yearly') return key
  if (period === 'Monthly') return new Date(`${key}-01T12:00:00Z`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })
  return `${period === 'Weekly' ? 'Week of ' : ''}${editionLabel(key)} ${key.slice(0, 4)}`
}
export function archiveDays(items: { day: string }[], period: ArchivePeriod, key: string): string[] {
  return [...new Set(items.filter(item => periodKey(item.day, period) === key).map(item => item.day))]
}
function openArchive(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(ARCHIVE_DB, 1)
    let settled = false
    const timeout = setTimeout(() => { settled = true; reject(new Error('Archive storage is busy')) }, 5000)
    request.onupgradeneeded = () => request.result.createObjectStore(ARCHIVE_STORE, { keyPath: 'url' })
    request.onsuccess = () => { clearTimeout(timeout); if (settled) request.result.close(); else resolve(request.result) }
    request.onerror = () => { clearTimeout(timeout); reject(request.error) }
  })
}
export async function readArchive(factory: IDBFactory = indexedDB): Promise<ArchivedArticle[]> {
  const db = await openArchive(factory)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ARCHIVE_STORE, 'readonly'), request = tx.objectStore(ARCHIVE_STORE).getAll()
    tx.oncomplete = () => { db.close(); resolve(request.result.filter((row: ArchivedArticle) => isActiveSource(row.sourceId))) }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Archive read failed')) }
  })
}
/** Stored rows for these URLs, including ones whose source is no longer in the registry: a Saved article outlives its feed. */
export async function readArchivedByUrl(urls: string[], factory: IDBFactory = indexedDB): Promise<ArchivedArticle[]> {
  if (!urls.length) return []
  const db = await openArchive(factory)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ARCHIVE_STORE, 'readonly'), store = tx.objectStore(ARCHIVE_STORE), found: ArchivedArticle[] = []
    for (const url of urls) { const request = store.get(url); request.onsuccess = () => { if (request.result) found.push(request.result as ArchivedArticle) } }
    tx.oncomplete = () => { db.close(); resolve(found) }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Archive read failed')) }
  })
}
/**
 * Put back article metadata from a backup. Each row is cleaned exactly as a fetched one is (allowlisted fields, length
 * limits, active publishers), keeps the times it was first and last seen, and never replaces a fresher local row.
 */
export async function restoreArticles(rows: ArchivedArticle[], factory: IDBFactory = indexedDB): Promise<number> {
  const clean = rows.flatMap(row => {
    const seen = Number.isFinite(row.lastSeenAt) && row.lastSeenAt > 0 ? row.lastSeenAt : 0
    const next = seen ? archiveRecord(row, seen) : null
    return next ? [{ ...next, firstSeenAt: Number.isFinite(row.firstSeenAt) && row.firstSeenAt > 0 ? Math.min(row.firstSeenAt, seen) : seen }] : []
  })
  if (!clean.length) return 0
  const db = await openArchive(factory)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ARCHIVE_STORE, 'readwrite'), store = tx.objectStore(ARCHIVE_STORE)
    let written = 0
    for (const next of clean) {
      const request = store.get(next.url)
      request.onsuccess = () => {
        const prior = request.result as ArchivedArticle | undefined
        try {
          if (!prior) { store.put(next); written++ }
          else if (prior.lastSeenAt < next.lastSeenAt) { store.put({ ...next, ...optionalMetadata(mergeMetadata([prior,next])), firstSeenAt: Math.min(prior.firstSeenAt, next.firstSeenAt) }); written++ }
          else if (prior.firstSeenAt > next.firstSeenAt) store.put({ ...prior, firstSeenAt: next.firstSeenAt })
        } catch { tx.abort() }
      }
    }
    tx.oncomplete = () => { db.close(); resolve(written) }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Archive write failed')) }
  })
}
export async function retainArticles(items: NewsItem[], seenAt: number, factory: IDBFactory = indexedDB): Promise<void> {
  if (!items.length) return
  const db = await openArchive(factory)
  return new Promise((resolve, reject) => {
    const tx = db.transaction(ARCHIVE_STORE, 'readwrite'), store = tx.objectStore(ARCHIVE_STORE)
    for (const item of items) {
      const next = archiveRecord(item, seenAt)
      if (!next) continue
      const request = store.get(next.url)
      request.onsuccess = () => {
        const prior = request.result as ArchivedArticle | undefined
        try { if (!prior || prior.lastSeenAt <= next.lastSeenAt) store.put({ ...next, ...(prior ? optionalMetadata(mergeMetadata([prior,next])) : {}), firstSeenAt: prior ? Math.min(prior.firstSeenAt, seenAt) : seenAt }) }
        catch { tx.abort() }
      }
    }
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Archive write failed')) }
  })
}
