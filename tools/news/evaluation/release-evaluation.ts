/** Offline exposed diagnostics. No holdout, acquisition or new labels. */
import { readFileSync, writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
import assert from 'node:assert/strict'
import { evaluateReading } from '../../../src/current-affairs/validator-v3/orchestrator.ts'
import { stageCVersions } from './stage-c-runner.ts'
import { digest } from './core.ts'
import type { StageCObservation } from '../../../src/current-affairs/validator-v3/contracts.ts'
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'))
const root = 'tools/news/evaluation/calibration-gold-v1/', gold = read(root + 'gold.json'), provenance = read(root + 'provenance.json')
const packageRoot = provenance.sourcePackage, clock = read(packageRoot + '/frozen-v2/predictions.json').clock
function run(observations: StageCObservation[]) {
  const input = { observations, clock, versions: stageCVersions(observations[0].registryHash) }, start = performance.now(), output = evaluateReading(input, [], [])
  const elapsed = performance.now() - start
  assert.deepEqual(evaluateReading({ ...input, observations: [...observations].reverse() }, [], []), output)
  return { output, elapsed, outputHash: digest(output) }
}
const calibration = run(read(root + 'observations.json')), broader = run(read(packageRoot + '/observations.json'))
const labels = new Map(gold.records.map((r: { record: { metadata: { url: string } }; resolvedGold: { value: string } | null }) => [r.record.metadata.url, r.resolvedGold]))
const topK = (k: number) => {
  const top = calibration.output.selection.today.slice(0, k), judged = top.filter(r => labels.get(r.primary.item.url)), positives = judged.filter(r => ['must_read', 'useful'].includes((labels.get(r.primary.item.url) as { value: string }).value))
  return { requestedK: k, available: top.length, fullKAvailable: top.length === k, judged: judged.length, numerator: positives.length, denominator: top.length, precision: judged.length === top.length && top.length ? positives.length / top.length : null, label: 'Descriptive exposed calibration only; no full candidate-pool or production claim' }
}
const observedTodayMust = gold.records.filter((r: { record: { metadata: { publishedAt: string | null } }; resolvedGold: { value: string } | null }) => r.resolvedGold?.value === 'must_read' && r.record.metadata.publishedAt && Date.parse(r.record.metadata.publishedAt) >= Date.parse(clock) - 86400000)
const selectedUrls = new Set(calibration.output.selection.today.flatMap(r => r.unit.members.map(m => m.url)))
const mustRetained = observedTodayMust.filter((r: { record: { metadata: { url: string } } }) => selectedUrls.has(r.record.metadata.url)).length
const baseline = read(packageRoot + '/frozen-v2/predictions.json'), acceptedV2 = new Set<string>(baseline.run.articles.filter((a: { decision: string }) => a.decision === 'accepted').map((a: { url: string }) => a.url))
const acceptedV3 = new Set(broader.output.c.articles.filter(a => a.accepted).map(a => a.url))
const sourceCounts = broader.output.selection.diagnostics.sourceCounts, total = broader.output.selection.today.length
const report = {
  label: 'Local exposed calibration + unreviewed 1000-article metadata shadow; NOT release evaluation', clock,
  calibration: { p20: topK(20), p50: topK(50), todayMustReadUrlRecall: { numerator: mustRetained, denominator: observedTodayMust.length, value: observedTodayMust.length ? mustRetained / observedTodayMust.length : null }, distinctReadingNeeds: { detected: calibration.output.selection.today.length, adjudicated: null }, duplicateExposure: null, selection: calibration.output.selection.diagnostics },
  wider: { articles: broader.output.articles.length, observations: read(packageRoot + '/observations.json').length, v2Accepted: acceptedV2.size, v3Accepted: acceptedV3.size, both: [...acceptedV2].filter(url => acceptedV3.has(url)).length, v3Only: [...acceptedV3].filter(url => !acceptedV2.has(url)).length, v2Only: [...acceptedV2].filter(url => !acceptedV3.has(url)).length, accepted: broader.output.c.articles.filter(a => a.accepted).length, deferred: broader.output.c.articles.filter(a => a.decision === 'deferred').length, today: total, sourceCounts, largestSourceShare: total ? Math.max(...Object.values(sourceCounts)) / total : null, secondarySourceShare: total ? broader.output.selection.today.filter(r => !['The Hindu', 'Indian Express'].includes(r.primary.item.publisher)).length / total : null, capacityLoss: broader.output.selection.diagnostics.capacityLoss, p20: null, p50: null, mustReadRecall: null, duplicateExposure: null, distinctReadingNeedRecall: null, reason: 'Broader natural records await independent adjudication; detected units are not gold reading needs', elapsedMs: broader.elapsed, outputHash: broader.outputHash, permutationEqual: true },
  qualityGates: { independentDevelopmentValidation: 'BLOCKED: independent labels unavailable', naturallyJudgedPairsTemporalAnchors: 'BLOCKED: unavailable', sealedA3: 'BLOCKED: future holdout and independent custodian unavailable; not invoked', realTemporalHistory: 'BLOCKED: captured evidence spans minutes, not multi-day sequences', syntheticReplay: 'PASS specified invariant tests only' },
}
writeFileSync('docs/release/evaluation.json', JSON.stringify(report, null, 2) + '\n')
writeFileSync('tools/news/.cache/release/wider-predictions.json', JSON.stringify(broader.output, null, 2) + '\n')
console.log(JSON.stringify(report))
