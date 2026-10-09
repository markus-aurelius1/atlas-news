/** Browser ingress/egress only; no fetching and no full-body storage. */
import type { NewsItem, ClassifiedItem, RelevanceIndex, RelevanceSignal, FeedResponse } from '../types.ts'
import { PhraseMatcher, tokenize } from '../match.ts'
import { articleMetadata } from '../archive.ts'
import { publicationDay, readingMinutes, type WorkspaceEvent } from '../workspace.ts'
import { NEWS_SOURCES, activeFeedItems } from '../sources.ts'
import { assess, readingSubject, type Editorial } from './editorial.ts'
import { evaluateReading } from './orchestrator.ts'
import type { StageCInput, StageCMetadata } from './contracts.ts'
import type { SelectionSnapshot } from './stories.ts'
import { RUNTIME_VERSIONS } from './runtime-manifest.ts'

export type ValidatorMode = 'v2' | 'shadow' | 'v3'
export function validatorMode(value = import.meta.env.VITE_NEWS_VALIDATOR): ValidatorMode { return value === 'v3' || value === 'shadow' ? value : 'v2' }
function canonical(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']'
  if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([k, v]) => JSON.stringify(k) + ':' + canonical(v)).join(',') + '}'
  return JSON.stringify(value)
}
const sha = async (value: unknown) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical(value))))].map(b => b.toString(16).padStart(2, '0')).join('')
export async function productionInput(items: NewsItem[], clock: string): Promise<StageCInput> {
  const now = Date.parse(clock)
  if (!Number.isFinite(now)) throw new Error('Explicit production clock required')
  const normalized = items.flatMap(item => articleMetadata(item, now) ?? []).sort((a, b) => a.url.localeCompare(b.url) || canonical(a).localeCompare(canonical(b)))
  const observations = await Promise.all(normalized.map(async (item, ordinal) => {
    const source = NEWS_SOURCES.find(s => s.id === item.sourceId)
    const metadata: StageCMetadata = { url: item.url, title: item.title, description: item.description, publisher: item.publisher, memberships: item.memberships ?? (source ? [{ sourceId: source.id, feedUrl: source.feedUrl, section: source.section }] : []), categories: item.categories ?? [], bylines: (item.bylines ?? []).filter(b => b.sourceId === item.sourceId).map(({ name, provenance }) => ({ name, provenance })), publishedAt: item.publishedAt, updatedAt: item.updatedAt ?? null }
    const metadataHash = await sha(metadata)
    return { id: await sha([clock, item.sourceId, ordinal, metadataHash]), captureId: 'local-feed:' + clock, sourceId: item.sourceId, ordinal, capturedAt: clock, parserVersion: 'tars-local-cache-adapter/1', registryHash: RUNTIME_VERSIONS.registryHash, metadataHash, metadata }
  }))
  return { observations: observations.filter(o => [o.metadata.publishedAt, o.metadata.updatedAt].every(t => t === null || Date.parse(t) <= now)), clock, versions: { ...RUNTIME_VERSIONS } }
}
const matchers = new WeakMap<RelevanceIndex, PhraseMatcher<RelevanceSignal>>()
/** The card a reader sees: the subject it is shelved under and, in the debug view, every point behind its value. */
export function displayArticle(item: NewsItem, index: RelevanceIndex, accepted = true, editorial: Editorial = assess(item)): ClassifiedItem {
  let matcher = matchers.get(index)
  if (!matcher) { matcher = new PhraseMatcher(); for (const signal of index.signals) for (const alias of signal.aliases) matcher.add(alias, signal, signal.concept); matchers.set(index, matcher) }
  const links = [...new Set(matcher.scan(tokenize(item.title + ' ' + item.description)).map(hit => hit.value))], subject = readingSubject(item, editorial)
  const prelims = links.some(s => s.prelimsDemand), mains = links.some(s => s.mainsDemand)
  const evidence = editorial.reasons.map(r => ({ kind: r.points < 0 ? 'noise' as const : 'framing' as const, label: r.text ? `${r.label} (“${r.text}”)` : r.label, points: r.points }))
  return { ...item, relevance: { accepted, score: editorial.score, threshold: editorial.floor, exam: prelims && mains ? 'both' : prelims ? 'prelims' : mains ? 'mains' : 'general', subjects: [subject], topics: [], staticAnchors: links.map(s => s.concept), signals: [], evidence, ...(editorial.excluded ? { rejectionReason: editorial.excluded } : {}) } }
}
export function readingEvents(output: ReturnType<typeof evaluateReading>, index: RelevanceIndex): WorkspaceEvent[] {
  const today = new Map(output.selection.today.map((r, rank) => [r.unit.id, { reading: r, rank }])), editorial = new Map(output.articles.map(a => [a.item.url, a.editorial]))
  const display = (item: NewsItem) => displayArticle(item, index, true, editorial.get(item.url))
  return output.selection.retained.map(selected => {
    const current = today.get(selected.id), primary = display(selected.representative)
    const shown = current ? current.reading.unit.members.map(display).filter(m => m.url !== primary.url) : []
    const members = [primary, ...shown.slice(0, 4)], currentMust = current?.reading.mustRead ?? false
    const event = { id: selected.id, primary, members, overflow: selected.members.filter(url => !members.some(m => m.url === url)) }
    return { ...event, mustRead: currentMust, priority: currentMust ? 2 : 1, priorityReasons: [current?.reading.reason ?? 'Previously selected reading'], value: current?.reading.quality ?? 0, valueReasons: [], minutes: readingMinutes(event), day: publicationDay(selected.selectedAt), v3: { selectedAt: selected.selectedAt, today: !!current, rank: current?.rank ?? Number.MAX_SAFE_INTEGER } }
  })
}
export async function evaluateProduction(feed: FeedResponse, index: RelevanceIndex, snapshot: SelectionSnapshot, clock: string) {
  // Older selected representatives participate in replacement comparisons; the
  // ledger itself is preserved even if current policy no longer accepts them.
  const items = new Map(snapshot.selected.map(s => [s.representative.url, s.representative]))
  for (const item of activeFeedItems(feed.items)) items.set(item.url, item)
  const input = await productionInput([...items.values()], clock), output = evaluateReading(input, snapshot.history, snapshot.selected)
  return { output, events: readingEvents(output, index), snapshot: { history: output.stories.history, selected: output.selection.retained } }
}
