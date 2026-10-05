/** Archive retention, allowlisted metadata, transaction ordering and calendar boundaries. */
import { describe, expect, it, vi } from 'vitest'
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { ARCHIVE_DB, ARCHIVE_STORE, archiveDays, archiveRecord, periodKey, periodLabel, readArchive, retainArticles } from './archive'
import type { NewsItem } from './types'
const item = (overrides: Partial<NewsItem> = {}): NewsItem => ({ title: 'Ramsar wetland conservation', url: 'https://example.org/news', sourceId: 'dte-news', publisher: 'Down To Earth', section: 'Environment', description: 'RSS excerpt', publishedAt: '2026-10-01T06:00:00Z', ...overrides })
describe('Local article metadata archive', () => {
  it('keeps stories omitted from newer feeds, across reopened connections', async () => {
    const disk = new IDBFactory()
    await retainArticles([item()], 100, disk)
    await retainArticles([item({ url: 'https://example.org/new' })], 200, disk)
    await retainArticles([], 300, disk)
    expect((await readArchive(disk)).map(i => i.url).sort()).toEqual(['https://example.org/new', 'https://example.org/news'])
  })
  it('canonicalizes URLs and stores only bounded RSS metadata, never classification/state/body', () => {
    const row = archiveRecord({ ...item({ url: 'https://example.org/news?utm_source=rss', description: 'a'.repeat(900), thumbnailUrl: 'https://images.example.org/a.jpg' }), body: 'PROTECTED BODY', readAt: 100, relevance: {} } as NewsItem, 100)
    expect(row).toMatchObject({ url: 'https://example.org/news', firstSeenAt: 100, lastSeenAt: 100 })
    expect(row?.description).toHaveLength(600)
    expect(JSON.stringify(row)).not.toMatch(/PROTECTED BODY|readAt|relevance/)
    expect(archiveRecord(item({ sourceId: 'rbi-notifications' }), 100)).toBeNull()
    expect(archiveRecord(item({ url: 'javascript:alert(1)' }), 100)).toBeNull()
  })
  it('serializes concurrent refreshes and prevents stale responses overwriting fresher metadata', async () => {
    const disk = new IDBFactory()
    await retainArticles([item()], 100, disk)
    await Promise.all([retainArticles([item({ title: 'Fresh explainer' })], 300, disk), retainArticles([item({ title: 'Stale feed' })], 200, disk)])
    expect(await readArchive(disk)).toMatchObject([{ title: 'Fresh explainer', firstSeenAt: 100, lastSeenAt: 300 }])
  })
  it('rejects a future schema rather than replacing existing storage', async () => {
    const disk = new IDBFactory()
    await new Promise<void>((resolve, reject) => {
      const request = disk.open(ARCHIVE_DB, 2)
      request.onupgradeneeded = () => request.result.createObjectStore(ARCHIVE_STORE, { keyPath: 'url' })
      request.onsuccess = () => { request.result.close(); resolve() }
      request.onerror = () => reject(request.error)
    })
    await expect(retainArticles([item()], 100, disk)).rejects.toThrow()
    await expect(readArchive(disk)).rejects.toThrow()
  })
  it('rolls back a failed write without removing earlier articles or throwing from an event handler', async () => {
    const disk = new IDBFactory()
    await retainArticles([item()], 100, disk)
    const failure = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => { throw new DOMException('Storage quota', 'QuotaExceededError') })
    try { await expect(retainArticles([item({ url: 'https://example.org/new' })], 200, disk)).rejects.toThrow() }
    finally { failure.mockRestore() }
    expect(await readArchive(disk)).toMatchObject([{ url: 'https://example.org/news', lastSeenAt: 100 }])
  })
})
describe('Archive date views', () => {
  it('uses Monday weeks, including month/year boundaries, and keeps undated metadata distinct', () => {
    expect(periodKey('2027-01-01', 'Weekly')).toBe('2026-12-28')
    expect(periodKey('2026-10-04', 'Weekly')).toBe('2026-09-28')
    expect(periodKey('2026-10-05', 'Weekly')).toBe('2026-10-05')
    expect(periodKey('2026-10-01', 'Monthly')).toBe('2026-10')
    expect(periodKey('2026-10-01', 'Yearly')).toBe('2026')
    expect(periodKey('undated', 'Yearly')).toBe('undated')
    expect(periodLabel('2026-10', 'Monthly')).toBe('October 2026')
  })
  it('includes only days in the selected archive period without repeating topics', () => {
    const events = ['2026-09-30', '2026-10-01', '2026-10-01', '2025-10-01', 'undated'].map(day => ({ day }))
    expect(archiveDays(events, 'Monthly', '2026-10')).toEqual(['2026-10-01'])
    expect(archiveDays(events, 'Yearly', '2026')).toEqual(['2026-09-30', '2026-10-01'])
    expect(archiveDays(events, 'Daily', 'undated')).toEqual(['undated'])
  })
})
