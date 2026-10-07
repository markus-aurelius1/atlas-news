/** Synthetic contract arithmetic only. No generated human labels enter any natural corpus. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync,writeFileSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NEWS_SOURCES } from '../../../src/current-affairs/sources.ts'
import { digest } from './core.ts'
import { PARSER_VERSION,REGISTRY_HASH } from './collect.ts'
import { observationId } from './validate.ts'
import { bootstrapCorpus } from './bootstrap.ts'
import type { Observation,ReplayVersions,GoldRecord } from './contracts.ts'
import { EDITORIAL_POLICY } from './editorial-policy.ts'
import { replayEditorial,replayEditorialSequence } from './editorial-replay.ts'
import type { EditorialOutput,EditorialInput } from './editorial-replay.ts'
import { EMPTY_EDITORIAL_LABELS,validateEditorialJudgment } from './editorial-judgments.ts'
import type { EditorialJudgment,EditorialLabels } from './editorial-judgments.ts'
import { editorialSelectionMetrics,readingNeedIdentity } from './editorial-metrics.ts'
import { temporalPackage } from './temporal-package.ts'
import { ownerExemplars,exemplarDiagnostics } from './owner-exemplars.ts'
import { replay } from './replay.ts'
const CLOCK='2026-10-07T13:00:00.000Z',EARLIER='2026-10-06T13:00:00.000Z'
const versions:ReplayVersions={policyId:'synthetic',policyHash:digest('p'),indexHash:digest('i'),registryHash:REGISTRY_HASH,codeHash:digest('c')}
function obs(id:string,capturedAt=CLOCK,publisher='Indian Express',title='Constitutional judgment fixture '+id):Observation {
  const s=NEWS_SOURCES.find(s=>s.publisher===publisher)??NEWS_SOURCES[0]
  const metadata={url:'https://example.test/'+id,title,description:'Bounded synthetic metadata',publisher,memberships:[{sourceId:s.id,feedUrl:s.feedUrl,section:s.section}],categories:[],bylines:[],publishedAt:EARLIER,updatedAt:null}
  const b={captureId:'synthetic-editorial',sourceId:s.id,ordinal:0,capturedAt,parserVersion:PARSER_VERSION,registryHash:REGISTRY_HASH,metadataHash:digest(metadata),metadata};return {...b,id:observationId(b)}
}
function output(rows:Observation[],clock=CLOCK):EditorialOutput {
  return {version:'tars-editorial-output/v1',clock,candidates:rows.map(o=>({url:o.metadata.url,state:'selected_reading_unit',readingNeedId:'need:'+o.metadata.url,reasonCodes:['synthetic']})),readingUnits:rows.map(o=>({id:'unit:'+o.metadata.url,readingNeedId:'need:'+o.metadata.url,developmentId:'dev:'+o.metadata.url,themeId:null,kind:'development',representativeUrl:o.metadata.url,observationIds:[o.id],firstSelectedAt:clock,updatedAt:clock})),todayUnitIds:rows.map(o=>'unit:'+o.metadata.url),archiveUnitIds:[],replacements:[]}
}
function input(rows:Observation[],clock=CLOCK,priorSelections:EditorialOutput[]=[]):EditorialInput {return {observations:rows,history:[],clock,versions,memory:{historyDays:14,strongRepeatComparisonDays:7},priorSelections}}
function judgment(o:Observation,kind:EditorialJudgment['kind']='reading_need',labels:Partial<EditorialLabels>={}):EditorialJudgment {
  const gold:EditorialLabels={...structuredClone(EMPTY_EDITORIAL_LABELS),priority:'useful',disposition:'selected_reading_unit',readingNeedId:'need:'+o.metadata.url,developmentId:'dev:'+o.metadata.url,rationale:'Synthetic test premise',metadataSufficiency:{level:'sufficient',missingFields:[]},...labels}
  return {version:'tars-editorial-judgment/v1',id:'synthetic:'+o.id,kind,partition:'development',clock:CLOCK,articleUrls:[o.metadata.url],observationIds:[o.id],historyObservationIds:[],review:{status:'adjudicated',annotations:[{reviewerId:'synthetic-reviewer',reviewedAt:CLOCK,rubricVersion:'synthetic',labels:structuredClone(gold),evidence:[{observationId:o.id,field:'title',start:0,end:3}]}],adjudicatorId:'synthetic-reviewer'},gold}
}
function records(rows:Observation[]):GoldRecord[] {const r=bootstrapCorpus(rows,'synthetic-metrics',rows.length).corpus;for(const x of r){x.review.status='adjudicated';x.gold={...x.gold,value:'useful',storyId:'dev:'+x.metadata.url,contentType:'news_report'}}return r}
function run(rows:Observation[],urls=rows.map(o=>o.metadata.url)){return replay({observations:rows,history:[],clock:CLOCK,versions},()=>({articles:rows.map(o=>({url:o.metadata.url,decision:'accepted' as const,primarySubject:null,eventId:null,themeId:null,angleId:null,novelty:'uncertain' as const})),units:urls.map(url=>({id:'synthetic:'+url,primaryUrl:url,memberUrls:[url]}))}))}
test('50 is a ceiling: a 22-unit list is valid, 51 units fail, no fill target or P100',()=>{
  const rows=Array.from({length:51},(_,i)=>obs(String(i)))
  assert.equal(replayEditorial(input(rows.slice(0,22)),()=>output(rows.slice(0,22))).output.todayUnitIds.length,22)
  assert.throws(()=>replayEditorial(input(rows),()=>output(rows)),/schema|50/i)
  assert.deepEqual(EDITORIAL_POLICY.precisionCutoffs,[20,50]);assert.equal(EDITORIAL_POLICY.fillTarget,null)
})
test('rejected and internal duplicates cannot enter Today/Archive; Archive refuses unselected historical leftovers',()=>{
  const o=obs('states'),base=output([o])
  for(const state of ['rejected','qualified_duplicate_internal','qualified_unselected_internal'] as const){const p=structuredClone(base);p.candidates[0].state=state;assert.throws(()=>replayEditorial(input([o]),()=>p),/selected|Archive/)}
  const archive=structuredClone(base);archive.todayUnitIds=[];archive.archiveUnitIds=[archive.readingUnits[0].id];archive.readingUnits[0].firstSelectedAt=EARLIER
  assert.throws(()=>replayEditorial(input([o]),()=>archive),/Archive/)
  const prior=output([o],EARLIER);archive.readingUnits[0].updatedAt=EARLIER
  assert.ok(replayEditorial(input([o],CLOCK,[prior]),()=>archive))
})
test('replacement keeps stable need/development, both observed URLs and prior provenance; new development is not replacement',()=>{
  const old=obs('breaking',EARLIER),better=obs('explainer'),prior=output([old],EARLIER),now=output([better]),u=now.readingUnits[0],p=prior.readingUnits[0]
  Object.assign(u,{id:p.id,readingNeedId:p.readingNeedId,developmentId:p.developmentId,firstSelectedAt:p.firstSelectedAt,observationIds:[old.id,better.id]})
  now.todayUnitIds=[u.id];now.candidates[0].readingNeedId=u.readingNeedId
  now.replacements=[{unitId:u.id,readingNeedId:u.readingNeedId,developmentId:u.developmentId,fromUrl:old.metadata.url,toUrl:better.metadata.url,at:CLOCK,reasonCodes:['synthetic-material-quality-improvement'],evidence:[{observationId:better.id,field:'description',start:0,end:5}]}]
  assert.ok(replayEditorial(input([old,better],CLOCK,[prior]),()=>now))
  const changed=structuredClone(now);changed.readingUnits[0].developmentId='genuinely-new';assert.throws(()=>replayEditorial(input([old,better],CLOCK,[prior]),()=>changed),/identity/)
  const dropped=structuredClone(now);dropped.readingUnits[0].observationIds=[better.id];assert.throws(()=>replayEditorial(input([old,better],CLOCK,[prior]),()=>dropped),/provenance/)
})
test('sequence availability uses capture time; historical publication is not backdated; selected memory does not reset after seven days',()=>{
  const first='2026-09-20T13:00:00.000Z',late='2026-10-07T13:00:00.000Z',a=obs('old',first),b=obs('backfill',late)
  a.metadata.publishedAt=null;a.metadataHash=digest(a.metadata);a.id=observationId(a)
  const seen:Readonly<EditorialInput>[]=[]
  replayEditorialSequence([b,a],[first,late],versions,i=>{seen.push(i);if(i.clock===first)return output(i.observations,first);const previous=structuredClone(i.priorSelections[0]);previous.clock=late;previous.todayUnitIds=[];previous.archiveUnitIds=previous.readingUnits.map(u=>u.id);previous.candidates=[];return previous})
  assert.deepEqual(seen[0].observations.map(o=>o.id),[a.id]);assert.equal(seen[1].history.length,0);assert.equal(seen[1].priorSelections[0].readingUnits.length,1)
  assert.equal(seen[1].memory.historyDays,14);assert.equal(seen[1].memory.strongRepeatComparisonDays,7)
  assert.throws(()=>replayEditorial({...input([a],first),observations:[b]},()=>output([])),/Future/)
  assert.throws(()=>replayEditorial({...input([],late),history:[a]},()=>output([])),/window/)
})
test('closed schemas reject body, predictions and fabricated reviewer answers; primary human policy is explicit',()=>{
  const o=obs('review'),j=judgment(o)
  validateEditorialJudgment(j,[o],'bootstrap_primary_human');assert.throws(()=>validateEditorialJudgment(j,[o]),/human adjudication/)
  assert.throws(()=>validateEditorialJudgment({...j,expectedAnswer:'useful'} as EditorialJudgment,[o]),/schema/i)
  const pending=structuredClone(j);pending.review={status:'unreviewed',annotations:[],adjudicatorId:null};assert.throws(()=>validateEditorialJudgment(pending,[o]),/empty gold/)
  const p=output([o]);assert.throws(()=>replayEditorial(input([o]),()=>({...p,articleBody:'forbidden'} as EditorialOutput)),/schema/i)
  const delta=judgment(o,'temporal_transition',{relation:'distinct_valuable_analysis',novelty:'distinct_analysis'});assert.throws(()=>validateEditorialJudgment(delta,[o],'bootstrap_primary_human'),/distinction/)
})
test('unsupported angle/publisher/opinion branding gets no additional need; observed material distinct analysis does',()=>{
  const rows=[obs('fact'),obs('analysis')],r=records(rows);r.forEach(x=>x.gold.storyId='same-development');const analytical=r.find(x=>x.metadata.url===rows[1].metadata.url)!;analytical.gold.angleId='analysis';analytical.gold.contentType='column'
  assert.equal(readingNeedIdentity(r[0],CLOCK),readingNeedIdentity(r[1],CLOCK))
  analytical.gold.novelty={status:'distinct_analysis',relativeTo:[],cutoff:CLOCK};analytical.gold.materialDelta={description:'Synthetic distinct mechanism',evidence:[{observationId:rows[1].id,field:'description',start:0,end:3}]}
  assert.notEqual(readingNeedIdentity(r[0],CLOCK),readingNeedIdentity(r[1],CLOCK))
  const m=editorialSelectionMetrics(r,run(rows,[rows[0].metadata.url]),rows)
  assert.equal(m.distinctAnalysisRecall.value,0);assert.equal(m.uniqueReadingNeedRecall.value,.5)
})
test('human best representative can be a stronger secondary article; comparable Tribune loss is diagnostic, not a ban',()=>{
  const ie=obs('ie'),specialist=obs('special','2026-10-07T13:00:00.000Z','Specialist'),tribune=obs('tribune',CLOCK,'The Tribune'),rows=[ie,specialist,tribune],r=records(rows)
  const j=judgment(specialist,'representative_set',{bestRepresentativeUrls:[specialist.metadata.url],secondaryJustification:'materially_superior'});j.articleUrls=rows.map(o=>o.metadata.url);j.observationIds=rows.map(o=>o.id)
  const m=editorialSelectionMetrics(r,run(rows,[specialist.metadata.url]),rows,{judgments:[j],reviewPolicy:'bootstrap_primary_human'})
  assert.equal(m.representativeQuality.bestReasonable.value,1);assert.equal(m.representativeQuality.secondaryWithoutHumanJustification,0)
  j.gold.comparableUrls=[ie.metadata.url,tribune.metadata.url];j.review.annotations[0].labels=structuredClone(j.gold)
  const t=editorialSelectionMetrics(r,run(rows,[tribune.metadata.url]),rows,{judgments:[j],reviewPolicy:'bootstrap_primary_human'})
  assert.equal(t.representativeQuality.tribuneChosenDespiteComparableCore,1);assert.equal(t.sourceConcentration.arbitraryDiversityReward,false)
  assert.deepEqual(EDITORIAL_POLICY.preferredComparablePublishers,['The Hindu','Indian Express'])
})
test('capacity quality requires a complete human pool; 51 useful unique needs have unavoidable utility loss one at 50',()=>{
  const rows=Array.from({length:51},(_,i)=>obs('need-'+i)),r=records(rows),judgments=rows.map(o=>judgment(o)),selected=run(rows,rows.slice(0,50).map(o=>o.metadata.url))
  const pending=editorialSelectionMetrics(r,selected,rows,{judgments,reviewPolicy:'bootstrap_primary_human'});assert.equal(pending.capacityQuality.capacityUtilityLossLowerBound,null)
  const m=editorialSelectionMetrics(r,selected,rows,{judgments,reviewPolicy:'bootstrap_primary_human',completeCandidatePoolJudged:true})
  assert.equal(m.capacityQuality.utilityCeilingAt50,50);assert.equal(m.capacityQuality.capacityUtilityLossLowerBound,1);assert.equal(m.capacityQuality.unavoidableNeedOverflowLowerBound,1)
})
test('pending natural records provide no quality claims and candidate sets remain blank with actual-day distinctions',()=>{
  const rows=[obs('a',CLOCK,'Indian Express','RBI cuts repo rate'),obs('b',CLOCK,'Indian Express','RBI cuts repo rate')],b=bootstrapCorpus(rows,'synthetic-sequence',2),p=temporalPackage(b.corpus,b.sampledObservations,CLOCK)
  assert.equal(p.articlesInCandidateEquivalentGroups,2);assert.equal(p.humanConfirmedEquivalentDevelopmentArticles,null);assert.equal(p.actualMultiDayCaptureSequences,0)
  p.judgmentTemplates.forEach(j=>validateEditorialJudgment(j,rows));assert.ok(p.judgmentTemplates.every(j=>digest(j.gold)===digest(EMPTY_EDITORIAL_LABELS)))
  const m=editorialSelectionMetrics(b.corpus,run(rows),rows);assert.equal(m.uniqueReadingNeedRecall.value,null);assert.equal(m.representativeQuality.bestReasonable.value,null);assert.equal(m.unjudgedVisible,2)
})
test('owner document rows remain explicit positives only; title retrieval never transfers machine gold',()=>{
  const dir=mkdtempSync(join(tmpdir(),'a2a-owner-test-'));try {
    const path=join(dir,'source.md');writeFileSync(path,'### Owner section\n| **RBI cuts monetary policy repo rate** | Curated description |\nProse outside a row must not create examples or instructions.\n')
    const exemplars=ownerExemplars(path);assert.equal(exemplars.entries.length,1);assert.equal(exemplars.entries[0].valueTier,null);assert.equal(exemplars.entries[0].url,null)
    const o=obs('owner',CLOCK,'Indian Express','RBI cuts monetary policy repo rate'),b=bootstrapCorpus([o],'synthetic-owner',1),d=exemplarDiagnostics(exemplars,[o],b.corpus)
    assert.equal(d.withSampledCandidate,1);assert.equal(d.rows[0].humanConfirmedArticleMatch,null);assert.equal(b.corpus[0].gold.value,null)
  } finally {rmSync(dir,{recursive:true})}
})
