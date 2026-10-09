/** One bounded public RSS wave or read-only temporal report; no cloud APIs. */
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { NEWS_SOURCES } from '../../../src/current-affairs/sources.ts'
import { collectShard } from './collect.ts'
import { evaluateReading } from '../../../src/current-affairs/validator-v3/orchestrator.ts'
import { stageCVersions } from './stage-c-runner.ts'
import { digest } from './core.ts'
import { validateRaw } from './validate.ts'
import type { MetadataObservation, SelectedReading } from '../../../src/current-affairs/validator-v3/stories.ts'
import type { StageCObservation } from '../../../src/current-affairs/validator-v3/contracts.ts'
const ids = ['ie-governance','ie-economy','ie-columns','ie-explained','hindu-columns','hindu-op-ed']
const registry = ids.map(id => NEWS_SOURCES.find(s => s.id === id)!)
assert(registry.every(Boolean))
const read = (p: string) => JSON.parse(readFileSync(p,'utf8'))
const root = 'docs/release-candidate', mode = process.argv[2]
if (mode === 'capture') {
  const output = process.argv[3]
  assert(output?.startsWith(root + '/') || output?.startsWith('tools/news/.cache/release-candidate/'), 'Confine capture to candidate evidence/cache')
  assert(!existsSync(output), 'Never overwrite a real capture')
  // Exactly the six existing RSS URLs, one <=15s wave, <=10s/source,
  // <=4MB response/source, no redirects, cookies, retries or body fetches.
  const run = await collectShard({ captureId: 'tars-rc-rss:' + new Date().toISOString(), shardIndex: 0, clock: () => new Date().toISOString(), registry })
  writeFileSync(output,JSON.stringify(run,null,2)+'\n')
  console.log(JSON.stringify(run.sources.map(s=>({id:s.sourceId,status:s.status,http:s.httpStatus,failure:s.failure,count:s.countAfter}))))
} else if (mode === 'report') {
  const source = read('tools/news/evaluation/calibration-gold-v1/provenance.json').sourcePackage
  const observations = read(source + '/observations.json')
  const historicalClock = read(source + '/versions.json').clock
  const freshPath = root + '/rss-bounded-2026-10-09.json'
  const fresh = existsSync(freshPath) ? read(freshPath) : null
  const summarize = (rows: typeof observations, clock: string) => {
    const latest = new Map<string, typeof observations[number]>()
    for(const o of rows)latest.set(o.metadata.url,o)
    const values = [...latest.values()],dates = values.map(o=>o.metadata.publishedAt).filter(Boolean).sort()
    return { uniqueUrls:values.length,newest:dates.at(-1)??null,missingDescriptions:values.filter(o=>!o.metadata.description).length,recent24h:values.filter(o=>o.metadata.publishedAt&&Date.parse(o.metadata.publishedAt)<=Date.parse(clock)&&Date.parse(o.metadata.publishedAt)>=Date.parse(clock)-86400000).length }
  }
  const result = { scope:'Historical figures use the enriched 1,000 sample, not full publisher supply. Captured RSS metadata only. Failed probes are unavailable source evidence, never zero relevant supply.',historicalClock,liveClock:fresh?.capturedAt??null,liveCapture:freshPath,sources:registry.map(s=>{const probe=fresh?.sources.find((r:{sourceId:string})=>r.sourceId===s.id);return {id:s.id,feedUrl:s.feedUrl,historical:summarize(observations.filter((o:typeof observations[number])=>o.sourceId===s.id),historicalClock),live:probe?{status:probe.status,httpStatus:probe.httpStatus,failure:probe.failure,capturedAt:probe.capturedAt,countBefore:probe.countBefore,countAfter:probe.countAfter,invalidEntries:probe.invalidEntries,truncatedEntries:probe.truncatedEntries,...summarize(probe.observations,probe.capturedAt)}:null}}),temporalGate:'BLOCKED: one historical day and one bounded wave do not establish consecutive-day editorial or production health',paidServices:false,remoteCloudOperations:false }
  mkdirSync(root,{recursive:true});writeFileSync(root+'/acquisition.json',JSON.stringify(result,null,2)+'\n')
  console.log(JSON.stringify(result.sources.map(s=>({id:s.id,historical:s.historical,liveStatus:s.live?.status}))))
} else if (mode === 'temporal') {
  const paths=process.argv.slice(3); assert(paths.length>=2,'Supply at least two preserved real captures'); assert.equal(new Set(paths).size,paths.length,'Duplicate capture paths cannot supply temporal evidence')
  const captures=paths.map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex'),capture:read(path)})).sort((a,b)=>a.capture.capturedAt.localeCompare(b.capture.capturedAt))
  for (const c of captures) {
    const capturedRegistry = [NEWS_SOURCES, registry].find(r => digest(r) === c.capture.registryHash)
    assert(capturedRegistry, 'Capture registry must match the existing full registry or the documented six-source slice')
    validateRaw(c.capture, capturedRegistry)
  }
  const days=[...new Set(captures.map(r=>r.capture.capturedAt.slice(0,10)))]
  const consecutive=days.every((d,i)=>i===0||Date.parse(d)-Date.parse(days[i-1])===86400000)
  let history:MetadataObservation[]=[],selected:SelectedReading[]=[]
  const pinnedVersions = stageCVersions(digest(NEWS_SOURCES))
  // Source-code/index commitments remain pinned to the full installed registry.
  // Raw observations retain their actual allowlisted capture-slice hash.
  const replay=captures.map(c=>{const observations:StageCObservation[]=c.capture.sources.flatMap((s:{observations:StageCObservation[]})=>s.observations);const run=evaluateReading({observations,clock:c.capture.capturedAt,versions:{...pinnedVersions,registryHash:c.capture.registryHash}},history,selected);history=run.stories.history;selected=run.selection.retained;return {path:c.path,clock:c.capture.capturedAt,accepted:run.c.articles.filter(a=>a.accepted).length,today:run.selection.today.map(r=>({id:r.unit.id,title:r.primary.item.title,url:r.primary.item.url,novelty:r.unit.novelty})),suppressed:run.selection.suppressed,selectedHistoryCount:selected.length}})
  console.log(JSON.stringify({days,consecutive,observedDays:days.length,continuousHealthCertified:false,paths:captures.map(c=>({path:c.path,sha256:c.sha256,clock:c.capture.capturedAt,sourceHealth:c.capture.sources.map((s:{sourceId:string;status:string})=>({id:s.sourceId,status:s.status}))})),replay,qualityGate:'Requires real source-health reconciliation and owner sequence judgments; no automatic release pass'},null,2))
} else throw Error('Use capture NEW_OUTPUT, report, or temporal REAL_CAPTURE...; never schedule this tool')
