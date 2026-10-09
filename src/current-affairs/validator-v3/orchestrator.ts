/** Pure C → D → E → F composition; labels, learner actions and network absent. */
import type { StageCInput } from './contracts.ts'
import type { NewsItem } from '../types.ts'
import { evaluateStageC } from './stage-c.ts'
import { classifySubject, SUBJECT_POLICY, type SubjectDecision } from './subject.ts'
import { buildStories, type MetadataObservation, type SelectedReading } from './stories.ts'
import { selectReading } from './selection.ts'
import { NEWS_SOURCES } from '../sources.ts'
import { mergeMetadata } from './metadata.ts'
import { assess, readingSubject } from './editorial.ts'

export function evaluateReading(input: StageCInput, history: MetadataObservation[], selected: SelectedReading[]) {
  const c = evaluateStageC(input), now = Date.parse(input.clock)
  const rows = new Map<string, NewsItem[]>()
  for (const o of input.observations) {
    const source = NEWS_SOURCES.find(s => s.id === o.sourceId)
    const m = o.metadata
    const item: NewsItem = { ...m, sourceId: o.sourceId, section: source?.section ?? m.memberships[0]?.section ?? '', bylines: m.bylines.map(b => ({ ...b, sourceId: o.sourceId })) }
    const prior = rows.get(m.url); if (prior) prior.push(item); else rows.set(m.url, [item])
  }
  // Stage C supplies exclusions and named mechanisms; editorial value decides what is offered and under which subject.
  const articles = c.articles.map(stageC => {
    const item = mergeMetadata(rows.get(stageC.url)!), editorial = assess(item, stageC), accepted = editorial.accepted
    const acceptance = { ...stageC, accepted, decision: accepted ? 'accepted' as const : stageC.decision === 'accepted' ? 'rejected' as const : stageC.decision }
    // The frame classifier is consulted only for an article with no topic of its own.
    const subject: SubjectDecision = editorial.subject ? { policy: SUBJECT_POLICY, primary: editorial.subject, secondary: [], confidence: 'high', margin: 0, reason: 'dominant_frame', evidence: [] } : { ...classifySubject(item), primary: readingSubject(item, editorial) }
    return { item, acceptance, subject, editorial }
  })
  const firstSeen = new Map<string, number>()
  for (const o of history) firstSeen.set(o.item.url, Math.min(firstSeen.get(o.item.url) ?? o.firstSeenAt, o.firstSeenAt))
  const observed = articles.filter(a => a.acceptance.accepted).map(a => ({ item: a.item, observedAt: now, firstSeenAt: firstSeen.get(a.item.url) ?? now }))
  const stories = buildStories(observed, history, selected, now), selection = selectReading(stories.units, articles, selected, now)
  return { version: 'tars-validator-v3/1' as const, clock: input.clock, c, articles, stories, selection }
}
