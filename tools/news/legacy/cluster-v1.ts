/** Frozen copy of the pre-optimisation clustering (strict complete-link on headline words), kept only as the audit baseline. */
import { normalize } from '../../../src/current-affairs/relevance.ts'
import { NEWS_SOURCES } from '../../../src/current-affairs/sources.ts'
import type { ClassifiedItem, NewsEvent } from '../../../src/current-affairs/types.ts'
import { publicationDay } from '../../../src/current-affairs/workspace.ts'
const stop = new Set('the a an of to in on for and by with as is at from after over new says said india indian rbi supreme court government'.split(' '))
const tokens = (title: string) => new Set(normalize(title).split(' ').filter(t => t.length > 2 && !stop.has(t)))
/** Per-item derivations are reused across the pairwise comparisons; the comparison itself is unchanged. */
const derived = new WeakMap<ClassifiedItem, { day: string; title: string; tokens: Set<string>; time: number }>()
function facts(item: ClassifiedItem) {
  let f = derived.get(item)
  if (!f) derived.set(item, f = { day: publicationDay(item.publishedAt), title: normalize(item.title), tokens: tokens(item.title), time: Date.parse(item.publishedAt ?? '') })
  return f
}
export function sameEvent(a: ClassifiedItem, b: ClassifiedItem): boolean {
  // Daily editions remain stable when an explainer arrives on a later day.
  if (!a.publishedAt || !b.publishedAt) return false
  const p = facts(a), q = facts(b)
  if (p.day !== q.day) return false
  if (p.title === q.title) return Math.abs(p.time - q.time) <= 48 * 3600000
  if (Math.abs(p.time - q.time) > 36 * 3600000) return false
  if (!a.relevance.staticAnchors.some(s => b.relevance.staticAnchors.includes(s))) return false
  const x = p.tokens, y = q.tokens, intersection = [...x].filter(t => y.has(t)).length
  return intersection >= 3 && intersection / Math.min(x.size, y.size) >= 0.6 && intersection / new Set([...x, ...y]).size >= 0.35
}
const priority = (item: ClassifiedItem) => NEWS_SOURCES.find(s => s.id === item.sourceId)?.priority ?? 9
/** Potential information value, inferred from RSS metadata, never a claim about a fetched article body. */
export function informationValue(item: ClassifiedItem): number {
  const depth = /explained|explainer|analysis|in.depth/i.test(item.section) ? 4 : /opinion|editorial|upsc/i.test(item.section) ? 2 : 0
  return depth * 10 + Math.min(6, new Set(normalize(item.description).split(' ').filter(t => t.length > 2)).size / 15)
}
const orderSources = (a: ClassifiedItem, b: ClassifiedItem) => informationValue(b) - informationValue(a) || priority(a) - priority(b) || b.relevance.score - a.relevance.score || a.url.localeCompare(b.url)
export function clusterItems(items: ClassifiedItem[]): NewsEvent[] {
  const groups: ClassifiedItem[][] = []
  const byDay = new Map<string, ClassifiedItem[][]>()
  for (const item of items.filter(i => i.relevance.accepted).sort((a, b) => (Date.parse(b.publishedAt ?? '') || 0) - (Date.parse(a.publishedAt ?? '') || 0) || a.url.localeCompare(b.url))) {
    const day = publicationDay(item.publishedAt), candidates = byDay.get(day) ?? []
    const group = candidates.find(g => g.every(other => sameEvent(item, other)))
    if (group) group.push(item)
    else { const next = [item]; groups.push(next); candidates.push(next); byDay.set(day, candidates) }
  }
  return groups.map(members => { members.sort(orderSources); return { id: members.map(i => i.url).sort()[0], primary: members[0], members } })
}
