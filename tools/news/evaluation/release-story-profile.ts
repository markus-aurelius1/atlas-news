/** Explicitly synthetic scale/profile fixture, not a production latency claim. */
import { performance } from 'node:perf_hooks'
import { writeFileSync } from 'node:fs'
import { buildStories, type MetadataObservation } from '../../../src/current-affairs/validator-v3/stories.ts'
const now = Date.parse('2026-10-09T12:00:00.000Z')
const rows: MetadataObservation[] = Array.from({ length: 4000 }, (_, i) => ({ item: { title: `RBI changes liquidity framework for case SYN${i}`, url: `https://indianexpress.com/synthetic-${i}`, publisher: 'Indian Express', sourceId: 'ie-explained', section: 'National', description: '', publishedAt: new Date(now).toISOString() }, observedAt: now, firstSeenAt: now }))
const history = Array.from({ length: 3 }, (_, day) => rows.map(o => ({ ...o, observedAt: now - (day + 1) * 86400000, firstSeenAt: now - (day + 1) * 86400000, item: { ...o.item, publishedAt: new Date(now - 4 * 86400000).toISOString() } }))).flat()
const timings: number[] = []; let result
for (let n = 0; n < 5; n++) { const start = performance.now(); result = buildStories(rows, history, [], now); timings.push(performance.now() - start) }
timings.sort((a, b) => a - b)
const report = { label: 'Synthetic local Node scale profiling only; not phone or production performance', current: rows.length, history: history.length, repetitions: timings.length, p50Ms: timings[2], p95Ms: timings[4], comparisons: result!.comparisons, units: result!.units.length, heapSampleBytes: process.memoryUsage().heapUsed, budget: 'Phone responsiveness pending physical-device profiling; no production budget pass claimed' }
writeFileSync('docs/release/story-profile.json', JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify(report))
