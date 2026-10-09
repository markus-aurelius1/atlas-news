/** Offline protected-file commitments; never writes a sibling checkout. */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
const output = 'docs/release/protected-hashes.json'
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex')
const paths = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(p => p && (
  /^(public\/atlas|public\/pyq-atlas|src\/data\/compatibility|tools\/news\/evaluation\/(calibration-gold-v1|calibration-reviewer-v1|stage-c-v1))/.test(p)
  || ['README.md', 'public/current-affairs/v2/relevance-index.json', 'src/current-affairs/sources.ts', 'src/current-affairs/validator-v3/policy.ts', 'src/current-affairs/validator-v3/evidence.ts', 'src/current-affairs/validator-v3/eligibility.ts', 'src/current-affairs/validator-v3/relevance.ts', 'src/current-affairs/validator-v3/stage-c.ts', 'src/current-affairs/reader/policy.ts'].includes(p)))
if (process.argv.includes('--capture')) {
  writeFileSync(output, JSON.stringify({ parent: 'ec125e3eb80b9eedc64804636955465d9580742d', algorithm: 'sha256', files: paths.map(path => ({ path, sha256: hash(path) })) }, null, 2) + '\n')
} else {
  const manifest = JSON.parse(readFileSync(output, 'utf8'))
  for (const row of manifest.files) assert.equal(hash(row.path), row.sha256, row.path)
  console.log(`${manifest.files.length} protected file hashes match`)
}
