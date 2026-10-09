import type { NewsItem } from '../types.ts'
import { boundSource } from './metadata.ts'

export const STORY_POLICY = { id: 'tars-stories/1', historyDays: 14, strongestDays: 7, todayHours: 24, maxComparisonBucket: 512 } as const
const DAY = 86400000
export interface StoryFrame {
  actor: string; object: string; action: string; qualifiers: string[]
  angle: string | null; digest: boolean; tokens: string[]; signature: string
}
export interface MetadataObservation { item: NewsItem; observedAt: number; firstSeenAt: number }
export interface SelectedReading { id: string; selectedAt: number; lastSelectedAt: number; representative: NewsItem; members: string[]; frame: StoryFrame }
export interface ReadingUnit { id: string; members: NewsItem[]; frame: StoryFrame; novelty: 'new_development' | 'distinct_analysis' | 'repeat' | 'uncertain'; priorId: string | null; reason: string; firstSeenAt: number; selectedAt?: number }
export interface StoryResult { units: ReadingUnit[]; history: MetadataObservation[]; coverage: 'cold_start' | 'limited' | 'seven_days'; comparisons: number }
const norm = (s: string) => s.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const stop = new Set('the a an of to for in on at by as and or with from says said why how what is are was were new today latest has have will must it its this that about'.split(' '))
const actors: readonly [string, RegExp][] = [['rbi', /\bRBI\b|central bank/i], ['eci', /election commission|\bECI\b/i], ['supreme-court', /supreme court|constitutional court/i], ['isro', /\bISRO\b/i], ['nasa', /\bNASA\b/i], ['government', /government|cabinet|parliament/i]]
const objects: readonly [string, RegExp][] = [['liquidity', /liquidity|liquid assets/i], ['electoral-roll', /electoral roll|special intensive revision|\bSIR\b/i], ['nuclear-enrichment', /nuclear enrichment|uranium enrichment|Iran.{0,35}enrichment/i], ['dinosaur', /dinosaur/i], ['inflation', /inflation/i], ['climate', /climate|carbon emissions/i], ['tax', /tax devolution|fiscal federalism/i], ['data-protection', /data protection/i], ['trade', /trade agreement/i], ['quantum', /quantum computing|quantum research/i], ['mining', /mining law/i]]
const actions: readonly [string, RegExp][] = [['draft', /draft|propos\w*/i], ['invalidates', /invalidat\w*|strikes down/i], ['stay', /\bstay(?:s|ed)?\b|suspend\w*/i], ['implements', /implement\w*|enact\w*|comes into force/i], ['approves', /approv\w*|adopt\w*|ratif\w*/i], ['changes', /revis\w*|changes?|rewrit\w*|reforms?/i], ['discovery', /discover\w*|finding|identified|\bfound\b|study.{0,25}(?:reveals|shows|finds)/i], ['report', /report|dataset|data point/i], ['negotiates', /negotiat\w*|talks|bargain\w*/i]]
const angles: readonly [string, RegExp][] = [['constitutional-reasoning', /constitutional (?:reasoning|implications|rights)|judicial independence/i], ['economic-transmission', /inflation transmission|economic transmission|distributional impact/i], ['implementation-impact', /implementation (?:impact|barriers)|service delivery/i], ['strategic-capability', /capability (?:gap|assessment)|strategic deterrence/i], ['scientific-mechanism', /scientific mechanism|how.{0,40}(?:mechanism|works)/i]]
export function storyFrame(item: NewsItem): StoryFrame {
  const title = item.title, text = title + ' ' + item.description
  const actor = actors.find(([, rx]) => rx.test(text))?.[0] ?? ''
  const object = objects.find(([, rx]) => rx.test(text))?.[0] ?? ''
  const action = actions.find(([, rx]) => rx.test(title))?.[0] ?? ''
  const analytical = /editorial|opinion|column|analysis|explained/i.test(item.section) || item.memberships?.some(m => boundSource(item.url, item.publisher, m) && /editorial|opinion|column|analysis|explained/i.test(m.section))
  const angle = analytical ? angles.find(([, rx]) => rx.test(text))?.[0] ?? null : null
  // Counterparts, case/report identifiers, periods and numeric changes are
  // cannot-link constraints. Publication/updated dates are never event dates.
  const qualifiers = [...new Set([...text.matchAll(/\b(?:India|Iran|US|EU|China|Japan|Antarctica|Ukraine|Russia|202\d|Q[1-4]|FY\s?\d{2,4}(?:[-/]\d{2,4})?|\d+(?:\.\d+)?\s?(?:%|basis points)|case\s+[A-Z0-9-]+)\b/gi)].map(m => norm(m[0])))].sort()
  const tokens = [...new Set(norm(title).split(' ').filter(t => !stop.has(t) && t.length > 2))].sort()
  const digest = /roundup|digest|UPSC (?:Key|Essentials)|week in/i.test(title)
  return { actor, object, action, angle, digest, qualifiers, tokens, signature: JSON.stringify([actor, object, action, qualifiers, angle]) }
}
/** One named scientific award per explicit discipline/year. Publication dates
 * never supply award years. Explanatory headlines need independent angle review. */
function awardIdentity(item: NewsItem): string | null {
  if (/\b(?:how|why|explained|analysis)\b/i.test(item.title) || !/\b(?:awarded|wins?|won|goes to)\b/i.test(item.title)) return null
  const text = item.title + ' ' + item.description
  const subject = /\b(physics|chemistry|physiology\/medicine) Nobel\b|\bNobel (?:Prize )?(?:202\d )?(?:in )?(physics|chemistry|physiology\/medicine)\b/i.exec(text)
  const years = [...new Set([...text.matchAll(/\b202\d\b/g)].map(m => m[0]))]
  return subject && years.length === 1 ? `nobel:${(subject[1] ?? subject[2]).toLowerCase()}:${years[0]}` : null
}
function similarity(a: StoryFrame, b: StoryFrame) { const aa = new Set(a.tokens), bb = new Set(b.tokens); return [...aa].filter(t => bb.has(t)).length / (new Set([...aa, ...bb]).size || 1) }
const block = (item: NewsItem) => { const f = storyFrame(item); return !f.angle && awardIdentity(item) || (f.action && f.object ? f.signature : norm(item.title)) }
function buckets<T>(rows: T[], key: (row: T) => string): Map<string, T[]> { const result = new Map<string, T[]>(); for (const row of rows) { const k = key(row); const bucket = result.get(k); if (bucket) bucket.push(row); else result.set(k, [row]) } return result }
const theme = (item: NewsItem) => { const f = storyFrame(item); return JSON.stringify([f.actor, f.object, f.qualifiers.filter(q => /^(?:case |india|iran|us|eu|china|japan|antarctica|ukraine|russia)/.test(q))]) }
export function equivalentDevelopment(a: NewsItem, b: NewsItem): boolean {
  if (a.url === b.url) return true
  const left = storyFrame(a), right = storyFrame(b)
  if (left.digest || right.digest || left.angle !== right.angle) return false
  const award = awardIdentity(a)
  if (award && award === awardIdentity(b) && !left.angle && !right.angle) return true
  if (left.qualifiers.join('|') !== right.qualifiers.join('|')) return false
  if (left.action !== right.action || left.object !== right.object || left.actor !== right.actor) return false
  if (norm(a.title) === norm(b.title)) return true
  // No chaining: every comparison is with a fixed original representative.
  return !!left.action && !!left.object && similarity(left, right) >= 0.7
}
export function materialDelta(prior: NewsItem, next: NewsItem): boolean {
  const a = storyFrame(prior), b = storyFrame(next)
  return !!b.action && !!b.object && (a.action !== b.action || a.object !== b.object || a.qualifiers.join('|') !== b.qualifiers.join('|') || (!!b.angle && a.angle !== b.angle))
}

/** Pure metadata replay. Selected identities outlive the bounded comparison
 * history, so a repeat cannot re-enter simply because seven days elapsed. */
export function buildStories(current: MetadataObservation[], previous: MetadataObservation[], selected: SelectedReading[], now: number): StoryResult {
  if (!Number.isFinite(now)) throw new Error('Explicit story clock required')
  const available = [...previous, ...current].filter(o => Number.isFinite(o.observedAt) && Number.isFinite(o.firstSeenAt) && o.observedAt <= now && o.firstSeenAt <= o.observedAt && [o.item.publishedAt, o.item.updatedAt].every(t => t == null || Number.isFinite(Date.parse(t)) && Date.parse(t) <= now))
  const history = [...new Map(available.filter(o => o.observedAt >= now - STORY_POLICY.historyDays * DAY).sort((a, b) => a.observedAt - b.observedAt || a.item.url.localeCompare(b.item.url)).map(o => [JSON.stringify([o.item.url, o.item.title, o.item.description, o.item.updatedAt]), o])).values()]
  const availableSet = new Set(available)
  const prior = previous.filter(o => o.observedAt < now && o.observedAt >= now - STORY_POLICY.historyDays * DAY && availableSet.has(o))
  const units: ReadingUnit[] = []; let comparisons = 0
  const unitBuckets = new Map<string, ReadingUnit[]>(), selectedBuckets = buckets(selected.filter(s => s.selectedAt <= now), s => block(s.representative)), selectedUrls = new Map(selected.filter(s => s.selectedAt <= now).map(s => [s.representative.url, s]))
  const priorThemes = buckets(prior, o => theme(o.item)), priorUrls = buckets(prior, o => o.item.url)
  // Latest available revision per URL, with a deterministic metadata tie-break.
  const latest = new Map<string, MetadataObservation>()
  for (const o of current.filter(o => availableSet.has(o)).sort((a, b) => a.observedAt - b.observedAt || JSON.stringify(a.item).localeCompare(JSON.stringify(b.item)))) latest.set(o.item.url, o)
  const sorted = [...latest.values()].sort((a, b) => a.item.url.localeCompare(b.item.url))
  for (const observation of sorted) {
    const item = observation.item, frame = storyFrame(item)
    const key = block(item), currentBucket = unitBuckets.get(key) ?? [], selectedBucket = selectedBuckets.get(key) ?? []
    const themeBucket = frame.object ? priorThemes.get(theme(item)) ?? [] : [], urlBucket = priorUrls.get(item.url) ?? []
    // Never sample a crowded bucket and then claim its strongest comparison.
    // Explicit abstention bounds work without accepting possible repeat exposure.
    const exhausted = [currentBucket, selectedBucket, themeBucket, urlBucket].some(b => b.length > STORY_POLICY.maxComparisonBucket)
    const existing = !exhausted && currentBucket.find(u => { comparisons++; return equivalentDevelopment(u.members[0], item) })
    if (existing) { if (!existing.members.some(m => m.url === item.url)) existing.members.push(item); continue }
    const old = selectedUrls.get(item.url) ?? (!exhausted ? selectedBucket.find(s => { comparisons++; return equivalentDevelopment(s.representative, item) }) : undefined)
    // Highest similarity first, strongest recent comparison before older context.
    const candidates = exhausted ? [] : [...new Set([...urlBucket, ...themeBucket])]
    const matches = candidates.filter(() => { comparisons++; return true })
      .sort((a, b) => Number(b.observedAt >= now - 7 * DAY) - Number(a.observedAt >= now - 7 * DAY) || similarity(frame, storyFrame(b.item)) - similarity(frame, storyFrame(a.item)) || b.observedAt - a.observedAt || a.item.url.localeCompare(b.item.url))
    const sameUrl = matches.find(o => o.item.url === item.url), compared = sameUrl ?? matches[0]
    const delta = compared ? materialDelta(compared.item, item) : old ? materialDelta(old.representative, item) : false
    const repeat = !delta && (!!old || matches.some(o => equivalentDevelopment(o.item, item)))
    const novelty = exhausted ? 'uncertain' : repeat ? 'repeat' : frame.angle && (!compared || storyFrame(compared.item).angle !== frame.angle) ? 'distinct_analysis' : delta || frame.action && frame.object ? 'new_development' : 'uncertain'
    const unit: ReadingUnit = { id: old && !delta ? old.id : `reading:${item.url}:${frame.signature}`, members: [item], frame, novelty, priorId: old?.id ?? null,
      reason: exhausted ? 'comparison_budget_exceeded' : repeat ? 'equivalent_selected_or_observed' : delta ? 'material_action_object_period_or_effect_delta' : frame.angle ? 'evidenced_analytical_frame' : novelty === 'uncertain' ? 'insufficient_development_identity' : 'evidenced_development', firstSeenAt: Math.min(observation.firstSeenAt, sameUrl?.firstSeenAt ?? observation.firstSeenAt), ...(old ? { selectedAt: old.selectedAt } : {}) }
    units.push(unit); const group = unitBuckets.get(key); if (group) group.push(unit); else unitBuckets.set(key, [unit])
  }
  const earliest = Math.min(...previous.map(o => o.observedAt).filter(t => t <= now))
  return { units, history, coverage: !previous.length ? 'cold_start' : now - earliest >= 7 * DAY ? 'seven_days' : 'limited', comparisons }
}
