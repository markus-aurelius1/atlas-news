/** Natural owner calibration regressions; no IDs or labels enter runtime. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { diagnose, metrics } from './stage-c-report.mjs'
import { runStageC } from './stage-c-runner.ts'
import { digest } from './core.ts'
const {report,prediction,observations}=diagnose()
test('all 50 evaluated; 47 resolved and three explicit unresolvable abstentions',()=>{
 assert.equal(report.rows.length,50);assert.equal(report.metrics.resolved,47);assert.equal(report.metrics.unresolvable,3)
 for(const n of [3,23,36])assert.equal(report.rows[n-1].decision,'deferred')
 assert.equal(report.metrics.tp+report.metrics.fn,31);assert.equal(report.metrics.fp+report.metrics.tn,16)
})
test('recover well-evidenced v2 misses and preserve every baseline positive',()=>{
 for(const r of report.rows.filter(r=>r.result==='TP'))assert.ok(r.accepted,'Baseline positive #'+r.number)
 for(const n of [5,8,9,11,12,13,17,21,27,28,30,35,39,50])assert.ok(report.rows[n-1].accepted,'Target #'+n)
})
test('all 16 hard negative controls stay rejected; memorial FP fixed',()=>{
 for(const r of report.rows.filter(r=>r.value==='reject'))assert.equal(r.decision,'rejected','#'+r.number)
 assert.ok(report.rows[21].eligibilityReasons.includes('C1.ceremonial_low_value.v1'))
})
test('opaque resolved positives remain misses, never omitted or author-accepted',()=>{
 assert.deepEqual(report.falseNegatives,[6,34,43]);assert.deepEqual(report.falsePositives,[])
 for(const n of [6,34,43]){const r=report.rows[n-1];assert.equal(r.decision,'deferred');assert.ok(r.explanation.length>50)}
 assert.equal(report.protected.requestedAuthors.recall.denominator,8)
 assert.equal(report.protected.requestedAuthors.recall.numerator,6)
 assert.equal(report.byOrigin.owner_id.resolved,45);assert.equal(report.byOrigin.model_origin_owner_validated.resolved,2)
})
test('trace spans resolve to exact observations and all decisions explain themselves',()=>{
 const lookup=new Map(observations.map(o=>[o.id,o]))
 for(const p of prediction.details.articles){assert.ok(p.eligibility.reasonCodes.length);assert.ok(p.relevance.reasonCodes.length)
  if(p.accepted)assert.ok(p.eligibility.evidence.length)
  for(const e of [...p.eligibility.evidence,...p.relevance.evidence]){const o=lookup.get(e.observationId);assert.ok(o);const value=e.path.split('.').reduce((x,key)=>x[key],o.metadata);assert.equal(value.slice(e.start,e.end),e.text);assert.ok(e.end>e.start)}
 }
})
test('input reordering, repeated replay and no mutable labels/history',()=>{
 assert.deepEqual(runStageC([...observations].reverse(),report.clock),prediction)
 const bad=structuredClone(observations);Object.assign(bad[0].metadata,{gold:{value:'must_read'}})
 assert.throws(()=>runStageC(bad,report.clock))
 const future=structuredClone(observations);future[0].capturedAt='2027-01-01T00:00:00.000Z';assert.throws(()=>runStageC(future,report.clock))
 const tampered=structuredClone(observations);tampered[0].metadata.title+=' extra';assert.throws(()=>runStageC(tampered,report.clock),/hash mismatch/)
})
test('frozen v2 core remains independent and frozen Stage C output contains no D/E/F decisions',()=>{
 for(const path of ['src/current-affairs/relevance.ts','src/current-affairs/cluster.ts'])assert.ok(!readFileSync(path,'utf8').includes('stage-c'))
 assert.ok(prediction.run.articles.every(a=>a.primarySubject===null&&a.eventId===null&&a.themeId===null&&a.angleId===null&&a.novelty==='not_applicable'));assert.deepEqual(prediction.run.units,[])
})
test('metrics explicitly count deferred positives and preserve zero denominators',()=>{
 const rows=[{value:'must_read',disposition:'resolved',accepted:false,decision:'deferred'},{value:null,disposition:'unresolvable',accepted:false,decision:'deferred'}]
 const m=metrics(rows);assert.equal(m.fn,1);assert.equal(m.resolved,1);assert.equal(m.unresolvable,1);assert.equal(m.precision.value,null);assert.equal(m.recall.value,0);assert.equal(m.mustRead.denominator,1)
 assert.equal(digest(prediction.details),prediction.detailsHash)
})
