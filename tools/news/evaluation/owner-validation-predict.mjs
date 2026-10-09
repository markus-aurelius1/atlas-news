/** Offline blind C/D/E/F runner. Receives observations only, never annotations. */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { evaluateReading } from '../../../src/current-affairs/validator-v3/orchestrator.ts'
import { stageCVersions } from './stage-c-runner.ts'
import { digest } from './core.ts'
const [input, clock, output] = process.argv.slice(2)
assert(!existsSync(output), 'Blind output already exists; use a new path')
const observations = JSON.parse(readFileSync(input, 'utf8'))
const versions = stageCVersions(observations[0].registryHash)
const run = evaluateReading({ observations, clock, versions }, [], [])
assert.deepEqual(evaluateReading({ observations: [...observations].reverse(), clock, versions }, [], []), run)
writeFileSync(output, JSON.stringify({ outputHash: digest(run), reverseOrderEqual: true, run }, null, 2) + '\n')
console.log(JSON.stringify({ output, articles: run.articles.length, outputHash: digest(run) }))
