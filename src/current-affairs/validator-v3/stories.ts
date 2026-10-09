import type { NewsItem } from '../types.ts'
import { boundSource } from './metadata.ts'

export const STORY_POLICY = { id: 'tars-stories/1', historyDays: 14, strongestDays: 7, todayHours: 24, maxComparisonBucket: 512, lexicalDays: 3, lexicalShared: 5, lexicalOverlap: 0.75 } as const
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
const actions: readonly [string, RegExp][] = [['draft', /draft|propos\w*/i], ['invalidates', /invalidat\w*|strikes down/i], ['stay', /\bstay(?:s|ed)?\b|suspend\w*/i], ['implements', /implement\w*|enact\w*|comes into force/i], ['approves', /approv\w*|adopt\w*|ratif\w*/i], ['changes', /\b(?:revis(?:e[sd]?|ing|ion)|changes?|rewrit\w*|reforms?)\b/i], ['discovery', /discover\w*|finding|identified|\bfound\b|study.{0,25}(?:reveals|shows|finds)/i], ['report', /report|dataset|data point/i], ['negotiates', /negotiat\w*|talks|bargain\w*/i]]
const angles: readonly [string, RegExp][] = [['constitutional-reasoning', /constitutional (?:reasoning|implications|rights)|judicial independence/i], ['economic-transmission', /inflation transmission|economic transmission|distributional impact/i], ['implementation-impact', /implementation (?:impact|barriers)|service delivery/i], ['strategic-capability', /capability (?:gap|assessment)|strategic deterrence/i], ['scientific-mechanism', /scientific mechanism|how.{0,40}(?:mechanism|works)/i]]
export function storyFrame(item: NewsItem): StoryFrame {
  const title = item.title, text = title + ' ' + item.description
  const actor = actors.find(([, rx]) => rx.test(text))?.[0] ?? ''
  const object = objects.find(([, rx]) => rx.test(text))?.[0] ?? ''
  const action = actions.find(([kind, rx]) => { const m = rx.exec(title); return m && !(kind === 'changes' && /\b(?:without|not|no)\s+(?:\w+\s+){0,2}$/i.test(title.slice(Math.max(0, m.index - 35), m.index))) })?.[0] ?? ''
  const analytical = /editorial|opinion|column|analysis|explained/i.test(item.section) || item.memberships?.some(m => boundSource(item.url, item.publisher, m) && /editorial|opinion|column|analysis|explained/i.test(m.section))
  const monetaryAngle = actor === 'rbi' ? /inflation\b.{0,40}\b(?:fall on government|government.{0,15}(?:burden|responsibility))|government.{0,35}inflation/i.test(title) ? 'inflation-government-burden'
    : /(?:need|why|reason).{0,35}(?:safeguard|protect).{0,15}price stability/i.test(title) ? 'price-stability-rationale'
    : /(?:hints?|signals?).{0,45}(?:more.{0,15}coming|further.{0,15}(?:hikes?|tightening))|future tightening/i.test(title) ? 'future-tightening-outlook' : null : null
  // A captured explanation of an instrument's operation supports a reading
  // need regardless of whether it arrived via a science or podcast feed.
  const explainedInstrument = /\bhow\b.{0,100}\b(?:sensors?|detectors?)\b.{0,70}\b(?:detect|observe|measure)\w*/i.test(text)
  const angle = monetaryAngle ?? (explainedInstrument ? 'scientific-mechanism' : analytical ? angles.find(([, rx]) => rx.test(text))?.[0] ?? null : null)
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
function namedAward(item: NewsItem) {
  if (/\b(?:how|why|explained|analysis)\b/i.test(item.title) || !/\b(?:awarded|wins?|won|goes to)\b/i.test(item.title)) return null
  const text = item.title + ' ' + item.description
  const discipline = /\b(physics|chemistry|physiology\/medicine) Nobel\b|\bNobel (?:Prize )?(?:202\d )?(?:in )?(physics|chemistry|physiology\/medicine)\b/i.exec(text)
  const years = [...new Set([...text.matchAll(/\b202\d\b/g)].map(m => m[0]))]
  if (!discipline || years.length > 1) return null
  const names = [...text.matchAll(/\b[A-Z][\p{L}]+(?:\s+[A-Z]\.)?\s+[A-Z][\p{L}]+\b/gu)].map(m => norm(m[0])).filter(n => !/nobel|prize|academy|observatory|science|committee|swedish|royal/.test(n))
  const mechanism = norm(text).split(' ').filter(t => /^(?:neutrino\w*|icecube|autocatalysis|asymmetric|synthesis|tunnelling|biosensor\w*)$/.test(t))
  return { discipline: (discipline[1] ?? discipline[2]).toLowerCase(), years, names, mechanism }
}
/** Headline wording differs across publishers ("attack"/"attacked", "Russian"/"Russia's"). */
const stem = (token: string) => { let t = token; for (let next = t; t.length > 4 && (next = t.replace(/(?:ing|ed|es|s|n)$/, '')) !== t;) t = next; return t }
const expand = (title: string) => title.replace(/\bSC\b(?!\/ST)/g, 'Supreme Court').replace(/\bHC\b/g, 'High Court').replace(/\b[Gg]ovt\b/g, 'government')
const stems = (title: string) => [...new Set(norm(expand(title)).split(' ').filter(t => !stop.has(t) && t.length > 2).map(stem))]
const refusal = /\b(?:refus\w+|reject\w*|den(?:y|ies|ied)|dismiss\w*|declin\w+|not|no)\b/i
const explanatory = /\b(?:how|why|explained|explains|analysis|what)\b/i
const figures = (title: string) => [...new Set([...title.matchAll(/\d+(?:\.\d+)?/g)].map(m => m[0]))].sort().join('|')
// Counterparts are cannot-link evidence in any grammatical form.
const places: readonly [string, RegExp][] = [['india', /\bIndia(?:ns?)?\b/], ['us', /\bUS\b|\bU\.S\.|\bAmerican?\b/], ['eu', /\bEU\b|\bEuropean?\b/], ['uk', /\bUK\b|\bBritain\b|\bBritish\b/], ['china', /\bChin(?:a|ese)\b/], ['japan', /\bJapan(?:ese)?\b/], ['russia', /\bRussian?\b/], ['ukraine', /\bUkrain(?:e|ian)\b/], ['iran', /\bIran(?:ian)?\b/], ['israel', /\bIsraeli?\b/], ['pakistan', /\bPakistani?\b/], ['bangladesh', /\bBangladeshi?\b/], ['sri-lanka', /\bSri Lankan?\b/], ['nepal', /\bNepal(?:i|ese)?\b/], ['afghanistan', /\bAfghan(?:istan)?\b/], ['saudi', /\bSaudi\b/], ['france', /\bFrance\b|\bFrench\b/], ['germany', /\bGerman[y]?\b/], ['australia', /\bAustralian?\b/], ['canada', /\bCanad(?:a|ian)\b/], ['korea', /\bKorean?\b/], ['taiwan', /\bTaiwan(?:ese)?\b/], ['turkey', /\bTurk(?:ey|ish)\b|\bTürkiye\b/], ['antarctica', /\bAntarctic(?:a)?\b/]]
const counterparts = (title: string) => places.filter(([, rx]) => rx.test(title)).map(([id]) => id).join('|')
const named = (title: string) => new Set(expand(title).split(/\s+/).slice(1).filter(w => /^[^\p{L}]*\p{Lu}/u.test(w)).flatMap(w => stems(w)))
const analytical = (item: NewsItem) => /editorial|opinion|column|analysis|explained/i.test(item.section) || !!item.memberships?.some(m => boundSource(item.url, item.publisher, m) && /editorial|opinion|column|analysis|explained/i.test(m.section))
/** Same development reported under different wording: most of the shorter
 * headline's distinctive words recur, published within three days, with no
 * differing figure, counterpart, outcome or treatment. Typed frames and angles
 * are compared by the caller. */
function lexicalDevelopment(a: NewsItem, b: NewsItem): boolean {
  const at = Date.parse(a.publishedAt ?? ''), bt = Date.parse(b.publishedAt ?? '')
  if (!Number.isFinite(at) || !Number.isFinite(bt) || Math.abs(at - bt) > STORY_POLICY.lexicalDays * DAY) return false
  if (refusal.test(a.title) !== refusal.test(b.title) || explanatory.test(a.title) !== explanatory.test(b.title) || analytical(a) !== analytical(b)) return false
  if (figures(a.title) !== figures(b.title) || counterparts(a.title) !== counterparts(b.title)) return false
  const left = stems(a.title), right = new Set(stems(b.title)), shared = left.filter(t => right.has(t)).length
  // Two headlines that each name something the other does not are different subjects.
  const mine = new Set(left), an = named(a.title), bn = named(b.title)
  if (left.some(t => !right.has(t) && an.has(t)) && [...right].some(t => !mine.has(t) && bn.has(t))) return false
  return shared >=STORY_POLICY.lexicalShared && shared / Math.min(left.length, right.size) >= STORY_POLICY.lexicalOverlap
}
function lexicalIndex<T>(rows: T[], item: (row: T) => NewsItem) {
  const index = new Map<string, T[]>()
  for (const row of rows) for (const token of stems(item(row).title)) { const list = index.get(token); if (list) list.push(row); else index.set(token, [row]) }
  return index
}
function lexicalCandidates<T>(index: Map<string, T[]>, item: NewsItem): T[] {
  const counts = new Map<T, number>()
  for (const token of stems(item.title)) for (const row of index.get(token) ?? []) counts.set(row, (counts.get(row) ?? 0) + 1)
  return [...counts].filter(([, n]) => n >= STORY_POLICY.lexicalShared).map(([row]) => row)
}
function similarity(a: StoryFrame, b: StoryFrame) { const aa = new Set(a.tokens), bb = new Set(b.tokens); return [...aa].filter(t => bb.has(t)).length / (new Set([...aa, ...bb]).size || 1) }
const block = (item: NewsItem) => { const f = storyFrame(item); const award = namedAward(item); return !f.angle && award ? `award:${award.discipline}` : !f.angle && awardIdentity(item) || (f.action && f.object || f.angle && f.actor ? f.signature : norm(item.title)) }
function buckets<T>(rows: T[], key: (row: T) => string): Map<string, T[]> { const result = new Map<string, T[]>(); for (const row of rows) { const k = key(row); const bucket = result.get(k); if (bucket) bucket.push(row); else result.set(k, [row]) } return result }
const theme = (item: NewsItem) => { const f = storyFrame(item); return JSON.stringify([f.actor, f.object, f.qualifiers.filter(q => /^(?:case |india|iran|us|eu|china|japan|antarctica|ukraine|russia)/.test(q))]) }
export function equivalentDevelopment(a: NewsItem, b: NewsItem): boolean {
  if (a.url === b.url) return true
  const left = storyFrame(a), right = storyFrame(b)
  if (left.digest || right.digest || left.angle !== right.angle) return false
  const award = awardIdentity(a)
  if (award && award === awardIdentity(b) && !left.angle && !right.angle) return true
  const aa = namedAward(a), bb = namedAward(b)
  // Missing year may be reconciled only by the same named recipient AND
  // research mechanism. Explicit contradictory years never reconcile.
  if (aa && bb && aa.discipline === bb.discipline && (!aa.years.length || !bb.years.length || aa.years[0] === bb.years[0]) && aa.names.some(n => bb.names.includes(n)) && aa.mechanism.some(m => bb.mechanism.includes(m)) && !left.angle && !right.angle) return true
  // Summaries of unequal length must not split one report: the lexical path
  // reads headlines only and still honours a typed action that differs.
  if ((!left.action || !right.action || left.action === right.action) && lexicalDevelopment(a, b)) return true
  if (left.qualifiers.join('|') !== right.qualifiers.join('|')) return false
  if (left.action !== right.action || left.object !== right.object || left.actor !== right.actor) return false
  if (norm(a.title) === norm(b.title)) return true
  // No chaining: every comparison is with a fixed original representative.
  return (!!left.action && !!left.object || !!left.angle && !!left.actor) && similarity(left, right) >= 0.7
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
  // Differently worded headlines never share a block key; shared distinctive words nominate them for comparison.
  const unitIndex = new Map<string, ReadingUnit[]>(), selectedIndex = lexicalIndex(selected.filter(s => s.selectedAt <= now), s => s.representative), priorIndex = lexicalIndex(prior, o => o.item)
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
    const nearUnits = lexicalCandidates(unitIndex, item).filter(u => !currentBucket.includes(u)), nearSelected = lexicalCandidates(selectedIndex, item).filter(s => !selectedBucket.includes(s)), nearPrior = lexicalCandidates(priorIndex, item)
    const exhausted = [currentBucket, selectedBucket, themeBucket, urlBucket, nearUnits, nearSelected, nearPrior].some(b => b.length > STORY_POLICY.maxComparisonBucket)
    const existing = !exhausted && [...currentBucket, ...nearUnits].find(u => { comparisons++; return equivalentDevelopment(u.members[0], item) })
    if (existing) { if (!existing.members.some(m => m.url === item.url)) existing.members.push(item); continue }
    const old = selectedUrls.get(item.url) ?? (!exhausted ? [...selectedBucket, ...nearSelected].find(s => { comparisons++; return equivalentDevelopment(s.representative, item) }) : undefined)
    // Highest similarity first, strongest recent comparison before older context.
    const candidates = exhausted ? [] : [...new Set([...urlBucket, ...themeBucket])]
    const matches = candidates.filter(() => { comparisons++; return true })
      .sort((a, b) => Number(b.observedAt >= now - 7 * DAY) - Number(a.observedAt >= now - 7 * DAY) || similarity(frame, storyFrame(b.item)) - similarity(frame, storyFrame(a.item)) || b.observedAt - a.observedAt || a.item.url.localeCompare(b.item.url))
    const sameUrl = matches.find(o => o.item.url === item.url), compared = sameUrl ?? matches[0]
    const delta = compared ? materialDelta(compared.item, item) : old ? materialDelta(old.representative, item) : false
    const repeat = !delta && (!!old || matches.some(o => equivalentDevelopment(o.item, item)) || !exhausted && nearPrior.some(o => { comparisons++; return o.item.url !== item.url && equivalentDevelopment(o.item, item) }))
    const novelty = exhausted ? 'uncertain' : repeat ? 'repeat' : frame.angle && (!compared || storyFrame(compared.item).angle !== frame.angle) ? 'distinct_analysis' : delta || frame.action && frame.object ? 'new_development' : 'uncertain'
    const unit: ReadingUnit = { id: old && !delta ? old.id : `reading:${item.url}:${frame.signature}`, members: [item], frame, novelty, priorId: old?.id ?? null,
      reason: exhausted ? 'comparison_budget_exceeded' : repeat ? 'equivalent_selected_or_observed' : delta ? 'material_action_object_period_or_effect_delta' : frame.angle ? 'evidenced_analytical_frame' : novelty === 'uncertain' ? 'insufficient_development_identity' : 'evidenced_development', firstSeenAt: Math.min(observation.firstSeenAt, sameUrl?.firstSeenAt ?? observation.firstSeenAt), ...(old ? { selectedAt: old.selectedAt } : {}) }
    units.push(unit); const group = unitBuckets.get(key); if (group) group.push(unit); else unitBuckets.set(key, [unit])
    for (const token of stems(item.title)) { const near = unitIndex.get(token); if (near) near.push(unit); else unitIndex.set(token, [unit]) }
  }
  const earliest = Math.min(...previous.map(o => o.observedAt).filter(t => t <= now))
  return { units, history, coverage: !previous.length ? 'cold_start' : now - earliest >= 7 * DAY ? 'seven_days' : 'limited', comparisons }
}
