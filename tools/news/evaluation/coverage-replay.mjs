/** Rebuild the before snapshot from the mandatory Git parent in a local archive,
 * then evaluate current code. Never checks out or writes a sibling worktree. */
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import assert from 'node:assert/strict'
const cache = resolve('tools/news/.cache/coverage-recovery'), baseline = cache + '/baseline'
mkdirSync(baseline, { recursive: true })
execFileSync('git', ['archive', '--format=zip', '-o', cache + '/baseline.zip', 'b30ef74cfd3b923940cd5968877452c99ca0bac8', 'src', 'tools/news/evaluation', 'public/current-affairs/v2/relevance-index.json'])
execFileSync('tar', ['-xf', cache + '/baseline.zip', '-C', baseline])
copyFileSync('tools/news/evaluation/coverage-audit.ts', baseline + '/tools/news/evaluation/coverage-audit.ts')
execFileSync(process.execPath, ['tools/news/evaluation/coverage-audit.ts', 'before'], { cwd: baseline, stdio: ['ignore', 'ignore', 'inherit'] })
const path = baseline + '/tools/news/.cache/coverage-recovery/before.json'
const previous = existsSync(cache + '/before.json') ? JSON.parse(readFileSync(cache + '/before.json', 'utf8')) : JSON.parse(readFileSync('docs/coverage-recovery/DECISION_FUNNEL.json', 'utf8')).before
const reconstructed = JSON.parse(readFileSync(path, 'utf8'))
assert.equal(previous.wider.outputHash, reconstructed.wider.outputHash)
assert.equal(previous.calibration.outputHash, reconstructed.calibration.outputHash)
copyFileSync(path, cache + '/before.json')
assert(baseline.startsWith(cache + sep) || baseline.startsWith(cache + '/'))
assert.equal(resolve(baseline), resolve(cache, 'baseline'))
rmSync(baseline, { recursive: true, force: true })
execFileSync(process.execPath, ['tools/news/evaluation/coverage-audit.ts', 'after'], { stdio: ['ignore', 'ignore', 'inherit'] })
console.log('Mandatory-parent shadow and calibration exactly reconstructed; current replay and permutation checks pass.')
