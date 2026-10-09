import type { StageCDecision } from './contracts.ts'
import type { NewsItem } from '../types.ts'
import type { Editorial } from './editorial.ts'
import type { Subject, SubjectDecision } from './subject.ts'
import type { ReadingUnit, SelectedReading } from './stories.ts'

/**
 * The day's reading: the most valuable stories first, one reading per topic, never filled to the ceiling.
 * `sameStory` and `sameTopic` are similarities of headline and summary words weighted by rarity across the day's
 * feed: above the first two reports are one story and are shown together; above the second the later one repeats
 * a topic already in the list and is left out. Two readings under different subjects that name the same thing are one
 * topic only if their wording overlaps at least `acrossSubjects`: a forest study dated to an El Niño year is not the El Niño forecast. A subject cannot take more than its cap, so Polity volume cannot
 * crowd out the subjects where current affairs matter most.
 */
export const SELECTION_POLICY = {
  id: 'tars-selection/2', capacity: 50, comparableTolerance: 0.5, maxAlternatives: 5, sameStory: 0.33, sameTopic: 0.2, acrossSubjects: 0.12, mustRead: 10.5, corroboration: 1.5, stickiness: 0.5, preferred: 1,
  subjectCap: { Environment: 12, 'Sci-Tech': 12, 'International relations': 12, Economy: 12, Polity: 5, Governance: 6, Geography: 5, Security: 5, 'History & Culture': 4 } as Record<Subject, number>,
  firmCap: ['Polity', 'Governance'] as readonly Subject[],
} as const
/** One reading per topic; a story that fills the day's feed (a Budget, a summit, a war) may take a few. */
export const topicAllowance = (reports: number) => reports >= 80 ? 4 : reports >= 50 ? 3 : reports >= 25 ? 2 : 1
export interface QualifiedArticle { item: NewsItem; acceptance: StageCDecision; subject: SubjectDecision; editorial: Editorial }
export interface RankedReading { unit: ReadingUnit; primary: QualifiedArticle; alternatives: QualifiedArticle[]; quality: number; mustRead: boolean; reason: string }
export interface Suppressed { id: string; reason: Suppression; /** The chosen reading that covers this one. */ by?: string }
export type Suppression = 'repeat' | 'capacity' | 'undated_or_stale' | 'evidence_limit' | 'topic_covered' | 'subject_cap'
export interface SelectionResult { today: RankedReading[]; replacement: RankedReading[]; suppressed: Suppressed[]; retained: SelectedReading[]; diagnostics: { qualifiedUnits: number; capacityLoss: number; sourceCounts: Record<string, number>; subjectCounts: Record<string, number>; preferredComparable: number; strongerOther: number; mergedStories: number; topicRepeats: number } }
const preference = (a: QualifiedArticle) => ['The Hindu', 'Indian Express'].includes(a.item.publisher)
const published = (a: QualifiedArticle) => Date.parse(a.item.publishedAt ?? '') || 0
const round = (n: number) => Math.round(n * 10) / 10
/** Among comparable reports of one story a preferred paper stands for it; a materially stronger report elsewhere wins. */
export function chooseRepresentative(articles: QualifiedArticle[]): QualifiedArticle {
  const accepted = articles.filter(a => a.acceptance.accepted)
  if (!accepted.length) throw new Error('Representative requires individually accepted metadata')
  const best = Math.max(...accepted.map(a => a.editorial.score)), comparable = accepted.filter(a => best - a.editorial.score <= SELECTION_POLICY.comparableTolerance), preferred = comparable.filter(preference)
  return [...(preferred.length ? preferred : comparable)].sort((a, b) => b.editorial.score - a.editorial.score || published(b) - published(a) || a.item.url.localeCompare(b.item.url))[0]
}

const stop = new Set('the a an of to for in on at by as and or with from says said say why how what when where which who is are was were be been new today latest has have had will would could should may must can it its this that these those about after before amid over under into than more most not no but his her their our your you they them he she we us out up off per via vs news report reports live update updates india indian'.split(' '))
const stem = (word: string) => { let w = word; for (let next = w; w.length > 4 && (next = w.replace(/(?:ing|ed|es|s)$/, '')) !== w;) w = next; return w }
/** Names keep their internal marks ("H-1B", "El Niño") so they stay one rare word. */
const wordsOf = (text: string) => text.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/(?<=\w)[-’'.](?=\w)/g, '').toLowerCase().split(/[^a-z0-9]+/).filter(w => (w.length > 2 || /\d/.test(w)) && !stop.has(w)).map(stem)
const SUMMARY_WEIGHT = 0.35
const terms = new WeakMap<NewsItem, Map<string, number>>()
function termsOf(item: NewsItem) {
  let out = terms.get(item)
  if (!out) {
    out = new Map()
    for (const w of wordsOf(item.description).slice(0, 40)) out.set(w, SUMMARY_WEIGHT)
    for (const w of wordsOf(item.title)) out.set(w, 1)
    terms.set(item, out)
  }
  return out
}
const isDigest = (item: NewsItem) => /^\s*(?:UPSC Key|Knowledge Nugget|Daily Briefing)\b|roundup|digest|week in/i.test(item.title)
/**
 * Names a headline is about: acronyms ("PERM", "H-1B") and capitalised phrases inside a sentence ("El Niño",
 * "Green Card", "Chilika"). Two headlines naming the same thing are on one topic however else they are worded.
 * Actors and places every day's news shares are not topics.
 */
const COMMON_NAMES = new Set(('india indian indians bharat centre govt government union state states cabinet parliament lok sabha rajya supreme court high sc hc cji pm cm mp mps mla minister ministry president governor chief justice secretary official officials commission committee panel council board bill act report study survey data index explained explainer opinion editorial analysis interview live updates news mint quick edit upsc key knowledge nugget hindu express times ' +
  'us usa uk un eu ai it gdp ceo md dg rbi sebi mea mha pmo bjp congress nda opposition modi trump biden putin xi america american britain british china chinese russia russian pakistan pakistani iran iranian israel israeli japan japanese europe european asia asian africa african gulf west east north south middle ' +
  'delhi mumbai kolkata chennai bengaluru hyderabad kerala keralam karnataka maharashtra gujarat rajasthan punjab haryana bihar odisha assam telangana andhra pradesh tamil nadu bengal uttar madhya jammu kashmir goa ' +
  'january february march april may june july august september october november december jan feb mar apr jun jul aug sep sept oct nov dec monday tuesday wednesday thursday friday saturday sunday fy q1 q2 q3 q4 crore lakh rs inr usd new old first second up nobel prize award awards day world global national international').split(' '))
/** Institutions and themes broad enough to carry two distinct readings a day (a decision and its analysis), never a page of them. */
const BROAD_THEMES = /(?<![A-Za-z0-9])(?:RBI|SEBI|AI|A\.I\.|ISRO|NASA|WHO|IMF|WTO|UNESCO|NATO)(?![A-Za-z0-9])/g
export const themeAllowance = (reports: number) => reports >= 30 ? 3 : 2
const themesOf = (item: NewsItem) => [...new Set(item.title.match(BROAD_THEMES) ?? [])].map(t => t.replace(/\./g, ''))
const fold = (text: string) => ' ' + text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' '
/** Acronyms are matched as written: "UP" and "IT" are also ordinary words. */
const cased = (text: string) => ' ' + text.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, ' ').trim() + ' '
const names = new WeakMap<NewsItem, { keys: string[]; acronyms: string[]; title: string; raw: string; text: string; rawText: string }>()
function namesOf(item: NewsItem) {
  let out = names.get(item)
  if (!out) {
    const words = item.title.split(/\s+/).filter(Boolean), plain = words.filter(w => /\p{L}{4,}/u.test(w) && !/^[^\p{L}\p{N}]*\p{Lu}[\p{Lu}\d&-]+\b/u.test(w)), capital = plain.filter(w => /^[^\p{L}\p{N}]*\p{Lu}/u.test(w)).length
    // A headline set in title case says nothing by its capitals; only its acronyms are read.
    const sentenceCase = plain.length < 4 || capital / plain.length < 0.7, keys = new Set<string>(), acronyms = new Set<string>()
    let run: string[] = [], starts = true
    const flush = () => { const phrase = fold(run.join(' ')).trim(), parts = phrase.split(' '); if (sentenceCase && phrase && !parts.every(p => COMMON_NAMES.has(p)) && (parts.length > 1 || phrase.length >= 5)) keys.add(phrase); run = [] }
    for (const raw of words) {
      const word = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '').replace(/[’']s$/u, '')
      const acronym = /^(?:\p{Lu}{2,}[\p{Lu}\d&-]*|\p{Lu}+-?\d+\p{Lu}*)s?$/u.test(word)
      if (acronym && !COMMON_NAMES.has(fold(word).trim())) acronyms.add(cased(word).trim())
      if (word && /^\p{Lu}/u.test(word) && !starts) run.push(word); else flush()
      starts = !word || /[:|?!.–—]$|^[‘“"'(]/u.test(raw) && !/^\p{Lu}[\p{L}]*[’']s?$/u.test(raw)
      if (/[,;:|?!]$/.test(raw)) flush()
    }
    flush()
    names.set(item, out = { keys: [...keys], acronyms: [...acronyms], title: fold(item.title), raw: cased(item.title), text: fold(item.title + ' ' + item.description), rawText: cased(item.title + ' ' + item.description) })
  }
  return out
}
/**
 * A name counts when the other headline carries it too. Within one subject a phrase or a longer acronym may also be
 * found in the other summary; across subjects a passing mention there does not make two readings one topic.
 */
function namesShared(a: NewsItem, b: NewsItem, summaries = true) {
  const x = namesOf(a), y = namesOf(b), has = (one: typeof x, other: typeof x) => one.acronyms.some(k => other.raw.includes(' ' + k + ' ') || summaries && k.length >= 4 && other.rawText.includes(' ' + k + ' ')) || one.keys.some(k => other.title.includes(' ' + k + ' ') || summaries && k.includes(' ') && other.text.includes(' ' + k + ' '))
  return has(x, y) || has(y, x)
}
interface Vector { values: Map<string, number>; norm: number }
/** Rarity is measured over every article in view, so a word the whole day is about (a Budget, a summit) joins nothing. */
function vectors(pool: NewsItem[]) {
  const df = new Map<string, number>()
  for (const item of pool) for (const term of termsOf(item).keys()) df.set(term, (df.get(term) ?? 0) + 1)
  const cache = new Map<NewsItem, Vector>()
  return (item: NewsItem): Vector => {
    let v = cache.get(item)
    if (!v) {
      const values = new Map<string, number>(); let sum = 0
      for (const [term, weight] of termsOf(item)) { const x = weight * Math.log(1 + pool.length / (df.get(term) ?? 1)); values.set(term, x); sum += x * x }
      cache.set(item, v = { values, norm: Math.sqrt(sum) || 1 })
    }
    return v
  }
}
function cosine(a: Vector, b: Vector) {
  const [small, large] = a.values.size < b.values.size ? [a.values, b.values] : [b.values, a.values]
  let dot = 0
  for (const [term, value] of small) { const other = large.get(term); if (other) dot += value * other }
  return dot / (a.norm * b.norm)
}

export function selectReading(units: ReadingUnit[], articles: QualifiedArticle[], previous: SelectedReading[], now: number, capacity: number = SELECTION_POLICY.capacity): SelectionResult {
  if (!Number.isFinite(now) || !Number.isInteger(capacity) || capacity < 0 || capacity > 50) throw new Error('Explicit selection clock and maximum 50 required')
  const byUrl = new Map(articles.map(a => [a.item.url, a])), previousById = new Map(previous.map(s => [s.id, s]))
  const qualified: RankedReading[] = units.flatMap(unit => {
    const members = unit.members.flatMap(m => { const a = byUrl.get(m.url); return a?.acceptance.accepted ? [a] : [] })
    if (!members.length) return []
    const primary = chooseRepresentative(members), alternatives = members.filter(a => a.item.url !== primary.item.url).sort((a, b) => a.item.url.localeCompare(b.item.url))
    // Independent reports corroborate a story; a paper repeating itself does not.
    const publishers = new Set(members.map(a => a.item.publisher)).size, old = previousById.get(unit.id)
    const quality = round(primary.editorial.score + (preference(primary) ? SELECTION_POLICY.preferred : 0) + Math.min(SELECTION_POLICY.corroboration, 0.75 * Math.log2(publishers)) + (old && old.selectedAt >= now - 86400000 ? SELECTION_POLICY.stickiness : 0))
    return [{ unit, primary, alternatives, quality, mustRead: quality >= SELECTION_POLICY.mustRead, reason: preference(primary) ? 'preferred_comparable_evidence' : members.some(preference) ? 'materially_stronger_evidence' : 'strongest_available_evidence' }]
  })
  const suppressed: SelectionResult['suppressed'] = [], replacements: RankedReading[] = []
  const candidates = qualified.filter(reading => {
    if (reading.unit.reason === 'comparison_budget_exceeded') { suppressed.push({ id: reading.unit.id, reason: 'evidence_limit' }); return false }
    const old = previousById.get(reading.unit.id)
    if (old) {
      replacements.push(reading)
      // A reading stays in Today for a day from its first selection and never re-enters afterwards.
      if (old.selectedAt < now - 86400000) { suppressed.push({ id: reading.unit.id, reason: 'repeat' }); return false }
      return true
    }
    const time = Date.parse(reading.primary.item.publishedAt ?? '')
    if (!Number.isFinite(time) || time > now || time < now - 86400000) { suppressed.push({ id: reading.unit.id, reason: 'undated_or_stale' }); return false }
    return true
  }).sort((a, b) => b.quality - a.quality || Number(preference(b.primary)) - Number(preference(a.primary)) || published(b.primary) - published(a.primary) || a.unit.id.localeCompare(b.unit.id))

  // Topics: readings that name the same thing are linked, and links chain, so every angle on one running story is one
  // topic even when two of its headlines share no word. Similar wording alone links two readings but does not chain.
  // Only readings good enough to be offered link topics: a digest or a live blog names everything and would join it all.
  const vector = vectors(articles.map(a => a.item)), linkable = candidates.map(r => !isDigest(r.primary.item)), topic = candidates.map((_, i) => i)
  const find = (i: number): number => topic[i] === i ? i : (topic[i] = find(topic[i]))
  const sameTopic = (x: RankedReading, y: RankedReading) => { const within = x.primary.subject.primary === y.primary.subject.primary; return namesShared(x.primary.item, y.primary.item, within) && (within || cosine(vector(x.primary.item), vector(y.primary.item)) >= SELECTION_POLICY.acrossSubjects) }
  for (let i = 0; i < candidates.length; i++) if (linkable[i]) for (let j = i + 1; j < candidates.length; j++) if (linkable[j] && find(i) !== find(j) && sameTopic(candidates[i], candidates[j])) topic[find(j)] = find(i)
  // A topic's weight is every report of it, not only its distinct stories.
  const size = new Map<number, number>()
  candidates.forEach((reading, i) => size.set(find(i), (size.get(find(i)) ?? 0) + reading.unit.members.length))
  const themeReports = new Map<string, number>(), themeChosen = new Map<string, RankedReading[]>()
  for (const reading of candidates) for (const theme of themesOf(reading.primary.item)) themeReports.set(theme, (themeReports.get(theme) ?? 0) + reading.unit.members.length)
  const today: RankedReading[] = [], subjects: Record<string, number> = {}, sources: Record<string, number> = {}, chosenByTopic = new Map<number, RankedReading[]>(), coverage = new Map<RankedReading, NewsItem[]>(), deferred: RankedReading[] = []
  let preferredComparable = 0, strongerOther = 0, mergedStories = 0, topicRepeats = 0, capacityLoss = 0
  const take = (reading: RankedReading, root: number) => {
    const subject = reading.primary.subject.primary
    today.push(reading); coverage.set(reading, [...reading.unit.members]); chosenByTopic.set(root, [...(chosenByTopic.get(root) ?? []), reading])
    subjects[subject] = (subjects[subject] ?? 0) + 1; sources[reading.primary.item.publisher] = (sources[reading.primary.item.publisher] ?? 0) + 1
    for (const theme of themesOf(reading.primary.item)) themeChosen.set(theme, [...(themeChosen.get(theme) ?? []), reading])
    if (reading.reason === 'preferred_comparable_evidence') preferredComparable++
    if (reading.reason === 'materially_stronger_evidence') strongerOther++
  }
  candidates.forEach((reading, i) => {
    const root = find(i), chosen = chosenByTopic.get(root) ?? [], subject = reading.primary.subject.primary as Subject
    // The same story joins the reading already chosen for it; a further angle on a covered topic is left out.
    const same = linkable[i] ? today.find(other => linkable[candidates.indexOf(other)] && Math.max(...coverage.get(other)!.map(item => cosine(vector(reading.primary.item), vector(item)))) >= SELECTION_POLICY.sameStory) : undefined
    if (same) { coverage.get(same)!.push(...reading.unit.members); mergedStories++; suppressed.push({ id: reading.unit.id, reason: 'topic_covered', by: same.unit.id }); return }
    if (chosen.length >= topicAllowance(size.get(root)!)) { topicRepeats++; suppressed.push({ id: reading.unit.id, reason: 'topic_covered', by: chosen[0].unit.id }); return }
    const alike = linkable[i] ? today.find(other => other.primary.subject.primary === subject && linkable[candidates.indexOf(other)] && cosine(vector(reading.primary.item), vector(other.primary.item)) >= SELECTION_POLICY.sameTopic) : undefined
    if (alike) { topicRepeats++; suppressed.push({ id: reading.unit.id, reason: 'topic_covered', by: alike.unit.id }); return }
    const crowded = linkable[i] ? themesOf(reading.primary.item).find(theme => (themeChosen.get(theme)?.length ?? 0) >= themeAllowance(themeReports.get(theme)!)) : undefined
    if (crowded) { topicRepeats++; suppressed.push({ id: reading.unit.id, reason: 'topic_covered', by: themeChosen.get(crowded)![0].unit.id }); return }
    if (today.length >= capacity) { capacityLoss++; suppressed.push({ id: reading.unit.id, reason: 'capacity' }); return }
    if ((subjects[subject] ?? 0) >= (SELECTION_POLICY.subjectCap[subject] ?? capacity)) { deferred.push(reading); return }
    take(reading, root)
  })
  // A subject's cap yields only when the day is otherwise thin; Polity and Governance never exceed theirs.
  for (const reading of deferred) {
    const root = find(candidates.indexOf(reading)), subject = reading.primary.subject.primary as Subject
    if (today.length < capacity && !SELECTION_POLICY.firmCap.includes(subject) && (chosenByTopic.get(root)?.length ?? 0) < topicAllowance(size.get(root)!)) take(reading, root)
    else suppressed.push({ id: reading.unit.id, reason: 'subject_cap' })
  }
  today.sort((a, b) => candidates.indexOf(a) - candidates.indexOf(b))
  // Other publishers' reports of a chosen story travel with it as further coverage.
  const listed = today.map(reading => { const members = [...new Map(coverage.get(reading)!.map(m => [m.url, m])).values()]; return members.length === reading.unit.members.length ? reading : { ...reading, unit: { ...reading.unit, members } } })
  const retained = [...new Map(previous.map(s => [s.id, s])).values()]
  for (const reading of [...replacements, ...listed]) {
    const prior = retained.find(s => s.id === reading.unit.id)
    const selected: SelectedReading = { id: reading.unit.id, selectedAt: prior?.selectedAt ?? now, lastSelectedAt: now, representative: reading.primary.item, members: [...new Set([...(prior?.members ?? []), ...reading.unit.members.map(m => m.url)])].sort(), frame: reading.unit.frame }
    if (prior) {
      // Never downgrade a historical representative merely because its source
      // vanished from this refresh. Compare its known accepted evidence too.
      const old = byUrl.get(prior.representative.url)
      if (old?.acceptance.accepted) selected.representative = chooseRepresentative([old, reading.primary]).item
      retained[retained.indexOf(prior)] = selected
    } else retained.push(selected)
  }
  return { today: listed, replacement: replacements.sort((a, b) => a.unit.id.localeCompare(b.unit.id)), suppressed: suppressed.sort((a, b) => a.id.localeCompare(b.id) || a.reason.localeCompare(b.reason)), retained: retained.sort((a, b) => b.selectedAt - a.selectedAt || a.id.localeCompare(b.id)), diagnostics: { qualifiedUnits: qualified.length, capacityLoss, sourceCounts: sources, subjectCounts: subjects, preferredComparable, strongerOther, mergedStories, topicRepeats } }
}
/** Similarity of two articles against a pool, for diagnostics and tests. */
export function similarityOver(pool: NewsItem[]) { const vector = vectors(pool); return (a: NewsItem, b: NewsItem) => cosine(vector(a), vector(b)) }
/** The names a headline is about, and whether two articles share one. */
export const topicNames = (item: NewsItem) => [...namesOf(item).acronyms, ...namesOf(item).keys]
export const sameNamedTopic = (a: NewsItem, b: NewsItem, sameSubject = true) => namesShared(a, b, sameSubject)
