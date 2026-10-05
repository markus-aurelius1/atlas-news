/**
 * Validator audit: the frozen pre-overhaul validator against the current one on the same registry snapshot.
 *
 *   node tools/news/snapshot.ts                      save a live collection (git-ignored cache)
 *   node tools/news/audit.ts                         summary, strata and day-by-day feed size
 *   node tools/news/audit.ts --list=recovered        also list a deterministic sample of one group
 *     groups: recovered (newly accepted), dropped (newly rejected), kept, rejected, noise, borderline
 *     --limit=40  --source=<sourceId>  --stratum=<name>  --match=<text|text>  --why (print the weighed evidence)
 *     --seed=<text> draws a different sample; --unlabelled leaves out the fixture's own cases
 *   node tools/news/audit.ts --labelled [--why]      only the hand-labelled fixture: misses and false positives
 *   node tools/news/audit.ts --ranking               also print the ranked Today list with each story's value reasons
 */
import { readFileSync } from 'node:fs'
import { classify as classifyV1 } from './legacy/relevance-v1.ts'
import { ACCEPT_THRESHOLD, classify } from '../../src/current-affairs/relevance.ts'
import { clusterItems as clusterItemsV1 } from './legacy/cluster-v1.ts'
import { MAX_STORY_ARTICLES, SOLO_STORY_THRESHOLD, clusterItems } from '../../src/current-affairs/cluster.ts'
import { NEWS_SOURCES } from '../../src/current-affairs/sources.ts'
import { readingScopes } from '../../src/current-affairs/analytics.ts'
import { TODAY_STORY_LIMIT, buildWorkspace, publicationDay } from '../../src/current-affairs/workspace.ts'
import type { FeedResponse, NewsItem, Relevance, RelevanceIndex } from '../../src/current-affairs/types.ts'

const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const json = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T
const snapshot = json<FeedResponse>(arg('snapshot') ?? './.cache/snapshot.json')
const indexV1 = json<RelevanceIndex>('./legacy/relevance-index-v1.json'), index = json<RelevanceIndex>('../../public/current-affairs/v2/relevance-index.json')
const sources = new Map(NEWS_SOURCES.map(s => [s.id, s]))

/** Strata describe where an item came from, so the comparison is not dominated by the largest feeds. */
function stratum(item: NewsItem): string {
  const source = sources.get(item.sourceId), section = item.section
  if (source?.kind === 'newsletter') return 'Substack'
  if (item.sourceId === 'et-uttarpradesh' || /\b(?:Uttar Pradesh|UP)\b/.test(item.title)) return 'UP/state'
  if (source?.kind === 'international') return /science|climate|environment|artificial/i.test(section) ? 'Science/tech & environment' : /econom|business|market|finance/i.test(section) ? 'Economy' : 'IR/geopolitics'
  if (/world/i.test(section)) return 'IR/geopolitics'
  if (/econom|business|agricultur/i.test(section)) return 'Economy'
  if (/environment/i.test(section)) return 'Environment'
  if (/science/i.test(section)) return 'Science/tech & environment'
  return 'India/policy'
}
// Hand-labelled cases give a precision/recall reading that does not depend on either validator's own verdicts.
interface LabelledCase extends Pick<NewsItem, 'title' | 'description' | 'publisher' | 'section' | 'sourceId'> { label: 'relevant' | 'not-relevant' | 'borderline'; group: string }
const labelled = json<{ cases: LabelledCase[] }>('../../src/current-affairs/fixtures/relevance-cases.json').cases.map(c => ({ c, old: classifyV1(c, indexV1), now: classify(c, index) }))
const rate = (label: LabelledCase['label'], pick: (r: typeof labelled[number]) => Relevance) => { const of = labelled.filter(r => r.c.label === label); return `${of.filter(r => pick(r).accepted).length}/${of.length}` }
console.log(`Labelled fixture (${labelled.length}): relevant accepted  old ${rate('relevant', r => r.old)}  new ${rate('relevant', r => r.now)}  |  not-relevant accepted  old ${rate('not-relevant', r => r.old)}  new ${rate('not-relevant', r => r.now)}  |  borderline accepted  old ${rate('borderline', r => r.old)}  new ${rate('borderline', r => r.now)}`)
// Threshold sweep on the labelled cases: what moving the single acceptance threshold would trade.
const eligible = (r: Relevance) => r.accepted || !!r.rejectionReason?.startsWith('Evidence')
console.log('Threshold sweep (relevant kept / not-relevant admitted): ' + [5.5, 6, 6.5, 7, 7.5, 8].map(t => { const kept = (label: LabelledCase['label']) => labelled.filter(r => r.c.label === label && eligible(r.now) && r.now.score >= t).length; return `${t}: ${kept('relevant')}/${kept('not-relevant')}` }).join('  '))
if (process.argv.includes('--labelled')) {
  for (const r of labelled.filter(r => r.c.label === 'relevant' && !r.now.accepted || r.c.label === 'not-relevant' && r.now.accepted)) {
    console.log(`${r.c.label === 'relevant' ? 'MISS' : 'FP  '} ${String(r.now.score).padStart(5)} [${r.c.sourceId}] ${r.c.title.slice(0, 110)} {${r.now.staticAnchors.join(', ')}}`)
    if (process.argv.includes('--why')) for (const e of r.now.evidence ?? []) console.log(`        ${String(e.points).padStart(5)} ${e.kind} ${e.where ?? ''} ${e.label}`)
  }
  process.exit(0)
}
const started = performance.now()
const verdicts = snapshot.items.map(item => classify(item, index)), elapsed = performance.now() - started
const rows = snapshot.items.map((item, n) => ({ item, old: classifyV1(item, indexV1), now: verdicts[n], stratum: stratum(item) }))
type Row = typeof rows[number]
const groups: Record<string, (r: Row) => boolean> = {
  recovered: r => !r.old.accepted && r.now.accepted,
  dropped: r => r.old.accepted && !r.now.accepted,
  kept: r => r.old.accepted && r.now.accepted,
  rejected: r => !r.old.accepted && !r.now.accepted,
  accepted: r => r.now.accepted,
  all: () => true,
  noise: r => !!r.now.rejectionReason?.startsWith('Noise headline'),
  borderline: r => Math.abs(r.now.score - ACCEPT_THRESHOLD) <= 1 && !r.now.rejectionReason?.startsWith('Noise headline'),
}
const count = (test: (r: Row) => boolean, list = rows) => list.filter(test).length
console.log(`Snapshot ${snapshot.fetchedAt}: ${rows.length} items from ${snapshot.sources.filter(s => s.status === 'ok').length} feeds; the current validator classified them in ${Math.round(elapsed)} ms`)
console.log(`Accepted  old ${count(r => r.old.accepted)}  new ${count(r => r.now.accepted)}  |  recovered ${count(groups.recovered)}  dropped ${count(groups.dropped)}  kept ${count(groups.kept)}  hard noise ${count(groups.noise)}  within 1 point of threshold ${count(groups.borderline)}`)
console.log('\nStratum                      items   old   new  recovered  dropped')
for (const name of [...new Set(rows.map(r => r.stratum))].sort()) {
  const list = rows.filter(r => r.stratum === name)
  console.log(`${name.padEnd(28)} ${String(list.length).padStart(5)} ${String(count(r => r.old.accepted, list)).padStart(5)} ${String(count(r => r.now.accepted, list)).padStart(5)} ${String(count(groups.recovered, list)).padStart(10)} ${String(count(groups.dropped, list)).padStart(8)}`)
}
const reasons = new Map<string, number>()
for (const r of rows) if (!r.now.accepted) { const key = r.now.rejectionReason!.replace(/Evidence [\d.-]+ below threshold [\d.]+/, 'Evidence below threshold'); reasons.set(key, (reasons.get(key) ?? 0) + 1) }
console.log('\nNew rejection reasons:', [...reasons].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => `${n} ${k}`).join(' | '))
// Daily feed size after event clustering, for the days the snapshot covers well.
const classified = (pick: (r: Row) => Relevance) => rows.map(r => ({ ...r.item, relevance: pick(r) }))
// The reading list folds events that share their first syllabus concept, so topic groups are the rows a reader sees.
const topics = new Map<string, Set<string>>()
const perDay = (pick: (r: Row) => Relevance, track = false) => {
  const days = new Map<string, number>()
  for (const e of (track ? clusterItems : clusterItemsV1)(classified(pick))) {
    const day = publicationDay(e.primary.publishedAt)
    days.set(day, (days.get(day) ?? 0) + 1)
    if (track) topics.set(day, (topics.get(day) ?? new Set<string>()).add(e.primary.relevance.staticAnchors[0] ?? e.id))
  }
  return days
}
const list = arg('list')
const bands = new Map<number, number>()
for (const r of rows) if (r.now.accepted) bands.set(Math.floor(r.now.score), (bands.get(Math.floor(r.now.score)) ?? 0) + 1)
console.log('\nAccepted by score band:', [...bands].sort((a, b) => a[0] - b[0]).map(([band, n]) => `${band}:${n}`).join(' '))
// Event clustering is the slow step, so it runs only for the summary.
if (!list) {
  const oldDays = perDay(r => r.old), newDays = perDay(r => r.now, true), items = new Map<string, number>()
  for (const r of rows) items.set(publicationDay(r.item.publishedAt), (items.get(publicationDay(r.item.publishedAt)) ?? 0) + 1)
  console.log('\nDay          items  old events  new events  new topic groups')
  for (const day of [...items.keys()].filter(d => d !== 'undated').sort().slice(-5)) console.log(`${day} ${String(items.get(day)).padStart(6)} ${String(oldDays.get(day) ?? 0).padStart(11)} ${String(newDays.get(day) ?? 0).padStart(11)} ${String(topics.get(day)?.size ?? 0).padStart(17)}`)
}

// The reading list itself: the latest 24 hours of the snapshot, the old clustering against the current one on the same accepted articles.
if (!list) {
  const at = Date.parse(snapshot.fetchedAt), recent = (published: string | null) => !!published && Date.parse(published) > at - 24 * 3600000 && Date.parse(published) <= at
  const current = classified(r => r.now), accepted = current.filter(i => i.relevance.accepted && recent(i.publishedAt)).length
  const size = (e: { members: unknown[]; overflow?: string[] }) => e.members.length + (e.overflow?.length ?? 0)
  const describe = <T extends { primary: NewsItem; members: NewsItem[]; overflow?: string[] }>(name: string, events: T[]): T[] => {
    const day = events.filter(e => e.members.some(m => recent(m.publishedAt))), articles = day.reduce((n, e) => n + size(e), 0), multi = day.filter(e => size(e) > 1)
    console.log(`${name.padEnd(46)} ${String(day.length).padStart(4)} stories from ${String(articles).padStart(3)} articles; ${String(multi.length).padStart(2)} stories merge ${String(multi.reduce((n, e) => n + size(e), 0)).padStart(3)} articles (${articles ? Math.round(100 * (articles - day.length) / articles) : 0}% of articles folded away); largest story ${Math.max(0, ...day.map(size))}, most shown ${Math.max(0, ...day.map(e => e.members.length))}`)
    return events
  }
  console.log(`\nToday, as the reading list scopes it (a story with any shown article from the past 24 hours): ${accepted} accepted articles`)
  describe('Old clustering (headline words, complete link)', clusterItemsV1(current))
  describe('Current clustering, every accepted story', clusterItems(current, { soloThreshold: 0 }))
  const feed = describe(`Current feed (single-publisher stories need ${SOLO_STORY_THRESHOLD})`, clusterItems(current))
  if (feed.some(e => e.members.length > MAX_STORY_ARTICLES)) throw new Error('A story shows more than the article cap')
  // What the screen shows: the highest-value stories, at most TODAY_STORY_LIMIT; the rest of the day's stories stay in the Archive.
  const scopes = readingScopes(buildWorkspace(feed, index), at)
  console.log(`Reading list Today: ${scopes.today.length} stories shown (limit ${TODAY_STORY_LIMIT}); value ${scopes.today[0]?.value} to ${scopes.today[scopes.today.length - 1]?.value}`)
  if (process.argv.includes('--ranking')) for (const e of scopes.today) console.log(`${String(e.value).padStart(6)} x${e.members.length}${e.overflow ? '+' + e.overflow.length : ''} [${e.primary.publisher}] ${e.primary.title.slice(0, 100)}  (${e.valueReasons?.join('; ')})`)
  // Labelled cases that reach the reading list, shown or folded into a story.
  const inFeed = new Set(feed.flatMap(e => [...e.members.map(m => m.url), ...(e.overflow ?? [])])), labelOf = new Map(labelled.map(r => [r.c.title, r.c.label]))
  const reach = (label: LabelledCase['label']) => { const of = rows.filter(r => labelOf.get(r.item.title) === label); return `${of.filter(r => inFeed.has(r.item.url)).length}/${of.length}` }
  console.log(`Labelled cases in the feed: relevant ${reach('relevant')}, not-relevant ${reach('not-relevant')}, borderline ${reach('borderline')}`)
}
if (list) {
  if (!groups[list]) throw new Error(`Unknown group ${list}`)
  // A URL hash gives a stable pseudo-random sample that does not favour any feed's ordering.
  const seed = arg('seed') ?? '', fixtureTitles = new Set(labelled.map(r => r.c.title))
  const hash = (s: string) => { let x = 0; for (const c of s) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x }
  const chosen = rows.filter(groups[list]).filter(r => (!arg('match') || arg('match')!.toLowerCase().split('|').some(m => r.item.title.toLowerCase().includes(m))) && (!arg('source') || r.item.sourceId === arg('source')) && (!arg('stratum') || r.stratum === arg('stratum'))).filter(r => !process.argv.includes('--unlabelled') || !fixtureTitles.has(r.item.title)).sort((a, b) => hash(a.item.url + seed) - hash(b.item.url + seed)).slice(0, Number(arg('limit') ?? 40))
  console.log(`\n${list}: ${chosen.length} sampled`)
  for (const r of chosen) {
    console.log(`${String(r.now.score).padStart(5)} [${r.item.sourceId}] ${r.item.title.slice(0, 120)} {${r.now.staticAnchors.join(', ')}}${r.now.accepted ? '' : ` <${r.now.rejectionReason}>`}`)
    if (process.argv.includes('--why')) for (const e of r.now.evidence ?? []) console.log(`        ${String(e.points).padStart(5)} ${e.kind} ${e.where ?? ''} ${e.label}`)
  }
}
