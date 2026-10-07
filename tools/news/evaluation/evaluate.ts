import type { NewsSource } from '../../../src/current-affairs/types.ts'
import { SUBJECTS } from './contracts.ts'
import type { GoldRecord, Observation, Partition, RunArtifact, RawCapture } from './contracts.ts'
import { binary, clustering, agreement, groupedBootstrap, ndcg, rate, distribution } from './metrics.ts'
import { digest, instant, requireThat, unique, urlIdentity } from './core.ts'
import { validateCorpus, validateRun, validateRaw } from './validate.ts'
import { validatePartitionManifest } from './split.ts'
import type { PartitionManifest } from './split.ts'

export interface CoverageReference {
  id: string; url: string; publisher: string; referenceUrl: string; listedAt: string
  reviewStatus: 'adjudicated' | 'unreviewed' | 'unresolvable'; value: 'must_read' | 'useful' | null
}
export interface EvaluationContext {
  observations: Observation[]; history: Observation[]; partitions: PartitionManifest
  partition: Partition; bootstrapSeed: string; coverageInventory?: CoverageReference[]; access?: 'implementation' | 'custodian'
  rawCaptures?: RawCapture[]; rawRegistries?: NewsSource[][]
}
const positive = (r: GoldRecord): boolean => r.gold.value === 'must_read' || r.gold.value === 'useful'
const need = (r: GoldRecord): string => r.gold.angleId ? 'angle:' + r.gold.angleId : r.gold.storyId ? 'event:' + r.gold.storyId : 'article:' + r.metadata.url
const weight = (r: GoldRecord): number => r.sampling.inclusionProbability ? 1 / r.sampling.inclusionProbability : 1
export function evaluate(records: GoldRecord[], run: RunArtifact, context: EvaluationContext) {
  validateRun(run); validatePartitionManifest(context.partitions)
  requireThat(context.access === 'custodian' || !context.partition.startsWith('holdout_'), 'Holdout evaluation requires independent custodian')
  const observations = [...context.observations, ...context.history]
  const captures = context.rawCaptures ?? []
  captures.forEach(capture => validateRaw(capture, context.rawRegistries?.find(registry => digest(registry) === capture.registryHash)))
  unique(captures, c => c.id + ':' + c.shardIndex, 'raw capture/shard')
  requireThat(captures.every(c => instant(c.capturedAt) <= instant(run.clock)), 'Future raw capture')
  requireThat(observations.every(o => instant(o.capturedAt) <= instant(run.clock)), 'Evaluation contains future observations')
  requireThat(observations.every(o=>[o.metadata.publishedAt,o.metadata.updatedAt].every(t=>t===null||instant(t)<=instant(run.clock))),'Evaluation contains future publisher revision')
  requireThat(digest([...context.observations].sort((a, b) => a.id.localeCompare(b.id, 'en'))) === run.observationsHash && digest([...context.history].sort((a, b) => a.id.localeCompare(b.id, 'en'))) === run.historyHash, 'Run/evaluation input mismatch')
  requireThat(run.inputHash===digest({observations:[...context.observations].sort((a,b)=>a.id.localeCompare(b.id,'en')),history:[...context.history].sort((a,b)=>a.id.localeCompare(b.id,'en')),clock:run.clock,versions:run.versions}),'Replay input commitment mismatch')
  const observedUrlSet=new Set(observations.map(o=>o.metadata.url))
  requireThat(run.articles.every(p=>observedUrlSet.has(p.url)),'Prediction contains an unseen article')
  const gold = validateCorpus(records, observations, context.access).sort((a,b)=>a.id.localeCompare(b.id,'en'))
  const assignments = new Map(context.partitions.assignments.map(a => [a.url, a]))
  for (const r of gold) {
    const assignment = assignments.get(r.metadata.url)
    requireThat(assignment?.partition === r.partition, 'Gold partition does not match frozen manifest')
    requireThat(observations.filter(o=>o.metadata.url===r.metadata.url).every(o=>instant(o.capturedAt)>=instant(assignment.firstObservedAt)&&instant(o.capturedAt)<=instant(assignment.lastObservedAt)),'Partition dates do not contain actual observation history')
    for (const [id, group] of [[r.gold.storyId, assignment.developmentIds], [r.gold.themeId, assignment.themeIds], [r.gold.angleId, assignment.angleIds]] as const) requireThat(!id || group.includes(id), 'Gold family absent from leakage manifest')
  }
  const scope = gold.filter(r => r.partition === context.partition)
  const resolved = scope.filter(r => r.review.status === 'adjudicated')
  const natural = resolved.filter(r => !r.sampling.synthetic && r.sampling.panel !== 'stress' && !['legacy_regression', 'synthetic_adversarial'].includes(r.partition))
  const predictions = new Map(run.articles.map(p => [p.url, p]))
  const accepted = (r: GoldRecord): boolean => predictions.get(r.metadata.url)?.decision === 'accepted'
  const metrics = (rows: GoldRecord[], weighted = false) => binary(rows.map(r => ({ positive: positive(r), accepted: accepted(r), weight: weight(r) })), weighted)
  const positives = natural.filter(positive), representative = natural.filter(r => r.sampling.panel === 'representative')
  const bootstrap = (rows: GoldRecord[], weighted: boolean) => Object.fromEntries(['precision', 'recall', 'f1'].map(metric => [metric, groupedBootstrap(rows, r => r.gold.themeId ? 'theme:' + r.gold.themeId : 'day:' + r.sampling.window.start.slice(0, 10), sample => metrics(sample, weighted)[metric as 'precision'].value, context.bootstrapSeed)]))
  const recall = (rows: GoldRecord[]) => rate(rows.filter(accepted).length, rows.length)
  const slice = (test: (r: GoldRecord) => boolean) => { const rows = positives.filter(test); return { recall: recall(rows), support: rows.length, minimumPositiveSupportMet: rows.length >= 50 } }
  const subjects = positives.filter(r => r.gold.primarySubject !== null && r.gold.primarySubject !== 'not_applicable')
  const exact = (r: GoldRecord): boolean => predictions.get(r.metadata.url)?.primarySubject === r.gold.primarySubject
  const confusion: Record<string, Record<string, number>> = {}
  for (const r of subjects) { const truth = r.gold.primarySubject!, predicted = predictions.get(r.metadata.url)?.primarySubject ?? 'Unresolved'; (confusion[truth] ??= {})[predicted] = (confusion[truth]?.[predicted] ?? 0) + 1 }
  const perSubject = Object.fromEntries(SUBJECTS.map(subject => [subject, binary(subjects.map(r => ({ positive: r.gold.primarySubject === subject, accepted: predictions.get(r.metadata.url)?.primarySubject === subject })))]))
  const definedF1 = Object.values(perSubject).map(m => m.f1.value).filter((v): v is number => v !== null)
  const known = new Map(natural.map(r => [r.metadata.url, r])), gain = (r: GoldRecord | undefined): number | null => r ? r.gold.value === 'must_read' ? 3 : positive(r) ? 1 : 0 : null
  const topUrls = new Set(run.units.map(u => u.primaryUrl)), expandedUrls = new Set(run.units.flatMap(u => u.memberUrls))
  const uniqueRecall = (rows: GoldRecord[], urls: Set<string>) => {
    const needs = new Set(rows.map(need)), covered = new Set(rows.filter(r => urls.has(r.metadata.url)).map(need))
    return rate(covered.size, needs.size)
  }
  const topLevel = run.units.map(u => known.get(u.primaryUrl)), judgedTop = topLevel.filter((r): r is GoldRecord => !!r)
  const topNeeds = judgedTop.filter(positive).map(need)
  const duplicateCount = topNeeds.length - new Set(topNeeds).size
  const knownRepeats = judgedTop.filter(r => r.gold.themeId && r.gold.novelty?.cutoff === run.clock && r.gold.novelty.status === 'repeat')
  const continuing = judgedTop.filter(r => r.gold.themeId && r.gold.novelty?.cutoff === run.clock)
  const temporalPositive = positives.filter(r => r.gold.novelty?.cutoff === run.clock && ['new_development', 'distinct_analysis'].includes(r.gold.novelty.status))
  const eventGold = natural.filter(r => r.gold.storyId !== null)
  const eventMetrics = clustering(eventGold.map(r => ({ id: r.id, gold: r.gold.storyId!, predicted: predictions.get(r.metadata.url)?.eventId ?? null })))
  const statusCounts = Object.fromEntries(['unreviewed','in_review','disputed','adjudicated','unresolvable'].map(s => [s, scope.filter(r => r.review.status === s).length]))
  const annotationPairs = scope.filter(r => r.review.annotations.length >= 2).map(r => r.review.annotations.slice(0, 2))
  const agreements = Object.fromEntries(['value','primarySubject','partyPoliticsPrimary'].map(field => [field, agreement(annotationPairs.map(pair => ({ left: pair[0].labels[field as 'value'] === null ? null : String(pair[0].labels[field as 'value']), right: pair[1].labels[field as 'value'] === null ? null : String(pair[1].labels[field as 'value']) })))]))
  const sufficiency = Object.fromEntries(['sufficient','limited','insufficient'].map(level => [level, {
    all: natural.filter(r => r.gold.metadataSufficiency?.level === level).length,
    positive: positives.filter(r => r.gold.metadataSufficiency?.level === level).length,
    acceptance: recall(positives.filter(r => r.gold.metadataSufficiency?.level === level)),
  }]))
  const missingFields = Object.fromEntries(['title','description','bylines','categories','publication_time','scope','development','angle'].map(field => [field, natural.filter(r => r.gold.metadataSufficiency?.missingFields.includes(field as 'title')).length]))
  const inventory = context.coverageInventory ?? []
  unique(inventory, i => i.id, 'coverage reference')
  unique(inventory, i => urlIdentity(i.url), 'coverage URL')
  for (const i of inventory) {
    requireThat(Object.keys(i).every(k => ['id','url','publisher','referenceUrl','listedAt','reviewStatus','value'].includes(k)), 'Coverage inventory must be listing metadata only')
    requireThat(i.id && i.publisher && ['adjudicated','unreviewed','unresolvable'].includes(i.reviewStatus) && ['must_read','useful',null].includes(i.value), 'Invalid coverage reference')
    urlIdentity(i.referenceUrl); requireThat(instant(i.listedAt) <= instant(run.clock), 'Future coverage inventory')
    requireThat(i.reviewStatus !== 'adjudicated' || i.value !== null, 'Unresolved acquisition reference')
    requireThat(i.reviewStatus === 'adjudicated' || i.value === null, 'Unreviewed acquisition truth')
  }
  const expected = inventory.filter(i => i.reviewStatus === 'adjudicated'), observedUrls = new Set(observations.map(o => o.metadata.url))
  const observed = expected.filter(i => observedUrls.has(urlIdentity(i.url)))
  const coverage = expected.length ? { inventoryHash: digest(inventory), expected: expected.length, unresolvedReferences: inventory.length - expected.length,
    acquisitionRecall: rate(observed.length, expected.length), acceptedGivenObserved: rate(observed.filter(i => predictions.get(urlIdentity(i.url))?.decision === 'accepted').length, observed.length),
    representedGivenObserved: rate(observed.filter(i => expandedUrls.has(urlIdentity(i.url))).length, observed.length), absentUrls: expected.filter(i => !observedUrls.has(urlIdentity(i.url))).map(i => i.url), status: 'bounded_independent_listing_inventory' }
    : { status: 'pending_independent_inventory', expected: 0, unresolvedReferences: inventory.length }
  const sourceIds = [...new Set(observations.flatMap(o => o.metadata.memberships.map(m => m.sourceId)))].sort()
  const sourceFunnel = sourceIds.map(sourceId => {
    const urls = new Set(observations.filter(o => o.metadata.memberships.some(m => m.sourceId === sourceId)).map(o => o.metadata.url))
    return { sourceId, rawObservations: observations.filter(o => o.metadata.memberships.some(m => m.sourceId === sourceId)).length, rawUrls: urls.size,
      judgedPositive: positives.filter(r => urls.has(r.metadata.url)).length, metadataSufficient: natural.filter(r => urls.has(r.metadata.url) && r.gold.metadataSufficiency?.level === 'sufficient').length,
      accepted: run.articles.filter(p => urls.has(p.url) && p.decision === 'accepted').length, topLevel: [...topUrls].filter(u => urls.has(u)).length, expanded: [...expandedUrls].filter(u => urls.has(u)).length }
  })
  const topK = [20, 50, 100].map(k => {
    const list = topLevel.slice(0, k), unknown = list.filter(r => !r).length, relevant = list.filter(r => r && positive(r)).length
    const seen = new Set<string>(), readingNeedGains = list.map(r => {
      if (!r) return null
      if (seen.has(need(r))) return 0
      seen.add(need(r)); return gain(r)
    })
    const idealNeeds = [...new Map(natural.map(r => [need(r), Math.max(...natural.filter(other => need(other) === need(r)).map(other => gain(other)!))])).values()]
    return { k, outputCount: list.length, judgementCoverage: rate(list.length - unknown, list.length), precision: unknown ? null : rate(relevant, list.length),
      precisionBounds: list.length ? [relevant / list.length, (relevant + unknown) / list.length] : null,
      ndcg: ndcg(readingNeedGains, idealNeeds, k), status: unknown ? 'pending_judgments' : 'conditional_corpus_only' }
  })
  const mistakes = positives.flatMap(r => {
    const p = predictions.get(r.metadata.url), errors: string[] = []
    if (!accepted(r)) errors.push(r.gold.metadataSufficiency?.level === 'insufficient' ? 'insufficient_metadata' : p?.decision === 'deferred' ? 'acceptance_deferred' : 'acceptance_error')
    if (r.gold.primarySubject && !exact(r)) errors.push('subject_error')
    if (accepted(r) && !expandedUrls.has(r.metadata.url) && !positives.some(other => need(other) === need(r) && expandedUrls.has(other.metadata.url))) errors.push('selection_error')
    return errors.length ? [{ id: r.id, url: r.metadata.url, value: r.gold.value, errors }] : []
  })
  return {
    version: 'tars-news-evaluation/v1', qualityClaim: 'pending_release_holdout_and_owner_approved_gates', partition: context.partition,
    datasetHash: digest(gold), partitionManifestHash: context.partitions.hash, runHash: digest(run), clock: run.clock, versions: run.versions,
    review: { counts: statusCounts, total: scope.length, resolved: resolved.length, excludedUnresolved: scope.length - resolved.length, completion: rate(resolved.length+scope.filter(r=>r.review.status==='unresolvable').length, scope.length), adjudicationCoverage:rate(resolved.length,scope.length), agreements },
    population: { naturalResolved: natural.length, stressResolved: resolved.length - natural.length, missingPredictions: natural.filter(r => !predictions.has(r.metadata.url)).length,
      acceptedUnjudged:run.articles.filter(p=>p.decision==='accepted'&&!natural.some(r=>r.metadata.url===p.url)).length,
      acceptedJudgementCoverage:rate(natural.filter(accepted).length,run.articles.filter(p=>p.decision==='accepted').length) },
    acquisition: coverage,
    sourceHealth: captures.length ? { captureHash: digest(captures), sources: captures.flatMap(c => c.sources).map(s => ({ sourceId:s.sourceId, capturedAt:s.capturedAt, status:s.status, failure:s.failure, countBefore:s.countBefore, countAfter:s.countAfter, invalidEntries:s.invalidEntries, truncatedEntries:s.truncatedEntries })) } : { status: 'pending_raw_source_health_artifacts' },
    acceptance: {
      naturalUnweightedDiagnostic: metrics(natural), representative: metrics(representative), representativeWeighted: metrics(representative, true),
      representativeGroupedIntervals: bootstrap(representative, true), naturalGroupedIntervals: bootstrap(natural, false), coveragePanel: metrics(natural.filter(r => r.sampling.panel === 'coverage')),
      stressInvariantDiagnostics: metrics(resolved.filter(r => !natural.includes(r))), mustRead: slice(r => r.gold.value === 'must_read'),
      protectedSlices: { editorial: slice(r => r.gold.contentType === 'editorial'), column: slice(r => r.gold.contentType === 'column'), editorialColumn: slice(r => ['editorial','column'].includes(r.gold.contentType!)), explained: slice(r => r.gold.contentType === 'explainer'), science: slice(r => r.gold.primarySubject === 'Sci-Tech'), security: slice(r => r.gold.primarySubject === 'Security'), ir: slice(r => r.gold.primarySubject === 'International relations'), economy: slice(r => r.gold.primarySubject === 'Economy'), environment: slice(r => r.gold.primarySubject === 'Environment'), globalKnowledge: slice(r => r.gold.scope === 'global_knowledge'), globalSystemic: slice(r => r.gold.scope === 'global_systemic'), incidentalParty: slice(r => r.gold.partyMention === true && r.gold.partyPoliticsPrimary === false) },
      partyFalsePositive: rate(natural.filter(r => r.gold.value === 'reject' && r.gold.partyPoliticsPrimary && accepted(r)).length, natural.filter(r => r.gold.value === 'reject' && r.gold.partyPoliticsPrimary).length),
      foreignDomesticFalsePositive: rate(natural.filter(r => r.gold.value === 'reject' && r.gold.scope === 'foreign_domestic_no_impact' && accepted(r)).length, natural.filter(r => r.gold.value === 'reject' && r.gold.scope === 'foreign_domestic_no_impact').length),
      misses: positives.filter(r => !accepted(r)).length, deferredPositiveMisses: positives.filter(r => predictions.get(r.metadata.url)?.decision === 'deferred').length,
    },
    metadata: { sufficiency, missingFields, unresolvableRecords: scope.filter(r => r.review.status === 'unresolvable').length,
      unresolvedAnnotationSufficiency: Object.fromEntries(['sufficient','limited','insufficient'].map(level=>[level,scope.filter(r=>r.review.status!=='adjudicated').flatMap(r=>r.review.annotations).filter(a=>a.labels.metadataSufficiency?.level===level).length])),
      sufficientPositiveShare: rate(positives.filter(r => r.gold.metadataSufficiency?.level === 'sufficient').length, positives.length), interpretation: 'Sufficiency is an observable ceiling diagnostic, not an achieved recall target. Unresolved annotation counts are provisional reviewer assessments, not final truth.' },
    representation: { subjects: { accuracy: rate(subjects.filter(exact).length, subjects.length), missingGoldPrimary: positives.length - subjects.length, abstention: rate(subjects.filter(r => !predictions.get(r.metadata.url)?.primarySubject).length, subjects.length), selectiveAccuracy: rate(subjects.filter(r => predictions.get(r.metadata.url)?.primarySubject && exact(r)).length, subjects.filter(r => predictions.get(r.metadata.url)?.primarySubject).length), conditionalOnAcceptance: rate(subjects.filter(r => accepted(r) && exact(r)).length, subjects.filter(accepted).length), macroF1: definedF1.length ? definedF1.reduce((s, v) => s + v, 0) / definedF1.length : null, macroDefinedSubjects: definedF1.length, perSubject, confusion }, events: eventMetrics },
    selection: {
      acceptedNeedMisses: new Set(positives.filter(accepted).map(need)).size - new Set(positives.filter(r => accepted(r) && expandedUrls.has(r.metadata.url)).map(need)).size,
      topLevelNeedRecall: uniqueRecall(positives, topUrls), expandedNeedRecall: uniqueRecall(positives, expandedUrls),
      mustReadTopLevel: uniqueRecall(positives.filter(r => r.gold.value === 'must_read'), topUrls), mustReadExpanded: uniqueRecall(positives.filter(r => r.gold.value === 'must_read'), expandedUrls),
      analysisAngleRecall: uniqueRecall(positives.filter(r => r.gold.angleId !== null), expandedUrls),
      materialNoveltyRecall: uniqueRecall(temporalPositive, expandedUrls), saturation: rate(knownRepeats.length, continuing.length), noveltyJudgementCoverage: rate(continuing.length, judgedTop.filter(r => r.gold.themeId).length),
      duplicateExposure: rate(duplicateCount, run.units.length), unjudgedTopLevel: run.units.length - judgedTop.length, duplicateExposureStatus: judgedTop.length === run.units.length ? 'measured' : 'lower_bound_pending_judgments',
      topK, mustReadCapacity: { capacity: 100, knownNeeds: new Set(positives.filter(r => r.gold.value === 'must_read').map(need)).size, status: 'Conditional on corpus completeness; capacity does not waive misses.' },
    }, sourceFunnel, selectionDistribution: {subjects:distribution(judgedTop.map(r=>r.gold.primarySubject??'Unresolved')),themes:distribution(judgedTop.map(r=>r.gold.themeId??'unrelated:'+r.metadata.url)),publishers:distribution(run.units.map(u=>observations.find(o=>o.metadata.url===u.primaryUrl)?.metadata.publisher??'Unknown'))},errors: mistakes,
    pending: ['owner_approved_gates', 'release_corpus_and_sealed_holdouts', 'acquisition_inventory_if_absent', 'pair_anchor_sequence_annotations_if_absent', 'complete_replay_candidate_judgments', 'physical_device_performance'],
  }
}
export type EvaluationReport = ReturnType<typeof evaluate>
