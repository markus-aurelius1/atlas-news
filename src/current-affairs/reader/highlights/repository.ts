import Dexie, { liveQuery, type Table } from 'dexie'
import { articleIdentity, parseHighlight, type HighlightArticle, type HighlightColor, type ReaderHighlight, type TextAnchor } from './model'
import { resolveAnchor } from './anchors'

export const HIGHLIGHTS_DB = 'tars-reader-highlights'
/** Separate local-only DB: lodestar v1/v2, feed cache, personal state and sync are untouched. */
export class HighlightRepository extends Dexie {
  records!: Table<ReaderHighlight, string>
  constructor(name = HIGHLIGHTS_DB, factory?: IDBFactory) {
    super(name, factory ? { indexedDB: factory, IDBKeyRange: globalThis.IDBKeyRange } : undefined)
    this.version(1).stores({ records: 'highlightId, articleUrl, updatedAt' })
  }
  /** Metadata/excerpts only, using H1's existing activity index; no feed/archive dependency. */
  async readAll() {
    return (await this.records.orderBy('updatedAt').reverse().toArray())
      .filter((r) => r.version === 1 && !r.deletedAt)
      .sort((a, b) => b.updatedAt - a.updatedAt || a.highlightId.localeCompare(b.highlightId))
  }
  observeAll(next: (records: ReaderHighlight[]) => void, error: (error: unknown) => void) {
    const subscription = liveQuery(() => this.readAll()).subscribe({ next, error })
    return () => subscription.unsubscribe()
  }
  async readByArticle(url: string) {
    return (await this.records.where('articleUrl').equals(articleIdentity(url)).toArray()).filter((r) => r.version === 1 && !r.deletedAt).sort((a, b) => a.createdAt - b.createdAt || a.highlightId.localeCompare(b.highlightId))
  }
  observe(url: string, next: (records: ReaderHighlight[]) => void, error: (error: unknown) => void) {
    const subscription = liveQuery(() => this.readByArticle(url)).subscribe({ next, error })
    return () => subscription.unsubscribe()
  }
  async create(article: HighlightArticle, selection: { quote: string; anchor: TextAnchor }, color: HighlightColor, text: string): Promise<{ record: ReaderHighlight; reused: boolean }> {
    const located = resolveAnchor(text, selection.anchor)
    if (!located || (located.start === 0 && located.end === text.length)) throw new Error('Select an excerpt from the article, then try again.')
    return this.transaction('rw', this.records, async () => {
      const current = await this.readByArticle(article.articleUrl)
      for (const record of current) {
        const at = resolveAnchor(text, record.anchor)
        if (!at) continue
        if (at.start === located.start && at.end === located.end) return { record, reused: true }
        if (at.start < located.end && located.start < at.end) throw new Error('This selection overlaps a highlight. Recolor or delete it in Highlight colors and edits.')
      }
      const now = Date.now()
      const record = parseHighlight({ ...article, ...selection, version: 1, highlightId: crypto.randomUUID(), color, createdAt: now, updatedAt: now, resolution: 'resolved' })
      await this.records.add(record)
      return { record, reused: false }
    })
  }
  async recolor(highlightId: string, color: HighlightColor) {
    await this.transaction('rw', this.records, async () => {
      const record = await this.records.get(highlightId)
      if (!record || record.deletedAt) return
      await this.records.put(parseHighlight({ ...record, color, updatedAt: Math.max(Date.now(), record.updatedAt + 1) }))
    })
  }
  async remove(highlightId: string) {
    await this.transaction('rw', this.records, async () => {
      const record = await this.records.get(highlightId)
      if (!record || record.deletedAt) return
      const now = Math.max(Date.now(), record.updatedAt + 1)
      await this.records.put(parseHighlight({ ...record, deletedAt: now, updatedAt: now }))
    })
  }
  /** Resolution is local derived state, not an edit timestamp or identity change. */
  async setResolution(statuses: Array<{ highlightId: string; resolution: ReaderHighlight['resolution'] }>) {
    if (!statuses.length) return
    await this.transaction('rw', this.records, async () => {
      for (const status of statuses) {
        const row = await this.records.get(status.highlightId)
        if (row?.version === 1 && !row.deletedAt && row.resolution !== status.resolution) await this.records.update(status.highlightId, { resolution: status.resolution })
      }
    })
  }
  /** Backup includes tombstones and opaque future rows; no bulk publisher text ever enters here. */
  async backup(): Promise<unknown[]> { return this.records.toArray() }
  async restore(rows: unknown[], mode: 'merge' | 'replace') {
    const incoming = rows.map(parseHighlight)
    await this.transaction('rw', this.records, async () => {
      // Preserve unknown future schemas even in an explicitly requested Replace.
      if (mode === 'replace') await this.records.filter((r) => r.version === 1).delete()
      for (const row of incoming) {
        const mine = await this.records.get(row.highlightId)
        if (mine && mine.version !== 1) continue
        if (!mine || row.updatedAt > mine.updatedAt || (row.updatedAt === mine.updatedAt && row.deletedAt && !mine.deletedAt)) await this.records.put({ ...row, resolution: 'pending' })
      }
    })
  }
}
export const highlights = new HighlightRepository()
