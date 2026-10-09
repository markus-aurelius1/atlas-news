/** Local-only release checks; explicit exit status, no installs or remote jobs. */
import { spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs'
const cache = 'tools/news/.cache/release'
mkdirSync(cache, { recursive: true })
const checks = [
  ['typecheck', ['node_modules/typescript/bin/tsc', '-b']],
  ['lint', ['node_modules/eslint/bin/eslint.js', 'src', 'tools/news', 'functions', 'vite.config.ts']],
  ['root-tests', ['node_modules/vitest/vitest.mjs', 'run']],
  ['pipeline', ['--test', ...readdirSync('tools/atlas-build/test').filter(n => n.endsWith('.test.mjs')).map(n => 'tools/atlas-build/test/' + n)]],
  ['evaluation', ['--test', ...readdirSync('tools/news/evaluation').filter(n => /\.test\.(ts|mjs)$/.test(n)).map(n => 'tools/news/evaluation/' + n)]],
  ['protected-integrity', ['tools/news/evaluation/release-integrity.mjs']],
]
const results = []
for (const [name, args] of checks) {
  const started = Date.now(), run = spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  const log = `${cache}/final-${name}.log`
  writeFileSync(log, (run.stdout ?? '') + (run.stderr ?? '') + (run.error ? '\n' + run.error.message : ''))
  const row = { name, command: ['node', ...args], status: run.status === 0 ? 'PASS' : 'FAIL', exitCode: run.status, elapsedMs: Date.now() - started, log }
  results.push(row); console.log(JSON.stringify(row))
}
writeFileSync('docs/release/local-checks.json', JSON.stringify({ label: 'Local engineering checks; not production quality or hosted certification', results }, null, 2) + '\n')
if (results.some(r => r.status !== 'PASS')) process.exitCode = 1
