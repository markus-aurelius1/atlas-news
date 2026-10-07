import type { Observation, PredictionOutput, ReplayVersions, RunArtifact } from './contracts.ts'
import { digest, instant, ordered, requireThat, unique } from './core.ts'
import { validateObservation, validateOutput, validateRun } from './validate.ts'

export interface ReplayInput { observations: Observation[]; history: Observation[]; clock: string; versions: ReplayVersions }
export type Runner = (input: Readonly<ReplayInput>) => PredictionOutput
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const v of Object.values(value)) freeze(v); Object.freeze(value) }
  return value
}
export function replay(input: ReplayInput, runner: Runner): RunArtifact {
  requireThat(Object.keys(input).every(k => ['observations', 'history', 'clock', 'versions'].includes(k)), 'Runtime cannot receive gold or personal state')
  const cutoff = instant(input.clock), all = [...input.observations, ...input.history]
  all.forEach(validateObservation)
  unique(all, o => o.id, 'runtime observation')
  for (const o of all) {
    requireThat(instant(o.capturedAt) <= cutoff, 'Future observation/history leakage')
    for (const date of [o.metadata.publishedAt, o.metadata.updatedAt]) requireThat(date === null || instant(date) <= cutoff, 'Future publisher revision leakage')
  }
  const sorted = freeze(structuredClone({ ...input, observations: ordered(input.observations), history: ordered(input.history) }))
  const output = runner(sorted)
  validateOutput(output)
  const availableUrls = new Set(all.map(o => o.metadata.url))
  requireThat(output.articles.every(a => availableUrls.has(a.url)), 'Runner invented an unseen article')
  const canonical = { articles: [...output.articles].sort((a, b) => a.url.localeCompare(b.url, 'en')), units: output.units }
  const run: RunArtifact = { version: 'tars-news-run/v1', clock: input.clock, versions: structuredClone(input.versions),
    observationsHash: digest(sorted.observations), historyHash: digest(sorted.history), inputHash: digest(sorted), outputHash: digest(canonical), ...canonical }
  validateRun(run)
  return run
}
/** Build buckets from a longitudinal timeline, then explicitly pass only observations already available. */
export function replaySequence(timeline: Observation[], clocks: string[], versions: ReplayVersions, runner: Runner): RunArtifact[] {
  timeline.forEach(validateObservation); unique(timeline, o => o.id, 'timeline observation')
  const times = clocks.map(instant)
  requireThat(times.every((t, i) => i === 0 || t > times[i - 1]), 'Sequence clocks must strictly increase')
  return clocks.map((clock, i) => {
    const current = timeline.filter(o => instant(o.capturedAt) <= times[i] && (i === 0 || instant(o.capturedAt) > times[i - 1]))
    const history = i === 0 ? [] : timeline.filter(o => instant(o.capturedAt) <= times[i - 1])
    return replay({ observations: current, history, clock, versions }, runner)
  })
}
/** Operational measurements stay outside deterministic prediction digests. No device claims implied. */
export function benchmarkReplay(input:ReplayInput,runner:Runner,repetitions=10){
  requireThat(Number.isInteger(repetitions)&&repetitions>=2&&repetitions<=100,'Benchmark repetitions must be 2..100')
  const durations:number[]=[],heap:number[]=[];let outputHash:string|null=null
  for(let i=0;i<repetitions;i++){
    const start=performance.now(),run=replay(input,runner)
    durations.push(performance.now()-start);heap.push(process.memoryUsage().heapUsed)
    requireThat(outputHash===null||outputHash===run.outputHash,'Runner failed repeated replay determinism')
    outputHash=run.outputHash
  }
  durations.sort((a,b)=>a-b)
  return {repetitions,p50Ms:durations[Math.floor((repetitions-1)*0.5)],p95Ms:durations[Math.ceil((repetitions-1)*0.95)],sampledPeakHeapBytes:Math.max(...heap),outputHash,note:'Node host measurements including validation; sampled heap is not process peak or browser/device evidence.'}
}
