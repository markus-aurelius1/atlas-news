/** Pure C → D → E → F composition; labels, learner actions and network absent. */
import type { StageCInput } from './contracts.ts'
import type { NewsItem } from '../types.ts'
import { evaluateStageC } from './stage-c.ts'
import { classifySubject } from './subject.ts'
import { buildStories, type MetadataObservation, type SelectedReading } from './stories.ts'
import { selectReading } from './selection.ts'
import { NEWS_SOURCES } from '../sources.ts'
import { mergeMetadata } from './metadata.ts'

export function evaluateReading(input: StageCInput, history: MetadataObservation[], selected: SelectedReading[]) {
  const c = evaluateStageC(input), now = Date.parse(input.clock)
  const rows = new Map<string, NewsItem[]>()
  for (const o of input.observations) {
    const source = NEWS_SOURCES.find(s => s.id === o.sourceId)
    const m = o.metadata
    const item: NewsItem = { ...m, sourceId: o.sourceId, section: source?.section ?? m.memberships[0]?.section ?? '', bylines: m.bylines.map(b => ({ ...b, sourceId: o.sourceId })) }
    const prior = rows.get(m.url); if (prior) prior.push(item); else rows.set(m.url, [item])
  }
  const articles = c.articles.map(acceptance => { const item = mergeMetadata(rows.get(acceptance.url)!); return { item, acceptance, subject: classifySubject(item) } })
  const firstSeen = new Map<string, number>()
  for (const o of history) firstSeen.set(o.item.url, Math.min(firstSeen.get(o.item.url) ?? o.firstSeenAt, o.firstSeenAt))
  const observed = articles.filter(a => a.acceptance.accepted).map(a => ({ item: a.item, observedAt: now, firstSeenAt: firstSeen.get(a.item.url) ?? now }))
  const stories = buildStories(observed, history, selected, now), selection = selectReading(stories.units, articles, selected, now)
  return { version: 'tars-validator-v3/1' as const, clock: input.clock, c, articles, stories, selection }
}
