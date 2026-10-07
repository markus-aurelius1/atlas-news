import type { GoldRecord, Observation, Sampling } from './contracts.ts'
import { EMPTY_LABELS } from './contracts.ts'
import { digest, instant, ordered, requireThat, unique } from './core.ts'
import { validateGold, validateObservation } from './validate.ts'
import { validatePartitionManifest } from './split.ts'
import type { PartitionManifest } from './split.ts'

/** Neutral, observable strata. Priority order assigns an article to exactly one cell. */
export interface SamplingCell {
  id: string; panel: 'representative' | 'coverage'; take: number
  match: { sourceIds?: string[]; sections?: string[]; publishers?: string[]; categories?: string[]; titleContains?: string[]; hasByline?: boolean; captureDays?: string[] }
}
export interface SamplingPlan { namespace: string; seed: string; window: { start: string; end: string }; cells: SamplingCell[] }
export interface SampleEntry { id: string; url: string; observationIds: string[]; metadataObservationId: string; sampling: Sampling }
export interface SamplingManifest {
  version: 'tars-news-sample/v1'; mode: 'bootstrap'; plan: SamplingPlan; observationsHash: string
  populations: { cellId: string; panel: string; population: number; selected: number; probability: number | null }[]
  unmatched: number; entries: SampleEntry[]; hash: string
}
function matches(cell: SamplingCell, observations: Observation[]): boolean {
  const m = cell.match
  return (!m.sourceIds || observations.some(o => o.metadata.memberships.some(s => m.sourceIds!.includes(s.sourceId))))
    && (!m.sections || observations.some(o => o.metadata.memberships.some(s => m.sections!.includes(s.section))))
    && (!m.publishers || observations.some(o => m.publishers!.includes(o.metadata.publisher)))
    && (!m.categories || observations.some(o => o.metadata.categories.some(c => m.categories!.includes(c))))
    && (!m.titleContains || observations.some(o => m.titleContains!.some(t => o.metadata.title.toLowerCase().includes(t.toLowerCase()))))
    && (m.hasByline === undefined || observations.some(o => o.metadata.bylines.length > 0) === m.hasByline)
    && (!m.captureDays || m.captureDays.includes(observations.map(o => o.capturedAt.slice(0, 10)).sort()[0]))
}
export function sample(observations: Observation[], plan: SamplingPlan): SamplingManifest {
  requireThat(Object.keys(plan).every(k => ['namespace', 'seed', 'window', 'cells'].includes(k)) && plan.namespace && plan.seed, 'Invalid sampling plan')
  requireThat(Object.keys(plan.window).every(k => ['start', 'end'].includes(k)), 'Invalid window')
  requireThat(instant(plan.window.start) <= instant(plan.window.end), 'Invalid sampling window')
  requireThat(plan.cells.length > 0, 'At least one observable sampling cell required')
  unique(plan.cells, c => c.id, 'sampling cell')
  for (const cell of plan.cells) {
    requireThat(Object.keys(cell).every(k => ['id', 'panel', 'take', 'match'].includes(k)) && cell.id && ['representative', 'coverage'].includes(cell.panel) && Number.isInteger(cell.take) && cell.take >= 0, 'Invalid sampling cell')
    requireThat(Object.keys(cell.match).every(k => ['sourceIds', 'sections', 'publishers', 'categories', 'titleContains', 'hasByline', 'captureDays'].includes(k)), 'Sampling cannot use predictions or reviewer labels')
    for (const [k, v] of Object.entries(cell.match)) requireThat(k === 'hasByline' ? typeof v === 'boolean' : Array.isArray(v) && v.every(x => typeof x === 'string' && x.length > 0), 'Invalid observable predicate')
  }
  observations.forEach(validateObservation)
  unique(observations, o => o.id, 'observation')
  const eligible = ordered(observations.filter(o => instant(o.capturedAt) >= instant(plan.window.start) && instant(o.capturedAt) <= instant(plan.window.end)))
  const articles = new Map<string, Observation[]>()
  for (const o of eligible) articles.set(o.metadata.url, [...articles.get(o.metadata.url) ?? [], o])
  const cells = new Map(plan.cells.map(c => [c.id, [] as { url: string; observations: Observation[] }[]])); let unmatched = 0
  for (const [url, rows] of articles) {
    const cell = plan.cells.find(c => matches(c, rows))
    if (cell) cells.get(cell.id)!.push({ url, observations: rows }); else unmatched++
  }
  const entries: SampleEntry[] = [], populations: SamplingManifest['populations'] = []
  for (const cell of plan.cells) {
    const population = cells.get(cell.id)!.sort((a, b) => digest([plan.seed, cell.id, a.url]).localeCompare(digest([plan.seed, cell.id, b.url]), 'en'))
    const selected = population.slice(0, cell.take)
    const probability = population.length ? selected.length / population.length : null
    populations.push({ cellId: cell.id, panel: cell.panel, population: population.length, selected: selected.length, probability })
    for (const item of selected) {
      // Preserve all memberships/revisions via references, choose one real revision; never concatenate snippets.
      const latest = [...item.observations].sort((a, b) => b.capturedAt.localeCompare(a.capturedAt, 'en') || a.id.localeCompare(b.id, 'en'))[0]
      entries.push({ id: 'article:' + digest([plan.namespace, item.url]), url: item.url, observationIds: item.observations.map(o => o.id).sort(), metadataObservationId: latest.id,
        sampling: { panel: cell.panel, stratum: cell.id, seed: plan.seed, inclusionProbability: cell.panel === 'representative' ? probability : null, populationDenominator: population.length, window: plan.window, manifestHash: '0'.repeat(64), synthetic: false } })
    }
  }
  const payload = { version: 'tars-news-sample/v1' as const, mode: 'bootstrap' as const, plan, observationsHash: digest(eligible), populations, unmatched, entries: ordered(entries) }
  // Self references use an explicitly documented zero sentinel for the content commitment.
  const hash = digest(payload)
  for (const entry of payload.entries) entry.sampling.manifestHash = hash
  return { ...payload, hash }
}
export function validateSamplingManifest(manifest: SamplingManifest, observations: Observation[]): void {
  requireThat(manifest.mode === 'bootstrap' && manifest.version === 'tars-news-sample/v1', 'Invalid sampling manifest version')
  const rebuilt = sample(observations, manifest.plan)
  requireThat(digest(rebuilt) === digest(manifest), 'Sampling manifest changed or inputs differ')
}
/** Blind export: no machine output parameter, no reviewer suggestions, no holdout truth. */
export function annotationExport(manifest: SamplingManifest, observations: Observation[], partitions?: PartitionManifest): GoldRecord[] {
  validateSamplingManifest(manifest, observations)
  if(partitions)validatePartitionManifest(partitions)
  const lookup = new Map(observations.map(o => [o.id, o]))
  return manifest.entries.map(entry => {
    const record: GoldRecord = { version: 'tars-news-gold/v1', id: entry.id, observationIds: entry.observationIds,
      metadata: structuredClone(lookup.get(entry.metadataObservationId)!.metadata), sampling: structuredClone(entry.sampling),
      review: { status: 'unreviewed', annotations: [], adjudication: null }, gold: structuredClone(EMPTY_LABELS), partition: partitions?.assignments.find(a=>a.url===entry.url)?.partition ?? 'development' }
    requireThat(!partitions||partitions.assignments.some(a=>a.url===entry.url),'Sample missing from partition manifest')
    validateGold(record)
    return record
  })
}
