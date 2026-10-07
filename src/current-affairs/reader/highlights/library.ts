import { NEWS_SUBJECTS } from '../../subjects'
import type { ReaderHighlight } from './model'

export interface HighlightArticleGroup { articleUrl: string; snapshot: ReaderHighlight; passages: ReaderHighlight[]; activity: number }
export interface HighlightSubjectGroup { subject: string; articles: HighlightArticleGroup[]; count: number }
const subjectOf = (row: ReaderHighlight) => NEWS_SUBJECTS.some((s) => s === row.subjectSnapshot) ? row.subjectSnapshot! : 'Other'
const activityOrder = (a: ReaderHighlight, b: ReaderHighlight) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt || a.highlightId.localeCompare(b.highlightId)
/** Offsets are presentation hints only. Reader still requires H1's conservative context match. */
const passageOrder = (a: ReaderHighlight, b: ReaderHighlight) => {
  const positions = Number.isInteger(a.anchor.start) && Number.isInteger(b.anchor.start)
  return (positions ? a.anchor.start - b.anchor.start : 0) || a.createdAt - b.createdAt || a.highlightId.localeCompare(b.highlightId)
}
export function groupHighlights(records: ReaderHighlight[], query = ''): HighlightSubjectGroup[] {
  const groups = new Map<string, Map<string, ReaderHighlight[]>>()
  const needle = query.trim().toLocaleLowerCase()
  for (const row of records) {
    if (row.version !== 1 || row.deletedAt) continue
    if (needle && ![row.quote, row.title].some((text) => text.toLocaleLowerCase().includes(needle))) continue
    const subject = subjectOf(row)
    let articles = groups.get(subject)
    if (!articles) { articles = new Map(); groups.set(subject, articles) }
    const passages = articles.get(row.articleUrl) ?? []
    passages.push(row); articles.set(row.articleUrl, passages)
  }
  return [...NEWS_SUBJECTS, 'Other'].flatMap((subject) => {
    const articles = groups.get(subject)
    if (!articles) return []
    const rows = [...articles].map(([articleUrl, passages]) => {
      const snapshot = [...passages].sort(activityOrder)[0]
      return { articleUrl, snapshot, activity: snapshot.updatedAt, passages: passages.sort(passageOrder) }
    }).sort((a, b) => b.activity - a.activity || a.articleUrl.localeCompare(b.articleUrl))
    return [{ subject, articles: rows, count: rows.reduce((n, row) => n + row.passages.length, 0) }]
  })
}
