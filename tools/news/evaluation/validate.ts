import { readFileSync } from 'node:fs'
import { Ajv } from 'ajv'
import type { ValidateFunction } from 'ajv'
import { NEWS_SOURCES } from '../../../src/current-affairs/sources.ts'
import { digest, instant, requireThat, stableJson, unique, urlIdentity } from './core.ts'
import type { EvidenceSpan, GoldRecord, Labels, Observation, PredictionOutput, RawCapture } from './contracts.ts'

const schema = JSON.parse(readFileSync(new URL('./schema.json', import.meta.url), 'utf8'))
const ajv = new Ajv({ allErrors: true, strict: false })
ajv.addFormat('utc-instant', { type: 'string', validate: value => { try { instant(value); return true } catch { return false } } })
ajv.addFormat('article-url', { type: 'string', validate: value => { try { return urlIdentity(value) === value } catch { return false } } })
ajv.addSchema(schema)
const checkGold = ajv.getSchema(schema.$id)!
const checkRaw = ajv.compile({ $ref: schema.$id + '#/$defs/capture' })
const checkObservation = ajv.compile({ $ref: schema.$id + '#/$defs/observation' })
const checkOutput = ajv.compile({ $ref: schema.$id + '#/$defs/output' })
const checkRun = ajv.compile({ $ref: schema.$id + '#/$defs/run' })
const checkJudgment = ajv.compile(JSON.parse(readFileSync(new URL('./judgment-schema.json', import.meta.url), 'utf8')))
export const checkJudgmentSchema = (value: unknown): void => check(checkJudgment, value)
function check(validator: ValidateFunction, value: unknown): void {
  // Diagnostics show paths/keywords, never raw metadata or labels from a sealed artifact.
  requireThat(validator(value), 'Schema violation: ' + (validator.errors ?? []).map(e => `${e.instancePath || '/'} (${e.keyword})`).join(', '))
}
export function validateObservation(value: unknown): asserts value is Observation {
  check(checkObservation, value)
  const observation = value as Observation
  requireThat(observation.metadataHash === digest(observation.metadata), 'Metadata hash mismatch')
  requireThat(observation.id === observationId(observation), 'Observation ID mismatch')
  requireThat(observation.metadata.memberships.some(m => m.sourceId === observation.sourceId), 'Missing source membership')
}
export function observationId(o: Omit<Observation, 'id'> | Observation): string {
  return 'obs:' + digest([o.captureId, o.sourceId, o.ordinal, o.capturedAt, o.registryHash, o.parserVersion, o.metadataHash])
}
export function validateRaw(value: unknown): asserts value is RawCapture {
  check(checkRaw, value)
  const raw = value as RawCapture
  unique(raw.sources, source => source.sourceId, 'source')
  unique(raw.sources.flatMap(s => s.observations), o => o.id, 'observation')
  for (const source of raw.sources) {
    const registry = NEWS_SOURCES.find(s => s.id === source.sourceId && s.enabled)
    requireThat(registry && registry.feedUrl === source.feedUrl, 'Source outside pinned allowlist')
    requireThat(source.countAfter === source.observations.length, 'Capture count mismatch')
    if (source.status !== 'failed') requireThat(source.countBefore === source.countAfter + source.invalidEntries! + source.truncatedEntries!, 'Parsing losses do not reconcile')
    requireThat(instant(source.capturedAt) <= instant(raw.capturedAt), 'Source capture after batch cutoff')
    for (const o of source.observations) {
      validateObservation(o)
      requireThat(o.captureId === raw.id && o.sourceId === source.sourceId && o.capturedAt === source.capturedAt, 'Observation provenance mismatch')
      requireThat(o.registryHash === raw.registryHash && o.parserVersion === raw.parserVersion, 'Capture version mismatch')
      requireThat(o.metadata.publisher === registry.publisher && o.metadata.memberships.every(m => m.sourceId === registry.id && m.feedUrl === registry.feedUrl && m.section === registry.section), 'Publisher/source spoofing')
    }
  }
}
function validateLabels(labels: Labels, observationIds: string[]): void {
  requireThat(!labels.primarySubject || !labels.secondarySubjects.includes(labels.primarySubject as never), 'Primary repeated as secondary')
  if (labels.metadataSufficiency) {
    requireThat(labels.metadataSufficiency.level !== 'sufficient' || labels.metadataSufficiency.missingFields.length === 0, 'Sufficient metadata has missing fields')
    requireThat(labels.metadataSufficiency.level !== 'insufficient' || labels.metadataSufficiency.missingFields.length > 0, 'Insufficient metadata needs a missing-field reason')
  }
  if (labels.novelty) {
    requireThat(labels.novelty.status !== 'repeat' || labels.novelty.relativeTo.length > 0, 'Repeat requires prior identity')
    requireThat(labels.novelty.status !== 'new_development' || labels.storyId && labels.materialDelta, 'New development needs identity and material delta')
    requireThat(labels.novelty.status !== 'distinct_analysis' || labels.angleId && labels.materialDelta, 'Distinct analysis needs identity and material delta')
    requireThat(!['repeat', 'not_applicable'].includes(labels.novelty.status) || labels.materialDelta === null, 'Repeat cannot have a new material delta')
  }
  for (const span of labels.materialDelta?.evidence ?? []) checkSpan(span, observationIds)
}
function checkSpan(span: EvidenceSpan, ids: string[], observations?: Map<string, Observation>): void {
  requireThat(ids.includes(span.observationId) && span.end > span.start, 'Invalid evidence span')
  if (observations) {
    const metadata = observations.get(span.observationId)!.metadata
    const text = span.field === 'categories' ? metadata.categories.join('\n') : span.field === 'bylines' ? metadata.bylines.map(b => b.name).join('\n') : metadata[span.field]
    requireThat(span.end <= text.length, 'Evidence beyond observed metadata')
  }
}
export function validateGold(value: unknown, access: 'implementation' | 'custodian' = 'implementation'): asserts value is GoldRecord {
  const partition = (value as { partition?: string } | null)?.partition
  requireThat(access === 'custodian' || !partition?.startsWith('holdout_'), 'Sealed holdout truth unavailable to implementation jobs')
  check(checkGold, value)
  const record = value as GoldRecord
  requireThat(instant(record.sampling.window.start) <= instant(record.sampling.window.end), 'Invalid sampling window')
  requireThat(record.sampling.synthetic === (record.partition === 'synthetic_adversarial'), 'Synthetic origin/partition mismatch')
  unique(record.review.annotations, a => a.reviewerId, 'independent reviewer')
  requireThat(record.review.status !== 'unreviewed' || record.review.annotations.length === 0, 'Unreviewed record has annotations')
  requireThat(record.review.status !== 'adjudicated' || stableJson(record.gold) === stableJson(record.review.adjudication!.labels), 'Adjudication and final truth disagree')
  if (record.review.adjudication) requireThat(record.review.annotations.every(a => instant(a.reviewedAt) <= instant(record.review.adjudication!.reviewedAt)), 'Adjudication predates review')
  validateLabels(record.gold, record.observationIds)
  for (const a of record.review.annotations) {
    validateLabels(a.labels, record.observationIds)
    for (const span of a.evidence) checkSpan(span, record.observationIds)
  }
}
/** Corpus validation adds referential integrity, safe metadata and temporal evidence checks. */
export function validateCorpus(records: unknown[], observations: Observation[], access: 'implementation' | 'custodian' = 'implementation'): GoldRecord[] {
  observations.forEach(validateObservation)
  unique(observations, o => o.id, 'observation')
  const lookup = new Map(observations.map(o => [o.id, o]))
  const result: GoldRecord[] = []
  for (const value of records) {
    validateGold(value, access)
    for (const id of value.observationIds) requireThat(lookup.has(id), 'Missing gold observation')
    const related = value.observationIds.map(id => lookup.get(id)!)
    requireThat(related.every(o => urlIdentity(o.metadata.url) === value.metadata.url), 'Gold references another article')
    requireThat(related.some(o => stableJson(o.metadata) === stableJson(value.metadata)), 'Gold metadata must be one actual observed revision')
    requireThat(related.every(o => instant(o.capturedAt) >= instant(value.sampling.window.start) && instant(o.capturedAt) <= instant(value.sampling.window.end)), 'Observation outside collection window')
    for (const labels of [value.gold, ...value.review.annotations.map(a => a.labels)]) {
      for (const span of labels.materialDelta?.evidence ?? []) checkSpan(span, value.observationIds, lookup)
      if (labels.novelty) {
        const cutoff = instant(labels.novelty.cutoff)
        requireThat(related.every(o => instant(o.capturedAt) <= cutoff), 'Novelty uses future observation')
        for (const prior of labels.novelty.relativeTo) requireThat(lookup.has(prior) && instant(lookup.get(prior)!.capturedAt) < cutoff, 'Missing/future novelty history')
      }
    }
    for (const annotation of value.review.annotations) for (const span of annotation.evidence) checkSpan(span, value.observationIds, lookup)
    result.push(value)
  }
  unique(result, r => r.id, 'gold record')
  unique(result, r => r.metadata.url, 'gold article (revisions belong in observationIds)')
  return result
}
export function validateOutput(value: unknown): asserts value is PredictionOutput {
  check(checkOutput, value)
  const output = value as PredictionOutput
  unique(output.articles, a => a.url, 'prediction URL')
  unique(output.units, u => u.id, 'reading unit')
  const accepted = new Set(output.articles.filter(a => a.decision === 'accepted').map(a => a.url))
  for (const unit of output.units) {
    requireThat(unit.memberUrls.includes(unit.primaryUrl), 'Primary absent from unit')
    requireThat(unit.memberUrls.every(url => accepted.has(url)), 'Selected unit contains an unaccepted article')
  }
}
export function validateRun(value: unknown): void {
  check(checkRun, value)
  const run = value as { articles: PredictionOutput['articles']; units: PredictionOutput['units']; outputHash: string }
  validateOutput({ articles: run.articles, units: run.units })
  requireThat(run.outputHash === digest({ articles: run.articles, units: run.units }), 'Prediction output digest mismatch')
}
