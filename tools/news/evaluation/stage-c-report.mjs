/** Generates development diagnostics only. Labels are joined after metadata-only prediction. */
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
import { runStageC, byteHash, STAGE_C_FILES } from './stage-c-runner.ts'
import { freezeV2 } from './frozen-v2.ts'
import { digest } from './core.ts'
import { verifyInventory } from './calibration-gold.mjs'
const directory='tools/news/evaluation/calibration-gold-v1'
const read=p=>JSON.parse(readFileSync(p,'utf8'))
const esc=v=>String(v??'').replaceAll('|','\\|').replaceAll('\n',' ')
const rate=(n,d)=>({numerator:n,denominator:d,value:d?n/d:null})
export function metrics(rows) {
  const resolved=rows.filter(r=>r.disposition==='resolved')
  const tp=resolved.filter(r=>r.value!=='reject'&&r.accepted).length, fp=resolved.filter(r=>r.value==='reject'&&r.accepted).length
  const fn=resolved.filter(r=>r.value!=='reject'&&!r.accepted).length, tn=resolved.filter(r=>r.value==='reject'&&!r.accepted).length
  const must=resolved.filter(r=>r.value==='must_read')
  return {total:rows.length,resolved:resolved.length,unresolvable:rows.length-resolved.length,tp,fp,fn,tn,precision:rate(tp,tp+fp),recall:rate(tp,tp+fn),f1:rate(2*tp,2*tp+fp+fn),mustRead:rate(must.filter(r=>r.accepted).length,must.length),abstentions:rows.filter(r=>r.decision==='deferred').length,resolvedAbstentions:resolved.filter(r=>r.decision==='deferred').length}
}
const slices=(rows,key)=>Object.fromEntries([...new Set(rows.map(key))].sort().map(k=>[k,metrics(rows.filter(r=>key(r)===k))]))
const ceiling={6:'Missing summary; historical metaphor and regional contest do not establish the strategic argument or mechanism. Verified byline/column context is retained but cannot supply the absent thesis.',34:'Missing summary; power/virtue rhetoric and America/Graham Bill reference do not establish the bill content, foreign-policy mechanism or argument. No URL-slug, author-topic or prestige inference.',43:'Missing summary; economics/psychology identifies an interdisciplinary area but no behavioural mechanism, finding, application or thesis. Topic presence alone cannot clear substance.'}
export function diagnose() {
  verifyInventory(directory)
  const observations=read(join(directory,'observations.json')), gold=read(join(directory,'gold.json')), baseline=read(join(directory,'comparison.json')), provenance=read(join(directory,'provenance.json'))
  const frozen=read(join(provenance.sourcePackage,'frozen-v2/predictions.json'))
  const clock=frozen.clock
  // No label-bearing object is passed to either runner.
  const prediction=runStageC(observations,clock), repeated=runStageC(observations,clock), reverse=runStageC([...observations].reverse(),clock)
  assert.deepEqual(repeated,prediction);assert.deepEqual(reverse,prediction)
  const rows=gold.records.map((g,i)=>{
    const b=baseline.rows.find(r=>r.id===g.id),p=prediction.details.articles.find(p=>p.url===g.record.metadata.url)
    assert.ok(p&&b)
    const result=g.disposition==='unresolvable'?'excluded_unresolvable':b.value!=='reject'?(p.accepted?'TP':'FN'):(p.accepted?'FP':'TN')
    const explanation=ceiling[b.number]??(p.decision==='deferred'?'No sufficient topical, substantive and scope route; missing evidence remains explicit.':p.accepted?'Accepted via '+p.relevance.reasonCodes.join(', ')+' with exact observed spans; author/source priors cannot clear the floor.':'Rejected by '+p.eligibility.reasonCodes.join(', ')+'; substantive terms or prior evidence cannot override the hard gate.')
    return {...b,accepted:p.accepted,decision:p.decision,stageCResult:result,stageCTier:p.relevance.status,stageCConfidence:p.relevance.confidence,stageCCoverage:p.metadataSufficiency,verifiedAuthors:p.verifiedAuthors,eligibilityReasons:p.eligibility.reasonCodes,relevanceReasons:p.relevance.reasonCodes,explanation}
  })
  const report={version:'tars-stage-c-calibration/v1',label:baseline.label,parentCommit:'349c86c4a57eaeb8f0d7f1928fdac61505e7479f',clock,
    limits:baseline.limits.concat(['Finite contextual rules are conservative coverage, not general semantic understanding. No unseen-gold performance claim.','Three resolved positives remain deferred and count as false negatives. Metadata-ceiling diagnoses are implementation judgments, not relabeling.','Candidate tiers are conservative policy signals; acceptance recall is not must-read tier accuracy. No subject classification, novelty, ranking or selection metrics.','Index is provenance-pinned but not used for recurrence scoring; mixed CSE/UPPCS frequencies cannot enter UPSC-only Stage C.']),
    baseline:baseline.metrics,baselineMustRead:baseline.mustRead,metrics:metrics(rows),
    byValue:slices(rows,r=>r.value??'unresolvable'),byPublisher:slices(rows,r=>r.publisher),byAuthor:slices(rows,r=>r.bylines.map(b=>b.name).sort().join(' + ')||'(missing)'),byContentType:slices(rows,r=>r.contentType??'unknown'),byScope:slices(rows,r=>r.scope??'unknown'),byMetadataSufficiency:slices(rows,r=>r.metadataSufficiency?.level??'unknown'),byDescription:slices(rows,r=>r.descriptionMissing?'missing':'present'),byPoliticalNoise:slices(rows,r=>String(r.partyPrimary)),byGoldPrimary:slices(rows,r=>r.goldPrimary??'unknown'),byOrigin:slices(rows,r=>r.origin),byPartition:slices(rows,r=>r.partition),
    protected:{requestedAuthors:metrics(rows.filter(r=>r.verifiedAuthors.length)),editorials:metrics(rows.filter(r=>r.contentType==='editorial')),columns:metrics(rows.filter(r=>r.contentType==='column')),analysis:metrics(rows.filter(r=>r.contentType==='analysis')),explained:metrics(rows.filter(r=>r.contentType==='explainer')),Science:metrics(rows.filter(r=>r.goldPrimary==='Sci-Tech')),IR:metrics(rows.filter(r=>r.goldPrimary==='International relations')),Security:metrics(rows.filter(r=>r.goldPrimary==='Security')),institutional:metrics(rows.filter(r=>r.goldPrimary==='Polity'||r.goldPrimary==='Governance')),UPSCFeed:metrics(rows.filter(r=>r.sections.some(s=>/UPSC/i.test(s))))},
    tierByGold:slices(rows,r=>(r.value??'unresolvable')+' / '+r.stageCTier),
    falseNegatives:rows.filter(r=>r.stageCResult==='FN').map(r=>r.number),falsePositives:rows.filter(r=>r.stageCResult==='FP').map(r=>r.number),unresolvable:rows.filter(r=>r.disposition==='unresolvable').map(r=>r.number),recoveredBaselineMisses:rows.filter(r=>r.result==='FN'&&r.accepted).map(r=>r.number),
    reproducibility:{inputHash:prediction.run.inputHash,outputHash:prediction.run.outputHash,detailsHash:prediction.detailsHash,repeatExact:true,reverseExact:true,versions:prediction.details.versions},rows}
  return {report,prediction,observations,provenance,frozen}
}
export function generateStageC(output='tools/news/evaluation/stage-c-v1') {
  const {report,prediction,observations,provenance,frozen}=diagnose()
  const protectedFiles=provenance.protectedFiles.map(f=>{assert.equal(byteHash(join(provenance.sourcePackage,f.path)),f.sha256);return f})
  // Reuse only the original exposed bootstrap observations. No future holdout discovery or read.
  const sourceObservations=read(join(provenance.sourcePackage,'observations.json'))
  const all=frozen.traces.map(t=>{const o=sourceObservations.find(o=>o.id===t.observationId);assert.ok(o);assert.equal(o.metadataHash,t.metadataHash);return o})
  const v2=freezeV2(all,frozen.clock,frozen.baseCommit),v2Reverse=freezeV2([...all].reverse(),frozen.clock,frozen.baseCommit)
  assert.equal(v2.run.outputHash,frozen.run.outputHash);assert.deepEqual(v2.run.articles,frozen.run.articles);assert.deepEqual(v2.traces,frozen.traces);assert.deepEqual(v2Reverse.traces,frozen.traces)
  const durations=[],heaps=[]
  for(let i=0;i<20;i++){const start=performance.now();const run=runStageC(observations,report.clock);durations.push(performance.now()-start);heaps.push(process.memoryUsage().heapUsed);assert.equal(run.detailsHash,prediction.detailsHash)}
  durations.sort((a,b)=>a-b)
  const verification={version:'tars-stage-c-reproducibility/v1',node:process.version,platform:process.platform,arch:process.arch,repetitions:20,observationCount:observations.length,articleCount:report.rows.length,p50Ms:durations[9],p95Ms:durations[18],sampledPeakHeapBytes:Math.max(...heaps),note:'Node host samples including hashing, schema validation and replay; sampled heap is not process peak, device latency or production evidence.',frozenV2:{articles:v2.run.articles.length,exactPredictions:true,exactTraces:true,reverseExact:true,outputHash:frozen.run.outputHash},goldInventoryFiles:verifyInventory(directory),protectedSourceFiles:protectedFiles,codeFiles:STAGE_C_FILES.map(path=>({path,sha256:byteHash(path)})),sealedHoldoutOpened:false}
  mkdirSync(output,{recursive:true})
  const write=(name,value)=>writeFileSync(join(output,name),JSON.stringify(value,null,2)+'\n')
  write('comparison.json',report);write('predictions.json',prediction);write('reproducibility.json',verification)
  const m=report.metrics
  const table=(title,groups)=>['## '+title,'','| Slice | Resolved / total | TP | FP | FN | TN | Positive retention | Abstentions |','| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',...Object.entries(groups).map(([k,v])=>`| ${esc(k)} | ${v.resolved}/${v.total} | ${v.tp} | ${v.fp} | ${v.fn} | ${v.tn} | ${v.recall.numerator}/${v.recall.denominator} | ${v.abstentions} |`),'']
  writeFileSync(join(output,'COMPARISON.md'),['# Stage C versus frozen v2','',report.label,'','| Measure | Frozen v2 | Stage C |','| --- | ---: | ---: |',`| TP / FP / FN / TN | 14 / 1 / 17 / 15 | ${m.tp} / ${m.fp} / ${m.fn} / ${m.tn} |`,`| Precision | 14/15 (93.33%) | ${m.precision.numerator}/${m.precision.denominator} (${(100*m.precision.value).toFixed(2)}%) |`,`| Recall | 14/31 (45.16%) | ${m.recall.numerator}/${m.recall.denominator} (${(100*m.recall.value).toFixed(2)}%) |`,`| Must-read acceptance | 11/17 | ${m.mustRead.numerator}/${m.mustRead.denominator} |`,`| Unresolvable excluded | 3 | ${m.unresolvable} |`,`| Resolved abstentions (counted as misses) | 0 | ${m.resolvedAbstentions} |`,'','Recovered baseline misses: '+report.recoveredBaselineMisses.map(n=>'#'+n).join(', ')+'. Remaining false negatives: '+report.falseNegatives.map(n=>'#'+n).join(', ')+'. Introduced false positives: '+(report.falsePositives.join(', ')||'none')+'.','',...table('Protected slices',report.protected),...table('Must read / Useful / Reject',report.byValue),...table('Authorship sensitivity',report.byOrigin),...table('Publisher',report.byPublisher),...table('Captured author',report.byAuthor),...table('Owner content type (acceptance, not prediction accuracy)',report.byContentType),...table('Owner scope',report.byScope),...table('Owner metadata sufficiency',report.byMetadataSufficiency),...table('Missing descriptions',report.byDescription),...table('Political noise',report.byPoliticalNoise),...table('Gold primary (diagnostic only; Stage D independent)',report.byGoldPrimary),...table('Original partitions (both exposed calibration)',report.byPartition),'## Limits','',...report.limits.map(s=>'- '+s),''].join('\n'))
  writeFileSync(join(output,'CASE_ANALYSIS.md'),['# Complete 50-case Stage C analysis','','All false negatives, false positives, recovered baseline misses, protected positives and three unresolvable cases are included. Exact evidence spans and dimensions are in predictions.json. Gold remains immutable.','','| # | Title | Gold | v2 | C | Explanation |','| ---: | --- | --- | --- | --- | --- |',...report.rows.map(r=>`| ${r.number} | ${esc(r.title)} | ${r.value??'unresolvable'} | ${r.result} | ${r.stageCResult} (${r.decision}) | ${esc(r.explanation)} |`),'','## Metadata ceiling and acquisition handoff','',''+report.rows.filter(r=>report.falseNegatives.includes(r.number)).map(r=>'#'+r.number+': '+r.explanation).join('\n\n'),'','All three unresolved owner cases (#3, #23, #36) explicitly defer. #3 has a nonempty two-word placeholder, demonstrating why field presence alone is insufficient. Recover permitted feed summaries/bylines only through separately authorized acquisition work; do not fetch article bodies, use URL slugs as hidden summaries or change owner labels. Finite rule coverage can also cause misses; these diagnoses do not prove absent metadata is the only possible cause.',''].join('\n'))
  return {metrics:m,misses:report.falseNegatives,protected:report.protected,performance:{p50Ms:verification.p50Ms,p95Ms:verification.p95Ms},detailsHash:prediction.detailsHash}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)console.log(JSON.stringify(generateStageC(),null,2))
