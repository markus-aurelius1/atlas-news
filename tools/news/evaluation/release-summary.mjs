/** Freeze compact evidence from completed local logs/fixtures; never acquire data. */
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
const read = path => JSON.parse(readFileSync(path, 'utf8'))
const digest = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const cache = 'tools/news/.cache/release/'
const local = read('docs/release/local-checks.json')
assert(local.results.every(r => r.status === 'PASS'))
const rootLog = readFileSync(cache + 'final-root-tests.log', 'utf8'), pipelineLog = readFileSync(cache + 'final-pipeline.log', 'utf8'), evaluationLog = readFileSync(cache + 'final-evaluation.log', 'utf8'), lintLog = readFileSync(cache + 'final-lint.log', 'utf8')
assert.match(rootLog, /Tests\s+772 passed/); assert.match(rootLog, /Test Files\s+56 passed/)
assert.match(pipelineLog, /pass 39/); assert.match(pipelineLog, /skipped 6/); assert.match(pipelineLog, /fail 0/)
assert.match(evaluationLog, /pass 77/); assert.match(evaluationLog, /fail 0/)
assert.match(lintLog, /133 problems \(0 errors, 133 warnings\)/)
const browser = []
for (const name of ['atlas-cold-start/4313/results.json', 'label-visibility/results.json', 'vnext/learning-results-light.json', 'vnext/learning-results-dark.json', 'current-affairs-direct/results.json', 'reader/results.json', 'highlights/results.json', 'h21/after-timing.json', 'highlights-library/results.json', 'validator-v3/results.json', 'sync/results.json']) {
  const path = 'tools/browser/out/' + name, data = read(path)
  assert.equal(data.errors?.length ?? 0, 0, path)
  if (Array.isArray(data.checks)) assert(data.checks.every(c => !c || typeof c !== 'object' || c.ok !== false), path)
  browser.push({ name, checks: Array.isArray(data.checks) ? data.checks.length : data.checks, errors: 0, sha256: digest(path) })
}
const logs = ['combined-browser.log', 'combined-browser-resumed.log', 'combined-v3-browser.log', 'h3-workerd.log', 'final-default-news.log', 'combined-v3-build.log', 'final-default-build.log'].map(name => ({ path: cache + name, sha256: digest(cache + name) }))
assert(readFileSync(cache + 'combined-browser-resumed.log', 'utf8').includes('PASS native recall saved once'))
assert(readFileSync(cache + 'final-default-news.log', 'utf8').includes('276 Current Affairs checks passed; no page errors'))
assert(readFileSync(cache + 'final-default-build.log', 'utf8').includes('precache  166 entries'))
const report = { status: 'BLOCKED', engineering: 'PASS completed local gates, with explicit external canonical-ZIP skips', production: 'BLOCKED editorial evidence, broader coverage/source failures and hosted/device/capacity verification', defaultMode: 'v2', root: { tests: 772, files: 56 }, pipeline: { passed: 39, skipped: 6, failed: 0, reason: 'External canonical ZIP unavailable; protected assets unchanged' }, evaluationTests: 77, lint: { errors: 0, existingWarnings: 133 }, browser, logs, protectedFiles: read('docs/release/protected-hashes.json').files.length, runtimeCodeHash: read('docs/release/runtime-inventory.json').versions.codeHash, preservation: read('docs/release/preservation.json'), naturalQuality: read('docs/release/evaluation.json').qualityGates, notes: ['First sandbox-only umbrella failed at loopback startup; permitted local run continued.', 'Default umbrella passed through Reader, then failed on Highlights fixture missing registry generation; fixture repaired and explicit resume passed every remaining suite.', 'The final v2 build and News were checked after the Saved-only correction.', 'Synthetic replay/scale/controlled browser fixtures are not natural editorial or temporal gold.', 'No push, main integration, remote CI/migration/deployment, paid API, provisioning or billing change.'] }
writeFileSync('docs/release/verification.json', JSON.stringify(report, null, 2) + '\n')
console.log('Combined evidence frozen: local checks PASS; production readiness BLOCKED')
