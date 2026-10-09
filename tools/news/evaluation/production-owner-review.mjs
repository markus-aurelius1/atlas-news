/** Import owner-ratified evidence after byte, identity and frozen-prediction checks. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { evaluateReading } from '../../../src/current-affairs/validator-v3/orchestrator.ts'
import { equivalentDevelopment } from '../../../src/current-affairs/validator-v3/stories.ts'
import { chooseRepresentative } from '../../../src/current-affairs/validator-v3/selection.ts'
import { stageCVersions } from './stage-c-runner.ts'
import { validateObservation } from './validate.ts'
import { digest } from './core.ts'
const root='docs/production-release',read=p=>JSON.parse(readFileSync(p,'utf8'))
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex')
const write=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n')
const input='C:/Users/hario/Downloads/tars-model-assisted-owner-validated-50.json'
const source=read('tools/news/evaluation/calibration-gold-v1/provenance.json')
const samplePath='docs/release-candidate/blind-review-v2/sample.json', sample=read(samplePath), review=read(input)
assert.equal(hash(input),'81aee61ca6d69333a70fd25f915863b94a0ded2446fe74cccc346152afbec475')
assert.equal(hash(samplePath),'853a8bc657b4a78faeda25a95219dd95248ae7cb0d5f2a6f2651deaa1118b547')
assert.equal(review.sampleSha256,hash(samplePath))
const freeze=read('docs/release-candidate/blind-review-v2/hashes.json')
assert.equal(hash('docs/release-candidate/blind-review-v2/index.html'),freeze.htmlSha256)
for(const f of source.protectedFiles)assert.equal(hash(source.sourcePackage+'/'+f.path),f.sha256,f.path)
const corpus=read(source.sourcePackage+'/corpus.json'),all=read(source.sourcePackage+'/observations.json')
const manifest=read('docs/release-candidate/blind-sampling-manifest-v2.json')
assert.equal(hash(source.sourcePackage+'/corpus.json'),manifest.sourceCorpusSha256)
assert.deepEqual(Object.keys(review.articles).sort(),sample.records.map(r=>r.id).sort())
assert.deepEqual(Object.keys(review.pairs).sort(),sample.pairs.map(r=>r.id).sort())
assert.equal(review.version,'tars-rc-human-review/1');assert.equal(review.provenance,'owner_validated_model_assisted')
assert.equal(review.status,'complete_owner_validated');assert.equal(review.ownerAttestation.reviewerId,review.reviewerId)
assert(review.ownerAttestation.ratifiedAll50Articles&&review.ownerAttestation.ratifiedAll10Pairs&&review.ownerAttestation.modelAssisted)
assert.equal(review.exportedAt,review.ownerAttestation.ratifiedAt);assert(Number.isFinite(Date.parse(review.exportedAt)))
const subjects=['Polity','Governance','Economy','International relations','Security','Sci-Tech','Environment','Geography','History & Culture','Unresolved']
for(const r of sample.records){
 const c=corpus.find(c=>c.id===r.id);assert(c);assert.deepEqual(r.metadata,c.metadata);assert.deepEqual(r.observations,c.observationIds)
 const a=review.articles[r.id];assert(['must_read','useful','reject','unable_to_judge'].includes(a.value));assert(subjects.includes(a.subject));assert(['sufficient','limited','insufficient'].includes(a.sufficiency));assert(a.rationale.trim());assert.equal(a.reviewedAt,null);assert.equal(a.annotationOrigin,'GPT-6 — provisional metadata-only review')
}
for(const p of sample.pairs){const a=review.pairs[p.id];assert(sample.records.some(r=>r.id===p.left)&&sample.records.some(r=>r.id===p.right));assert(['same_development','related_distinct_development','unrelated','uncertain'].includes(a.development));assert(['equivalent_angle','complementary_valuable_angle','redundant_analysis','uncertain'].includes(a.angle));assert(['comparable_quality','left_materially_better','right_materially_better','uncertain'].includes(a.representative));assert(a.rationale.trim());assert.equal(a.reviewedAt,null);assert.equal(a.annotationOrigin,'GPT-6 — provisional metadata-only review')}
const counts=Object.fromEntries(['must_read','useful','reject','unable_to_judge'].map(v=>[v,Object.values(review.articles).filter(a=>a.value===v).length]))
assert.deepEqual(counts,{must_read:11,useful:12,reject:23,unable_to_judge:4})
const ids=new Set(sample.records.flatMap(r=>r.observations)),observations=all.filter(o=>ids.has(o.id)); observations.forEach(validateObservation)
assert.equal(observations.length,ids.size);assert.equal(new Set(observations.map(o=>o.metadata.url)).size,50)
const frozenPath='C:/Users/hario/.codex/worktrees/6fba/Atlas-News/tools/news/.cache/release-candidate/blind-v2-machine-predictions.json'
assert(existsSync(frozenPath),'Frozen candidate predictions unavailable')
const frozen=read(frozenPath),run=evaluateReading({observations,clock:sample.clock,versions:stageCVersions(observations[0].registryHash)},[],[])
assert.deepEqual(run,frozen,'Committed runtime must reproduce frozen candidate before labels join')
assert.deepEqual(evaluateReading({observations:[...observations].reverse(),clock:sample.clock,versions:stageCVersions(observations[0].registryHash)},[],[]),run)
assert(!existsSync(root+'/owner-review.original.json'),'Never overwrite imported bytes')
mkdirSync(root,{recursive:true});copyFileSync(input,root+'/owner-review.original.json');copyFileSync(frozenPath,root+'/frozen-candidate-predictions.json')
write(root+'/model-annotations.original.json',{modelOrigin:review.modelOrigin,articles:review.articles,pairs:review.pairs})
write(root+'/owner-attestation.json',{...review.ownerAttestation,inputSha256:hash(input),sampleSha256:hash(samplePath),evidence:'owner-ratified model-assisted; not independently human-authored gold or a sealed holdout'})
const result=(value,decision)=>value==='unable_to_judge'?'unadjudicated':decision==='deferred'?(value==='reject'?'deferred_negative':'deferred_positive'):value==='reject'?(decision==='accepted'?'FP':'TN'):(decision==='accepted'?'TP':'FN')
const rows=sample.records.map((r,i)=>{const a=run.articles.find(a=>a.item.url===r.metadata.url),label=review.articles[r.id],unit=run.stories.units.find(u=>u.members.some(m=>m.url===r.metadata.url)),selected=run.selection.today.find(s=>s.unit.id===unit?.id);return {number:i+1,id:r.id,metadata:r.metadata,annotation:label,decision:a.acceptance.decision,result:result(label.value,a.acceptance.decision),subject:a.subject.primary,subjectCorrect:label.subject===a.subject.primary,tier:a.acceptance.relevance.status,tierDisagreement:a.acceptance.accepted&&['must_read','useful'].includes(label.value)&&((label.value==='must_read')!==(a.acceptance.relevance.status==='must_read_candidate')),acceptance:a.acceptance,subjectEvidence:a.subject,unit:unit?.id??null,todayMember:!!selected,todayPrimary:selected?.primary.item.url===r.metadata.url,suppression:run.selection.suppressed.find(s=>s.id===unit?.id)?.reason??null,contentType:r.metadata.memberships.some(m=>/opinion|editorial|column|analysis/i.test(m.section))?'analysis':r.metadata.memberships.some(m=>/explain/i.test(m.section))?'explainer':'report_or_other'}})
function summary(rows){const adjudicated=rows.filter(r=>r.result!=='unadjudicated'),must=rows.filter(r=>r.annotation.value==='must_read');return {total:rows.length,adjudicated:adjudicated.length,...Object.fromEntries(['TP','FP','FN','TN','deferred_positive','deferred_negative','unadjudicated'].map(v=>[v,rows.filter(r=>r.result===v).length])),subjectCorrect:adjudicated.filter(r=>r.subjectCorrect).length,subjectDenominator:adjudicated.length,mustRead:{total:must.length,accepted:must.filter(r=>r.decision==='accepted').length,rejected:must.filter(r=>r.decision==='rejected').length,deferred:must.filter(r=>r.decision==='deferred').length,todayMembers:must.filter(r=>r.todayMember).length,todayPrimaries:must.filter(r=>r.todayPrimary).length}}}
const comparisons=sample.pairs.map(p=>{const l=rows.find(r=>r.id===p.left),r=rows.find(r=>r.id===p.right),la=run.articles.find(a=>a.item.url===l.metadata.url),ra=run.articles.find(a=>a.item.url===r.metadata.url),label=review.pairs[p.id],directEquivalent=equivalentDevelopment(la.item,ra.item),eligible=[la,ra].filter(a=>a.acceptance.accepted),chosen=eligible.length?chooseRepresentative(eligible).item.url:null;return {...p,leftNumber:l.number,rightNumber:r.number,leftTitle:l.metadata.title,rightTitle:r.metadata.title,annotation:label,directEquivalent,expectedEquivalent:label.development==='same_development',developmentMatch:label.development==='uncertain'?null:directEquivalent===(label.development==='same_development'),pipelineMerged:!!l.unit&&l.unit===r.unit,leftDecision:l.decision,rightDecision:r.decision,analyticalAngleAssessment:label.angle==='uncertain'?'unadjudicated':label.angle==='complementary_valuable_angle'?(!directEquivalent?'separate_reading_needs_preserved':'inappropriate_merge'):directEquivalent?'equivalence_detected':'split_or_missing_evidence',representative:chosen,representativeAssessment:label.representative==='uncertain'?'unadjudicated':!chosen?'not_applicable_no_admissions':label.representative==='comparable_quality'?'either_acceptable':chosen===(label.representative==='left_materially_better'?l.metadata.url:r.metadata.url)?'match':'disagreement',representativeLimitation:'Qualified admissions only; direct equivalence is an isolated metadata diagnostic, not pipeline admission or body-quality evidence'}})
for(const p of comparisons)if(p.annotation.angle==='complementary_valuable_angle'){
  p.analyticalAngleAssessment=p.directEquivalent?'inappropriate_merge':'isolated_distinction_detected'
  p.pipelineReadingNeedsPreserved=!!rows.find(r=>r.id===p.left).unit&&!!rows.find(r=>r.id===p.right).unit&&!p.pipelineMerged
  p.pipelineLimitation=p.pipelineReadingNeedsPreserved?null:'Both useful sides are deferred; actual reading needs are lost at admission'
}
const by=key=>Object.fromEntries([...new Set(rows.map(key))].sort().map(k=>[k,summary(rows.filter(r=>key(r)===k))]))
const evidence={startingCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),inputSha256:hash(input),sampleSha256:hash(samplePath),frozenPredictionSha256:hash(frozenPath),predictionOutputHash:digest(run),frozenReproduced:true,reverseOrderEqual:true,clock:sample.clock,counts,metrics:summary(rows),byPublisher:by(r=>r.metadata.publisher),bySubject:by(r=>r.annotation.subject),byContentType:by(r=>r.contentType),rows,comparisons,limitations:'Enriched historical diagnostic, model-origin ratified by owner; no P@20/P@50, temporal recall, independent or representative production estimate. Cold history. Four unable-to-judge labels excluded from binary and subject denominators.'}
write(root+'/owner-evaluation.json',evidence)
console.log(JSON.stringify({counts,metrics:evidence.metrics,errors:rows.filter(r=>['FP','FN','deferred_positive'].includes(r.result)||r.tierDisagreement||(!r.subjectCorrect&&r.result!=='unadjudicated')).map(r=>({number:r.number,title:r.metadata.title,result:r.result,subject:r.subject,expected:r.annotation.subject,tier:r.tier,value:r.annotation.value,description:r.metadata.description,rationale:r.annotation.rationale})),comparisons}))
