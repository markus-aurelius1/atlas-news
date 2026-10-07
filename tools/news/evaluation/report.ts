import { writeFileSync, mkdirSync, existsSync, realpathSync } from 'node:fs'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { digest, requireThat, stableJson } from './core.ts'
import type { EvaluationReport } from './evaluate.ts'
import type { Rate } from './metrics.ts'

export function renderReport(report: EvaluationReport): string {
  const show = (rate: Rate): string => `${rate.numerator}/${rate.denominator}: ${rate.value === null ? 'undefined (zero denominator)' : (100 * rate.value).toFixed(2) + '%'}`
  const acceptance = report.acceptance.naturalUnweightedDiagnostic
  return [
    '# Validator v3 evaluation infrastructure report', '',
    `Quality status: ${report.qualityClaim}.`, `Partition: ${report.partition}; clock: ${report.clock}.`,
    `Dataset hash: ${report.datasetHash}`, `Partition manifest: ${report.partitionManifestHash}`, `Prediction run: ${report.runHash}`, '',
    `Review completion (adjudicated or unresolvable): ${show(report.review.completion)}; adjudication coverage: ${show(report.review.adjudicationCoverage)}; unresolved excluded from truth metrics: ${report.review.excludedUnresolved}.`,
    `Natural resolved records: ${report.population.naturalResolved}; stress/regression records: ${report.population.stressResolved}.`, '',
    '| Stage | Conditional diagnostic |', '| --- | --- |',
    `| Acquisition | ${report.acquisition.status} |`,
    `| Acceptance precision | ${show(acceptance.precision)} |`,
    `| Acceptance recall | ${show(acceptance.recall)} |`,
    `| Acceptance F1 | ${show(acceptance.f1)} |`,
    `| Primary subject accuracy | ${show(report.representation.subjects.accuracy)} |`,
    `| Selection top-level reading needs | ${show(report.selection.topLevelNeedRecall)} |`,
    `| Selection expanded reading needs | ${show(report.selection.expandedNeedRecall)} |`, '',
    'The JSON companion retains counts, descriptive Wilson intervals, seeded group bootstrap intervals, panel weights, confusion matrices, source funnels, metadata sufficiency, review agreement, errors and unresolved metrics.',
    'Precision-at-K is pending for unjudged output; absent gold does not become a negative. Natural metrics exclude synthetic and legacy suites.',
    'Slice support below 50 positives is not demonstrated. These diagnostics do not approve gates or establish release quality.', '',
    'Pending: ' + report.pending.join(', ') + '.', '',
  ].join('\n')
}
/** Local artifact paths only, exclusive creation. Captures/labels/manifests are never overwritten. */
export function writeArtifact(path: string, value: unknown, text = false): { path: string; hash: string } {
  const root = fileURLToPath(new URL('./', import.meta.url)), target = resolve(path)
  requireThat(['data', '.runs', '.cache'].some(folder => target.startsWith(resolve(root, folder) + sep)), 'Artifacts must stay in evaluation/data, .runs or .cache')
  const actualRoot=realpathSync(root);let ancestor=dirname(target)
  while(!existsSync(ancestor))ancestor=dirname(ancestor)
  const actualAncestor=realpathSync(ancestor)
  requireThat(actualAncestor===actualRoot||actualAncestor.startsWith(actualRoot+sep),'Artifact parent escapes evaluation workspace')
  mkdirSync(dirname(target), { recursive: true })
  const content = text ? String(value) : stableJson(value) + '\n'
  writeFileSync(target, content, { encoding: 'utf8', flag: 'wx' })
  return { path: target, hash: digest(value) }
}
