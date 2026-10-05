/**
 * Event clustering: reports of one development, from any publisher and in any wording, become one story.
 * Each article is a weighted bag of headline words, summary words and the syllabus concepts the validator matched;
 * rare terms count for more (inverse document frequency), and a story must share headline substance, not just an
 * institution. Stories grow by centroid, so differently worded reports of one development still meet.
 */
import { ANCHOR_PUBLISHERS } from './anchors.ts'
import { normalize } from './relevance.ts'
import { NEWS_SOURCES } from './sources.ts'
import type { ClassifiedItem, NewsEvent } from './types.ts'
import { UNDATED, publicationDay } from './workspace.ts'

/** A story shows at most this many articles; further reports of the same event are kept only as identities. */
export { ANCHOR_PUBLISHERS }
export const MAX_STORY_ARTICLES = 5
/** Centroid similarity two stories need to merge. */
export const JOIN_SIMILARITY = 0.2
/**
 * A story only one publisher carries must be a strong syllabus match on its own; one that several publishers report
 * is corroborated by that coverage and needs only the validator's acceptance threshold.
 */
export const SOLO_STORY_THRESHOLD = 7.2
export interface ClusterOptions { joinSimilarity?: number; soloThreshold?: number }
/** Headline words two reports must share, however similar their summaries and concepts are. */
const MIN_SHARED_HEADLINE_TERMS = 2
const WINDOW_MS = 36 * 3600000
/** Across midnight, a story continues only if its next report follows within this gap and the whole story stays this short. */
const BRIDGE_GAP_MS = 18 * 3600000, BRIDGE_SPAN_MS = 48 * 3600000
const SUMMARY_WEIGHT = 0.3, CONCEPT_WEIGHT = 0.8
/** Added once when two already-similar reports share a named phrase (adjacent headline words, never numbers or bare institutions). */
const SHARED_PAIR_BONUS = 0.07, PAIR_BONUS_FLOOR = 0.12
const pairGeneric = new Set('election commission finance prime chief minister justice president'.split(' '))
const withPairBonus = (cosine: number, pairs: number) => cosine >= PAIR_BONUS_FLOOR && pairs > 0 ? cosine + SHARED_PAIR_BONUS : cosine
const stop = new Set('the a an of to in on for and by with as is at from after over new says said say amid but not its his her their this that will may can has have had was were are been being into than then who what why how when where which also more most about against between during before under out off per via vs here there you your our all any one two three first today live updates news report reports india indian'.split(' '))
/** Common headline abbreviations fold to one spelling so "SC" and "Supreme Court" count as the same words. */
const fold: Record<string, string> = { sc: 'supreme court', hc: 'high court', ec: 'election commission', eci: 'election commission', cec: 'chief election commissioner', govt: 'government', centre: 'government', pm: 'prime minister', fm: 'finance minister', cm: 'chief minister', us: 'united states', uk: 'britain', un: 'united nations', eu: 'european union', guv: 'governor', mpc: 'monetary policy committee', fta: 'trade deal', pact: 'deal', agreement: 'deal', polls: 'election', poll: 'election', elections: 'election', hike: 'raise', hikes: 'raise', raises: 'raise', rates: 'rate' }
/** Institutions and procedural words recur across unrelated stories: they add similarity but cannot alone make two reports one event. */
const generic = new Set('supreme court high rbi government ruling rule order plea case bill policy state union central united nation european prime finance chief minister'.split(' '))
const stem = (word: string) => word.length > 4 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word
const words = (text: string) => normalize(text).split(' ').flatMap(w => (fold[w] ?? w).split(' ')).filter(w => (w.length > 2 || /^\d+$/.test(w)) && !stop.has(w)).map(stem)

/**
 * Countries and blocs a headline names. Two reports whose parties mostly differ are different stories however alike
 * their wording: an India–EU trade deal is not India–US trade talks, and Iran–US talks are neither.
 */
const COUNTERPARTS: [string, string][] = [
  ['India', 'india|indian|new delhi|modi|jaishankar|sitharaman|goyal|rajnath'],
  ['US', 'us|u s|united states|america|american|washington|white house|trump|pentagon'], ['EU', 'eu|european union|europe|european|brussels'], ['UK', 'uk|britain|british|london'],
  ['China', 'china|chinese|beijing|xi jinping'], ['Russia', 'russia|russian|moscow|putin|kremlin'], ['Ukraine', 'ukraine|ukrainian|kyiv|zelensky|zelenskyy'], ['Pakistan', 'pakistan|pakistani|islamabad'],
  ['Iran', 'iran|iranian|tehran'], ['Israel', 'israel|israeli|netanyahu'], ['West Asia', 'west asia|west asian|middle east|gulf'], ['Canada', 'canada|canadian'], ['Japan', 'japan|japanese|tokyo'], ['France', 'france|french|paris'],
  ['Germany', 'germany|german|berlin'], ['Australia', 'australia|australian'], ['Nepal', 'nepal|nepali|kathmandu'], ['Bangladesh', 'bangladesh|dhaka'], ['Sri Lanka', 'sri lanka|colombo'], ['Maldives', 'maldives'],
  ['Myanmar', 'myanmar'], ['Afghanistan', 'afghanistan|taliban|kabul'], ['Brazil', 'brazil|brazilian'], ['Saudi Arabia', 'saudi|saudi arabia|riyadh'], ['UAE', 'uae|dubai|abu dhabi'], ['Switzerland', 'switzerland|swiss'],
  ['Finland', 'finland|finnish'], ['Chile', 'chile'], ['New Zealand', 'new zealand'], ['South Korea', 'south korea|seoul'], ['North Korea', 'north korea|pyongyang'], ['Taiwan', 'taiwan'], ['Iraq', 'iraq|iraqi'],
  ['Yemen', 'yemen|houthi|houthis'], ['Turkey', 'turkey|turkish|ankara'], ['Indonesia', 'indonesia'], ['Malaysia', 'malaysia'], ['Singapore', 'singapore'], ['Italy', 'italy'], ['Spain', 'spain'], ['Bhutan', 'bhutan'],
]
const counterpartPhrases = COUNTERPARTS.flatMap(([name, spellings]) => spellings.split('|').map(phrase => [' ' + phrase + ' ', name] as const))
function counterparts(title: string): Set<string> {
  const padded = ' ' + title + ' ', out = new Set<string>()
  for (const [phrase, name] of counterpartPhrases) if (padded.includes(phrase)) out.add(name)
  return out
}
/** Multi-topic digests ("UPSC Key: A, B and C", weekly roundups) share words with several stories and must not join any. */
const isDigest = (item: ClassifiedItem) => /^upsc key\b/i.test(item.title) || !!item.relevance.evidence?.some(e => e.kind === 'noise' && e.label.startsWith('Digest'))
/** True when both sides name parties and fewer than half of all the parties named are common to both. */
const disjoint = (x: Set<string>, y: Set<string>) => { if (!x.size || !y.size) return false; let common = 0; for (const v of x) if (y.has(v)) common++; return common * 2 < x.size + y.size - common }
interface Facts { day: string; time: number; title: string; headline: Set<string>; terms: Map<string, number>; pairs: Set<string>; counterparts: Set<string>; digest: boolean }
const derived = new WeakMap<ClassifiedItem, Facts>()
function facts(item: ClassifiedItem): Facts {
  let f = derived.get(item)
  if (!f) {
    const headline = new Set(words(item.title)), terms = new Map<string, number>()
    for (const w of words(item.description).slice(0, 60)) terms.set(w, SUMMARY_WEIGHT)
    // The validator's matched concepts normalise entities: "poll panel", "ECI" and "CEC" are one concept.
    for (const signal of item.relevance.signals) terms.set('#' + signal.split(' · ')[0], CONCEPT_WEIGHT)
    for (const w of headline) terms.set(w, 1)
    // Adjacent headline words name things ("gst council", "rate hike"); a shared pair says more than two shared words.
    const sequence = words(item.title), pairs = new Set<string>()
    for (let i = 1; i < sequence.length; i++) if (![sequence[i - 1], sequence[i]].some(w => /\d/.test(w)) && ![sequence[i - 1], sequence[i]].every(w => generic.has(w) || pairGeneric.has(w))) pairs.add(sequence[i - 1] + ' ' + sequence[i])
    const title = normalize(item.title)
    derived.set(item, f = { day: publicationDay(item.publishedAt), time: Date.parse(item.publishedAt ?? ''), title, headline, terms, pairs, counterparts: counterparts(title), digest: isDigest(item) })
  }
  return f
}
type Weights = Map<string, number>
/** Inverse document frequency over the articles being clustered: a name seen twice says more than "court". */
function weights(items: ClassifiedItem[]): Weights {
  const df = new Map<string, number>()
  for (const item of items) for (const term of facts(item).terms.keys()) df.set(term, (df.get(term) ?? 0) + 1)
  const idf: Weights = new Map()
  for (const [term, n] of df) idf.set(term, Math.log(1 + items.length / n))
  return idf
}
const vectors = new WeakMap<Weights, WeakMap<ClassifiedItem, { vector: Map<string, number>; norm: number }>>()
function vector(item: ClassifiedItem, idf: Weights) {
  let cache = vectors.get(idf)
  if (!cache) vectors.set(idf, cache = new WeakMap())
  let v = cache.get(item)
  if (!v) {
    const vector = new Map<string, number>(); let sum = 0
    for (const [term, weight] of facts(item).terms) { const x = weight * (idf.get(term) ?? 1); vector.set(term, x); sum += x * x }
    cache.set(item, v = { vector, norm: Math.sqrt(sum) || 1 })
  }
  return v
}
/** Cosine similarity of two articles' weighted terms, 0 when they cannot be one event. */
export function similarity(a: ClassifiedItem, b: ClassifiedItem, idf: Weights = weights([a, b])): number {
  if (!a.publishedAt || !b.publishedAt) return 0
  const p = facts(a), q = facts(b)
  // Daily editions remain stable when an explainer arrives on a later day.
  if (p.day !== q.day || Math.abs(p.time - q.time) > WINDOW_MS) return 0
  if (p.digest || q.digest || disjoint(p.counterparts, q.counterparts)) return 0
  if (p.title === q.title) return 1
  let shared = 0
  for (const w of p.headline) if (q.headline.has(w) && !generic.has(w) && !/^\d+$/.test(w)) shared++
  if (shared < MIN_SHARED_HEADLINE_TERMS) return 0
  const x = vector(a, idf), y = vector(b, idf), [small, large] = x.vector.size < y.vector.size ? [x.vector, y.vector] : [y.vector, x.vector]
  let dot = 0
  for (const [term, value] of small) { const other = large.get(term); if (other) dot += value * other }
  let pairs = 0
  for (const pair of p.pairs) if (q.pairs.has(pair)) pairs++
  return withPairBonus(dot / (x.norm * y.norm), pairs)
}
export const sameEvent = (a: ClassifiedItem, b: ClassifiedItem, idf?: Weights) => similarity(a, b, idf) >= JOIN_SIMILARITY

const priority = (item: ClassifiedItem) => NEWS_SOURCES.find(s => s.id === item.sourceId)?.priority ?? 9
/** Potential information value, inferred from RSS metadata, never a claim about a fetched article body. */
export function informationValue(item: ClassifiedItem): number {
  const depth = /explained|explainer|analysis|in.depth/i.test(item.section) ? 4 : /opinion|editorial|upsc/i.test(item.section) ? 2 : 0
  return depth * 10 + Math.min(6, new Set(normalize(item.description).split(' ').filter(t => t.length > 2)).size / 15)
}
/** Which article should stand for a story: a preferred paper, then depth, source priority, relevance and a stable tiebreak. */
const orderSources = (a: ClassifiedItem, b: ClassifiedItem) => Number(ANCHOR_PUBLISHERS.includes(b.publisher)) - Number(ANCHOR_PUBLISHERS.includes(a.publisher)) || informationValue(b) - informationValue(a) || priority(a) - priority(b) || b.relevance.score - a.relevance.score || a.url.localeCompare(b.url)
/** The best article first, then one per further publisher before any publisher's second report. */
function select(members: ClassifiedItem[]): { shown: ClassifiedItem[]; overflow: ClassifiedItem[] } {
  const ranked = [...members].sort(orderSources), publishers = new Set<string>(), shown: ClassifiedItem[] = []
  for (const item of ranked) if (shown.length < MAX_STORY_ARTICLES && !publishers.has(item.publisher)) { shown.push(item); publishers.add(item.publisher) }
  for (const item of ranked) if (shown.length < MAX_STORY_ARTICLES && !shown.includes(item)) shown.push(item)
  // The latest report stays visible, so a story that is still developing remains in today's list.
  const newest = ranked.reduce((x, y) => (Date.parse(y.publishedAt ?? '') || 0) > (Date.parse(x.publishedAt ?? '') || 0) ? y : x)
  if (!shown.includes(newest)) shown[shown.length - 1] = newest
  shown.sort(orderSources)
  return { shown, overflow: ranked.filter(item => !shown.includes(item)) }
}
interface Story { items: ClassifiedItem[]; centroid: Map<string, number>; norm: number; headline: Map<string, number>; pairs: Map<string, number>; counterparts: Map<string, number>; digest: boolean; first: number; last: number }
/** Counterparts most of a story's articles name. */
const storyCounterparts = (story: Story) => { const out = new Set<string>(); for (const [name, count] of story.counterparts) if (count * 2 >= story.items.length) out.add(name); return out }
/** Headline words most of a story's articles share: what the story is about, whatever each report adds. */
const core = (story: Story) => { const out = new Set<string>(); for (const [word, count] of story.headline) if (count * 2 >= story.items.length) out.add(word); return out }
function storySimilarity(x: Story, y: Story): number {
  if (x.digest || y.digest || disjoint(storyCounterparts(x), storyCounterparts(y))) return 0
  const p = core(x), q = core(y); let shared = 0
  for (const w of p) if (q.has(w) && !generic.has(w) && !/^\d+$/.test(w)) shared++
  if (shared < MIN_SHARED_HEADLINE_TERMS) return 0
  const [small, large] = x.centroid.size < y.centroid.size ? [x.centroid, y.centroid] : [y.centroid, x.centroid]
  let dot = 0
  for (const [term, value] of small) { const other = large.get(term); if (other) dot += value * other }
  let pairs = 0
  for (const [pair, count] of x.pairs) if (count * 2 >= x.items.length && (y.pairs.get(pair) ?? 0) * 2 >= y.items.length) pairs++
  return withPairBonus(dot / (x.norm * y.norm), pairs)
}
function absorb(into: Story, from: Story) {
  into.items.push(...from.items)
  for (const [term, value] of from.centroid) into.centroid.set(term, (into.centroid.get(term) ?? 0) + value)
  for (const [word, count] of from.headline) into.headline.set(word, (into.headline.get(word) ?? 0) + count)
  for (const [name, count] of from.counterparts) into.counterparts.set(name, (into.counterparts.get(name) ?? 0) + count)
  for (const [pair, count] of from.pairs) into.pairs.set(pair, (into.pairs.get(pair) ?? 0) + count)
  let sum = 0
  for (const value of into.centroid.values()) sum += value * value
  into.norm = Math.sqrt(sum) || 1
  into.first = Math.min(into.first, from.first); into.last = Math.max(into.last, from.last)
}
/**
 * Centroid agglomeration within one edition day: the two most similar stories merge until none are similar enough.
 * A story's centroid is dominated by what its reports have in common, so a tenth publisher's differently worded
 * report still lands in the story the first nine built.
 */
function agglomerate(items: ClassifiedItem[], idf: Weights, join: number): Story[] {
  const n = items.length
  const stories: (Story | null)[] = items.map(item => {
    const v = vector(item, idf), centroid = new Map<string, number>(), time = facts(item).time
    for (const [term, value] of v.vector) centroid.set(term, value / v.norm)
    return { items: [item], centroid, norm: 1, headline: new Map([...facts(item).headline].map(w => [w, 1])), pairs: new Map([...facts(item).pairs].map(pair => [pair, 1])), counterparts: new Map([...facts(item).counterparts].map(name => [name, 1])), digest: facts(item).digest, first: time, last: time }
  })
  const link = new Float32Array(n * n)
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) link[i * n + j] = storySimilarity(stories[i]!, stories[j]!)
  for (;;) {
    let bestI = -1, bestJ = -1, best = join
    for (let i = 0; i < n; i++) if (stories[i]) for (let j = i + 1; j < n; j++) if (stories[j] && link[i * n + j] >= best) { best = link[i * n + j]; bestI = i; bestJ = j }
    if (bestI < 0) break
    const into = stories[bestI]!
    absorb(into, stories[bestJ]!)
    stories[bestJ] = null
    for (let k = 0; k < n; k++) if (stories[k] && k !== bestI) { const value = storySimilarity(into, stories[k]!); if (k < bestI) link[k * n + bestI] = value; else link[bestI * n + k] = value }
  }
  return stories.filter((story): story is Story => !!story)
}
/**
 * A story reported late one evening and again the next morning is still one story: each day's stories join the
 * previous day's when they are similar and close in time. The span limit stops a week-long running story chaining.
 */
function bridge(days: Story[][], join: number): Story[] {
  const out: Story[] = []; let previous: Story[] = []
  for (const day of days) {
    const current: Story[] = [], extended: Story[] = []
    for (const story of day) {
      let best: Story | undefined, bestScore = join
      for (const earlier of previous) {
        if (!(story.first - earlier.last <= BRIDGE_GAP_MS && story.last - earlier.first <= BRIDGE_SPAN_MS)) continue
        const score = storySimilarity(story, earlier)
        if (score >= bestScore) { best = earlier; bestScore = score }
      }
      if (best) { absorb(best, story); if (!extended.includes(best)) extended.push(best) }
      else current.push(story)
    }
    out.push(...current)
    previous = [...extended, ...current]
  }
  return out
}
export function clusterItems(items: ClassifiedItem[], { joinSimilarity = JOIN_SIMILARITY, soloThreshold = SOLO_STORY_THRESHOLD }: ClusterOptions = {}): NewsEvent[] {
  const accepted = items.filter(i => i.relevance.accepted), idf = weights(accepted), byDay = new Map<string, ClassifiedItem[]>()
  // A stable input order makes equal-similarity merges, and so story identities, independent of feed order.
  for (const item of [...accepted].sort((a, b) => a.url.localeCompare(b.url))) { const day = publicationDay(item.publishedAt); byDay.set(day, [...(byDay.get(day) ?? []), item]) }
  const dated = [...byDay].filter(([day]) => day !== UNDATED).sort(([x], [y]) => x.localeCompare(y)).map(([, list]) => agglomerate(list, idf, joinSimilarity))
  const groups = [...bridge(dated, joinSimilarity), ...agglomerate(byDay.get(UNDATED) ?? [], idf, joinSimilarity)].map(story => story.items)
    .filter(all => new Set(all.map(i => i.publisher)).size > 1 || all.some(i => i.relevance.score >= soloThreshold))
  return groups.map(all => {
    const { shown, overflow } = select(all)
    return { id: all.map(i => i.url).sort()[0], primary: shown[0], members: shown, ...(overflow.length ? { overflow: overflow.map(i => i.url) } : {}) }
  })
}
