import type { StageCDecision } from './contracts.ts'
import type { NewsItem } from '../types.ts'
import type { SubjectDecision } from './subject.ts'
import type { ReadingUnit, SelectedReading } from './stories.ts'

export const SELECTION_POLICY = { id: 'tars-selection/1', capacity: 50, comparableTolerance: 0, maxAlternatives: 5 } as const
export interface QualifiedArticle { item: NewsItem; acceptance: StageCDecision; subject: SubjectDecision }
export interface RankedReading { unit: ReadingUnit; primary: QualifiedArticle; alternatives: QualifiedArticle[]; quality: number; mustRead: boolean; reason: string }
export interface SelectionResult { today: RankedReading[]; replacement: RankedReading[]; suppressed: { id: string; reason: 'repeat' | 'capacity' | 'undated_or_stale' }[]; retained: SelectedReading[]; diagnostics: { qualifiedUnits: number; capacityLoss: number; sourceCounts: Record<string, number>; subjectCounts: Record<string, number>; preferredComparable: number; strongerOther: number } }
const preference = (a: QualifiedArticle) => ['The Hindu', 'Indian Express'].includes(a.item.publisher)
function quality(article: QualifiedArticle) {
  const r = article.acceptance.relevance
  // Quality is evidence support, not publisher volume, snippet length or an
  // inferred body-quality assessment. Tier comparison is separate from score.
  return r.dimensions.topicalConnection + r.dimensions.substantiveSupport + r.dimensions.consequence + Number(article.acceptance.metadataSufficiency.description === 'present')
}
export function chooseRepresentative(articles: QualifiedArticle[]): QualifiedArticle {
  const accepted = articles.filter(a => a.acceptance.accepted)
  if (!accepted.length) throw new Error('Representative requires individually accepted metadata')
  const tier = Math.max(...accepted.map(a => Number(a.acceptance.relevance.status === 'must_read_candidate')))
  const top = accepted.filter(a => Number(a.acceptance.relevance.status === 'must_read_candidate') === tier), best = Math.max(...top.map(quality))
  const comparable = top.filter(a => best - quality(a) <= SELECTION_POLICY.comparableTolerance), preferred = comparable.filter(preference)
  return [...(preferred.length ? preferred : comparable)].sort((a, b) => quality(b) - quality(a) || (Date.parse(b.item.publishedAt ?? '') || 0) - (Date.parse(a.item.publishedAt ?? '') || 0) || a.item.url.localeCompare(b.item.url))[0]
}

export function selectReading(units: ReadingUnit[], articles: QualifiedArticle[], previous: SelectedReading[], now: number, capacity: number = SELECTION_POLICY.capacity): SelectionResult {
  if (!Number.isFinite(now) || !Number.isInteger(capacity) || capacity < 0 || capacity > 50) throw new Error('Explicit selection clock and maximum 50 required')
  const byUrl = new Map(articles.map(a => [a.item.url, a])), previousById = new Map(previous.map(s => [s.id, s]))
  const qualified: RankedReading[] = units.flatMap(unit => {
    const members = unit.members.flatMap(m => { const a = byUrl.get(m.url); return a?.acceptance.accepted ? [a] : [] })
    if (!members.length) return []
    const primary = chooseRepresentative(members), alternatives = members.filter(a => a.item.url !== primary.item.url).sort((a, b) => a.item.url.localeCompare(b.item.url))
    return [{ unit, primary, alternatives, quality: quality(primary), mustRead: primary.acceptance.relevance.status === 'must_read_candidate', reason: preference(primary) ? 'preferred_comparable_evidence' : members.some(preference) ? 'materially_stronger_evidence' : 'strongest_available_evidence' }]
  })
  const suppressed: SelectionResult['suppressed'] = [], replacements: RankedReading[] = []
  const candidates = qualified.filter(reading => {
    const old = previousById.get(reading.unit.id)
    if (reading.unit.novelty === 'repeat') {
      if (old) replacements.push(reading)
      if (!old || old.selectedAt < now - 86400000) { suppressed.push({ id: reading.unit.id, reason: 'repeat' }); return false }
      return true // Keep an already selected current edition visible on refresh.
    }
    const published = Date.parse(reading.primary.item.publishedAt ?? '')
    if (!Number.isFinite(published) || published > now || published < now - 86400000) { suppressed.push({ id: reading.unit.id, reason: 'undated_or_stale' }); return false }
    return true
  })
  const today: RankedReading[] = [], subjects: Record<string, number> = {}, sources: Record<string, number> = {}
  let preferredComparable = 0, strongerOther = 0
  while (candidates.length && today.length < capacity) {
    // Diverse subjects are compared only at the same fixed best evidence tier.
    const tier = Math.max(...candidates.map(r => Number(r.mustRead))), best = Math.max(...candidates.filter(r => Number(r.mustRead) === tier).map(r => r.quality))
    const band = candidates.filter(r => Number(r.mustRead) === tier && r.quality === best)
    band.sort((a, b) => (subjects[a.primary.subject.primary] ?? 0) - (subjects[b.primary.subject.primary] ?? 0) || Number(preference(b.primary)) - Number(preference(a.primary)) || (sources[a.primary.item.publisher] ?? 0) - (sources[b.primary.item.publisher] ?? 0) || (Date.parse(b.primary.item.publishedAt ?? '') || 0) - (Date.parse(a.primary.item.publishedAt ?? '') || 0) || a.unit.id.localeCompare(b.unit.id))
    const chosen = band[0]; today.push(chosen); candidates.splice(candidates.indexOf(chosen), 1)
    subjects[chosen.primary.subject.primary] = (subjects[chosen.primary.subject.primary] ?? 0) + 1; sources[chosen.primary.item.publisher] = (sources[chosen.primary.item.publisher] ?? 0) + 1
    if (chosen.reason === 'preferred_comparable_evidence') preferredComparable++
    if (chosen.reason === 'materially_stronger_evidence') strongerOther++
  }
  for (const reading of candidates) suppressed.push({ id: reading.unit.id, reason: 'capacity' })
  const retained = [...new Map(previous.map(s => [s.id, s])).values()]
  for (const reading of [...replacements, ...today]) {
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
  return { today, replacement: replacements.sort((a, b) => a.unit.id.localeCompare(b.unit.id)), suppressed: suppressed.sort((a, b) => a.id.localeCompare(b.id)), retained: retained.sort((a, b) => b.selectedAt - a.selectedAt || a.id.localeCompare(b.id)), diagnostics: { qualifiedUnits: qualified.length, capacityLoss: candidates.length, sourceCounts: sources, subjectCounts: subjects, preferredComparable, strongerOther } }
}
