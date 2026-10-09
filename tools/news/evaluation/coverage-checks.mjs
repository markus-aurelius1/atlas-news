/** Existing local dependencies only; no installs, remote jobs or frozen output writes. */
import { spawnSync, execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
const cache = 'tools/news/.cache/coverage-recovery'
mkdirSync(cache + '/tmp', { recursive: true })
const env = { ...process.env, TEMP: resolve(cache + '/tmp'), TMP: resolve(cache + '/tmp') }
const checks = [
  ['focused', ['node_modules/vitest/vitest.mjs', 'run', 'src/current-affairs/validator-v3']],
  ['evaluation', ['--test', ...readdirSync('tools/news/evaluation').filter(n => /\.test\.(ts|mjs)$/.test(n)).map(n => 'tools/news/evaluation/' + n)]],
  ['typecheck', ['node_modules/typescript/bin/tsc', '-b']],
  ['lint', ['node_modules/eslint/bin/eslint.js', 'src', 'tools/news', 'functions', 'vite.config.ts']],
  ['root-tests', ['node_modules/vitest/vitest.mjs', 'run']],
  ['pipeline', ['--test', ...readdirSync('tools/atlas-build/test').filter(n => n.endsWith('.test.mjs')).map(n => 'tools/atlas-build/test/' + n)]],
]
const results = []
for (const [name, args] of checks) {
  const run = spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, env })
  const log = `${cache}/${name}.log`, text = (run.stdout ?? '') + (run.stderr ?? '') + (run.error ? '\n' + run.error.message : '')
  writeFileSync(log, text)
  const row = { name, status: run.status === 0 ? 'PASS' : 'FAIL', exitCode: run.status, command: ['node', ...args], log, sha256: createHash('sha256').update(text).digest('hex') }
  results.push(row); console.log(JSON.stringify(row))
}
const hash = path => createHash('sha256').update(readFileSync(path)).digest('hex')
const protectedManifest = JSON.parse(readFileSync('docs/release/protected-hashes.json', 'utf8'))
// Owner explicitly authorized coverage code corrections, not recapture of the
// old release commitments. Verify the original commitments from Git instead.
const authorizedCode = ['src/current-affairs/validator-v3/policy.ts', 'src/current-affairs/validator-v3/evidence.ts']
for (const r of protectedManifest.files) {
  if (authorizedCode.includes(r.path)) {
    const original = execFileSync('git', ['show', 'b30ef74cfd3b923940cd5968877452c99ca0bac8:' + r.path])
    assert.equal(createHash('sha256').update(original).digest('hex'), r.sha256, r.path + ' original commitment')
  } else assert.equal(hash(r.path), r.sha256, r.path)
}
results.push({ name: 'preservation', status: 'PASS', frozenUnchanged: protectedManifest.files.length - authorizedCode.length, authorizedRuntimeReplacements: authorizedCode, originalManifestPreserved: true })
writeFileSync('docs/coverage-recovery/VERIFICATION.json', JSON.stringify({ results, environment: 'Local copied existing node_modules, installed Node 24 and Chromium; writable local TEMP/TMP; no downloads', limitations: ['Initial focused Vitest invocation failed with ENOENT in sandbox TEMP; workspace-local TEMP/TMP repaired the environment, no assertion changed.', 'First audit launch occurred before dependency copy completed and failed module resolution; rerun after local copy completed passed.', 'Robocopy exit 1 means files copied, not failure.'], productionReadiness: 'BLOCKED' }, null, 2) + '\n')
if (results.some(r => r.status !== 'PASS')) process.exitCode = 1
