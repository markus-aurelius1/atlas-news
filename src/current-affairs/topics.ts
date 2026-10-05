/**
 * Topic groups for the reading list: stories on one syllabus concept, and every publisher's
 * article on one story, fold under a single anchor article. Pure presentation grouping –
 * nothing is discarded, and Read/Saved state stays keyed to each story's own URLs.
 */
import { ANCHOR_PUBLISHERS, MAX_STORY_ARTICLES, informationValue } from './cluster.ts'
import { NEWS_SOURCES } from './sources.ts'
import type { ClassifiedItem } from './types.ts'
import type { WorkspaceEvent } from './workspace.ts'

export { ANCHOR_PUBLISHERS }
export const isAnchorPublisher = (item: Pick<ClassifiedItem, 'publisher'>) => ANCHOR_PUBLISHERS.includes(item.publisher)

const sourcePriority = (item: ClassifiedItem) => NEWS_SOURCES.find((s) => s.id === item.sourceId)?.priority ?? 9
const published = (item: ClassifiedItem) => Date.parse(item.publishedAt ?? '') || 0

/**
 * Which of two articles should stand for a group. A preferred publisher first; then the more complete article
 * (the feed's own depth and excerpt evidence, as clustering uses), source priority and relevance; then a longer
 * excerpt, the newer article and finally the URL, so the choice never depends on input order.
 */
export function anchorOrder(a: ClassifiedItem, b: ClassifiedItem): number {
  return (
    Number(isAnchorPublisher(b)) - Number(isAnchorPublisher(a)) ||
    informationValue(b) - informationValue(a) ||
    sourcePriority(a) - sourcePriority(b) ||
    b.relevance.score - a.relevance.score ||
    b.description.length - a.description.length ||
    published(b) - published(a) ||
    a.url.localeCompare(b.url)
  )
}

export function pickAnchor(items: ClassifiedItem[]): ClassifiedItem {
  return [...items].sort(anchorOrder)[0]
}

export interface TopicEntry {
  event: WorkspaceEvent
  item: ClassifiedItem
  /** The article that stands for its story; the others are further publishers' coverage of that same story. */
  lead: boolean
}

export interface TopicGroup {
  key: string
  /** The PYQ concept these stories share; null for a story on its own. */
  topic: string | null
  anchor: TopicEntry
  /** Everything else, folded under the anchor: the anchor story's other publishers first, then each further story with its own. */
  rest: TopicEntry[]
  /** Every article in the group, the anchor included. */
  count: number
}

export const topicOf = (event: WorkspaceEvent): string | null => event.primary.relevance.staticAnchors[0] ?? null

/**
 * Fold a ranked list of stories into topic groups, each placed where its first story ranks.
 * `coverage` says which of a story's articles are in view (Today shows only the past 24 hours).
 */
export function groupTopics(events: WorkspaceEvent[], coverage: (event: WorkspaceEvent) => ClassifiedItem[] = (event) => event.members): TopicGroup[] {
  const buckets = new Map<string, { topic: string | null; events: WorkspaceEvent[] }>()
  // A group never holds more than MAX_STORY_ARTICLES articles: once a topic's group is full, its next story opens another.
  const open = new Map<string, { key: string; articles: number; part: number }>()
  const size = (event: WorkspaceEvent) => { const shown = coverage(event); return (shown.length ? shown : event.members).length }
  for (const event of events) {
    const topic = topicOf(event), articles = size(event)
    if (!topic) { buckets.set(`story:${event.id}`, { topic, events: [event] }); continue }
    const current = open.get(topic)
    if (current && current.articles + articles <= MAX_STORY_ARTICLES) { buckets.get(current.key)!.events.push(event); current.articles += articles; continue }
    const part = (current?.part ?? 0) + 1, key = part === 1 ? `topic:${topic}` : `topic:${topic}:${part}`
    buckets.set(key, { topic, events: [event] })
    open.set(topic, { key, articles, part })
  }
  return [...buckets].map(([key, { topic, events: stories }]) => {
    const parts = stories.map((event) => {
      const shown = coverage(event)
      const items = shown.length ? shown : event.members
      const lead = pickAnchor(items)
      return { lead: { event, item: lead, lead: true } as TopicEntry, others: items.filter((item) => item !== lead).sort(anchorOrder).map((item): TopicEntry => ({ event, item, lead: false })) }
    })
    // A preferred publisher anchors the group; with none, the story the feed already ranks first does.
    const preferred = parts.filter((part) => isAnchorPublisher(part.lead.item)).sort((a, b) => anchorOrder(a.lead.item, b.lead.item))[0]
    const first = preferred ?? parts[0]
    const rest = [...first.others, ...parts.filter((part) => part !== first).flatMap((part) => [part.lead, ...part.others])]
    return { key, topic: stories.length > 1 ? topic : null, anchor: first.lead, rest, count: rest.length + 1 }
  })
}
