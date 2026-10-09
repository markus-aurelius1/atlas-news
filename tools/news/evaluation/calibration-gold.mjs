/** Offline calibration import/analysis only. Never imported by production. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Ajv } from 'ajv'
import { validateCorpus, validateRun } from './validate.ts'
import { applyPrimaryReview } from './bootstrap-review.ts'
import { freezeV2 } from './frozen-v2.ts'
import { digest, stableJson, instant } from './core.ts'
import { RUBRIC_VERSION } from './bootstrap.ts'
import { binary } from './metrics.ts'

export const PARENT='cac3ea02db968aa7f5701022766cd20e50ea815d'
export const MANIFEST_HASH='8c0768866185a7642f8605fa8e4b7695c9cfee92c1fe6e559ccff0afd33691e3'
export const OWNER='Marcus'
export const MODEL='GPT-5.6 Sol — provisional model pre-review'
export const hashBytes=b=>createHash('sha256').update(b).digest('hex')
const hash=p=>hashBytes(readFileSync(p))
const read=p=>JSON.parse(readFileSync(p,'utf8'))
const schema=read(new URL('./schema.json',import.meta.url))
const ajv=new Ajv({allErrors:true,strict:false})
ajv.addFormat('utc-instant',{type:'string',validate:v=>{try{instant(v);return true}catch{return false}}})
ajv.addFormat('article-url',{type:'string',validate:v=>{try{return new URL(v).href===v}catch{return false}}})
ajv.addSchema(schema)
const annotationSchema={...schema.properties.review.properties.annotations.items,properties:{...schema.properties.review.properties.annotations.items.properties,rubricVersion:{const:RUBRIC_VERSION},reviewerId:{enum:[OWNER,MODEL]},disposition:{enum:['resolved','unresolvable']}},required:[...schema.properties.review.properties.annotations.items.required,'disposition']}
export const responseSchema={$id:'https://tars.local/evaluation/calibration-responses/v1',type:'array',minItems:50,maxItems:50,items:{type:'object',additionalProperties:false,required:['id','annotation'],properties:{id:{type:'string'},annotation:annotationSchema}}}
// Resolve A1 definitions against the original schema rather than changing its vocabulary.
const responseValidator=ajv.compile(JSON.parse(JSON.stringify(responseSchema).replaceAll('"#/$defs/','"'+schema.$id+'#/$defs/')))
const completionValidator=ajv.compile({allOf:[{$ref:schema.$id+'#/$defs/labels'},{type:'object',...schema.allOf[0].then.properties.gold}]})

export function importCalibration(corpus,observations,responses,manifest,attestation) {
 assert.ok(responseValidator(responses),JSON.stringify(responseValidator.errors))
 assert.equal(corpus.length,1000)
 assert.equal(new Set(corpus.map(r=>r.id)).size,1000)
 assert.equal(manifest.articleIds.length,50)
 assert.equal(new Set(manifest.articleIds).size,50)
 assert.equal(new Set(responses.map(r=>r.id)).size,50,'Duplicate annotation ID')
 assert.deepEqual([...responses.map(r=>r.id)].sort(),[...manifest.articleIds].sort(),'Response IDs differ from frozen selection')
 assert.equal(responses.filter(r=>r.annotation.reviewerId===OWNER).length,47)
 assert.equal(responses.filter(r=>r.annotation.reviewerId===MODEL).length,3)
 assert.equal(responses.filter(r=>r.annotation.disposition==='unresolvable').length,3)
 assert.equal(attestation.ownerId,OWNER)
 assert.equal(attestation.calibrationManifestSha256,MANIFEST_HASH)
 assert.equal(attestation.responseSemanticSha256,digest(responses))
 assert.deepEqual([...attestation.validatedArticleIds].sort(),[...manifest.articleIds].sort())
 assert.deepEqual([...attestation.modelOriginArticleIds].sort(),responses.filter(r=>r.annotation.reviewerId===MODEL).map(r=>r.id).sort())
 assert.ok(attestation.statement.includes('explicitly validated by the owner'))
 const lookup=new Map(corpus.map(r=>[r.id,r])),answers=new Map(responses.map(r=>[r.id,r]))
 const selected=manifest.articleIds.map(id=>{assert.ok(lookup.has(id),'Missing source article');return lookup.get(id)})
 validateCorpus(selected,observations)
 const ownerImported=applyPrimaryReview(selected,observations,responses.filter(r=>r.annotation.reviewerId===OWNER))
 const records=ownerImported.map(original=>{
  const response=answers.get(original.id),a=response.annotation,r=structuredClone(original)
  if(a.disposition==='resolved')assert.ok(completionValidator(a.labels),JSON.stringify(completionValidator.errors))
  else {assert.equal(a.labels.value,null);assert.equal(a.labels.metadataSufficiency.level,'insufficient')}
  if(a.reviewerId===MODEL) {
   const {disposition,...annotation}=structuredClone(a)
   r.review={status:disposition==='unresolvable'?'unresolvable':'in_review',annotations:[annotation],adjudication:null}
  }
  // The A1 single-primary-human adjudicator rule is not weakened for model annotations.
  // Effective owner validation is separate in this versioned envelope.
  return {id:r.id,record:r,originalAnnotation:structuredClone(a),origin:a.reviewerId===OWNER?'owner_id':'model_origin_owner_validated',ownerValidation:'owner-attestation.json',disposition:a.disposition,resolvedGold:a.disposition==='resolved'?structuredClone(a.labels):null}
 })
 validateCorpus(records.map(r=>r.record),observations,'implementation','bootstrap_primary_human')
 for(const r of records){const original=lookup.get(r.id);assert.deepEqual(r.record.metadata,original.metadata);assert.deepEqual(r.record.sampling,original.sampling);assert.deepEqual(r.record.observationIds,original.observationIds);assert.equal(r.record.partition,original.partition)}
 return {version:'tars-owner-validated-calibration-gold/v1',label:manifest.label,reviewPolicy:'owner_validation_separate_from_annotation_authorship',releaseEvaluation:false,records}
}
const plainMetrics=rows=>{const b=binary(rows.map(r=>({positive:r.value!=='reject',accepted:r.v2Decision==='accepted'})));return {n:rows.length,tp:b.tp,fp:b.fp,fn:b.fn,tn:b.tn,precision:b.precision.value,recall:b.recall.value,f1:b.f1.value}}
const group=(rows,key)=>Object.fromEntries([...new Set(rows.map(key))].sort().map(k=>[k,plainMetrics(rows.filter(r=>key(r)===k))]))
const pct=v=>v===null?'undefined':(v*100).toFixed(2)+'%'
const esc=v=>String(v??'').replaceAll('|','\\|').replaceAll('\n',' ')
export function compareCalibration(gold,frozen,manifest) {
 validateRun(frozen.run)
 const ps=new Map(frozen.run.articles.map(r=>[r.url,r]));assert.equal(ps.size,1000)
 const rows=gold.records.map((g,i)=>{
  const r=g.record,a=g.originalAnnotation,l=a.labels,p=ps.get(r.metadata.url);assert.ok(p,'Missing frozen v2 prediction')
  const trace=frozen.traces.find(t=>t.url===r.metadata.url);assert.ok(trace)
  const excluded=g.disposition==='unresolvable',positive=!excluded&&l.value!=='reject'
  const result=excluded?'excluded_unresolvable':positive?(p.decision==='accepted'?'TP':'FN'):(p.decision==='accepted'?'FP':'TN')
  const primaryEligible=positive&&l.primarySubject!=='not_applicable'&&l.primarySubject!==null
  const stageCFix=result==='FP'?'ceremonial_scope_gate':result==='FN'?(trace.verdict.staticAnchors.length?'value_and_substance_gate':'concept_or_framing_coverage'):null
  return {number:i+1,id:r.id,url:r.metadata.url,title:r.metadata.title,publisher:r.metadata.publisher,sections:r.metadata.memberships.map(m=>m.section),bylines:r.metadata.bylines,slices:manifest.memberships.find(x=>x.id===r.id).slices,origin:g.origin,reviewerId:a.reviewerId,disposition:g.disposition,partition:r.partition,panel:r.sampling.panel,value:l.value,goldPrimary:l.primarySubject,goldSecondary:l.secondarySubjects,contentType:l.contentType,scope:l.scope,partyPrimary:l.partyPoliticsPrimary,partyMention:l.partyMention,metadataSufficiency:l.metadataSufficiency,descriptionMissing:!r.metadata.description,descriptionLength:r.metadata.description.length,bylineMissing:!r.metadata.bylines.length,v2Decision:p.decision,v2Primary:p.primarySubject,v2Subjects:trace.verdict.subjects,v2Score:trace.verdict.score,v2Substance:trace.verdict.substance,v2Rejection:trace.verdict.rejectionReason??null,v2Evidence:trace.verdict.evidence,result,mustReadMiss:result==='FN'&&l.value==='must_read',primaryEligible,primaryMatch:primaryEligible?p.primarySubject===l.primarySubject:null,secondaryRecovered:primaryEligible?[...l.secondarySubjects].filter(s=>trace.verdict.subjects.includes(s)):[],rationale:l.rationale,scopeReason:l.scopeReason,diagnosis:{stageCCandidate:stageCFix,metadataLimitation:excluded?'insufficient_semantic_metadata':!r.metadata.description?'missing_description_compounds_risk':null,causalStatus:'Trace-grounded hypothesis; no counterfactual Stage C run',ownership:excluded?'acquisition_metadata':stageCFix?'Stage C acceptance; D owns subject errors':'D owns any subject error; no acceptance repair indicated'}}
 })
 const resolved=rows.filter(r=>r.result!=='excluded_unresolvable'),positive=resolved.filter(r=>r.value!=='reject'),must=resolved.filter(r=>r.value==='must_read')
 const originGroups=Object.fromEntries([...new Set(rows.map(r=>r.origin))].sort().map(k=>[k,{total:rows.filter(r=>r.origin===k).length,unresolvable:rows.filter(r=>r.origin===k&&r.result==='excluded_unresolvable').length,metrics:plainMetrics(resolved.filter(r=>r.origin===k))}]))
 return {version:'tars-calibration-frozen-v2-comparison/v1',label:manifest.label,limits:['Enriched 50-item owner calibration; descriptive counts only, no statistical release estimates or confidence intervals.','Model-origin annotations owner-validated, not independent human authorship or inter-rater agreement.','Original development/validation assignments retained; these 50 are now exposed calibration material, including 8 validation records.','Novelty uncertain/null is not duplicate, newness or analysis-angle gold; no E/F metrics.','Publisher/description associations are confounded by deliberate selection and cannot establish causality.','Unresolvable rows are excluded from binary and subject metrics.','No absent-from-corpus acquisition recall denominator is available.'],definitions:{positive:'resolved useful or must_read',accepted:'frozen-v2 run article decision accepted',primary:'exact ordered primary on all resolved gold positives, including v2 rejects; null is wrong',intervals:'not reported: enriched calibration, dependent candidate groups, no release inference'},metrics:plainMetrics(resolved),mustRead:{n:must.length,retained:must.filter(r=>r.v2Decision==='accepted').length,misses:must.filter(r=>r.mustReadMiss).map(r=>r.id),recall:must.filter(r=>r.v2Decision==='accepted').length/must.length},primarySubject:{n:positive.length,correct:positive.filter(r=>r.primaryMatch).length,accuracy:positive.filter(r=>r.primaryMatch).length/positive.length,confusion:Object.fromEntries([...new Set(positive.map(r=>r.goldPrimary))].sort().map(s=>[s,Object.fromEntries([...new Set(positive.filter(r=>r.goldPrimary===s).map(r=>r.v2Primary??'null'))].sort().map(p=>[p,positive.filter(r=>r.goldPrimary===s&&(r.v2Primary??'null')===p).length]))]))},requestedAuthors:{n:manifest.requestedAuthors.length,retained:rows.filter(r=>manifest.requestedAuthors.some(a=>a.id===r.id)&&r.v2Decision==='accepted').length,misses:rows.filter(r=>manifest.requestedAuthors.some(a=>a.id===r.id)&&r.result==='FN').map(r=>r.id),allMissingDescriptions:rows.filter(r=>manifest.requestedAuthors.some(a=>a.id===r.id)).every(r=>r.descriptionMissing)},byPublisher:group(resolved,r=>r.publisher),byContentType:group(resolved,r=>r.contentType),bySubject:group(resolved,r=>r.goldPrimary??'null'),byScope:group(resolved,r=>r.scope),byDescription:group(resolved,r=>r.descriptionMissing?'missing':'present'),byPartyPrimary:group(resolved,r=>String(r.partyPrimary)),byPanel:group(resolved,r=>r.panel),byPartition:group(resolved,r=>r.partition),byOrigin:originGroups,byAuthor:group(resolved,r=>r.bylines.length?[...new Set(r.bylines.map(b=>b.name))].sort().join('; '):'(missing)'),errors:{falsePositives:rows.filter(r=>r.result==='FP').map(r=>r.id),falseNegatives:rows.filter(r=>r.result==='FN').map(r=>r.id),mustReadMisses:rows.filter(r=>r.mustReadMiss).map(r=>r.id),subjectMismatches:rows.filter(r=>r.primaryEligible&&!r.primaryMatch).map(r=>r.id),unresolvable:rows.filter(r=>r.result==='excluded_unresolvable').map(r=>r.id)},rows}
}

function markdown(comparison) {
 const c=comparison,m=c.metrics,lines=['# Frozen-v2 owner calibration error analysis','',c.label,'',`Resolved binary denominator ${m.n}/50; 3 unresolvable excluded. TP ${m.tp}, FP ${m.fp}, FN ${m.fn}, TN ${m.tn}. Descriptive precision ${pct(m.precision)}, recall ${pct(m.recall)}, F1 ${pct(m.f1)}. Must-read retained ${c.mustRead.retained}/${c.mustRead.n} (${pct(c.mustRead.recall)}); misses ${c.mustRead.misses.length}. Exact-primary correct on ALL positives ${c.primarySubject.correct}/${c.primarySubject.n} (${pct(c.primarySubject.accuracy)}), including rejected positives.`, '',...c.limits.map(s=>'- '+s),'','## Error matrix','', '| Outcome | Cases |','| --- | --- |',...['FP','FN','TP','TN','excluded_unresolvable'].map(k=>`| ${k} | ${c.rows.filter(r=>r.result===k).map(r=>'#'+r.number).join(', ')} |`),'','## Provenance sensitivity','',...Object.entries(c.byOrigin).map(([k,v])=>`${k}: ${v.total} total, ${v.unresolvable} unresolvable; resolved n=${v.metrics.n}, TP=${v.metrics.tp}, FP=${v.metrics.fp}, FN=${v.metrics.fn}, TN=${v.metrics.tn}; precision ${pct(v.metrics.precision)}, recall ${pct(v.metrics.recall)}.`),'',`Requested-author census: ${c.requestedAuthors.retained}/${c.requestedAuthors.n} retained; ${c.requestedAuthors.misses.length} missed. All eight have missing descriptions. This demonstrates captured-metadata acceptance losses, not missing acquisition.`, '', '## Subject and content patterns','','Subject classification remains Stage D. The confusion matrix and all primary mismatches are in comparison.json; rejection is not treated as a subject abstention. V2 does not predict content type, so the content-type table measures acceptance by owner type, not content-type accuracy.','']
 for(const [name,groups]of Object.entries({Publisher:c.byPublisher,'Content type':c.byContentType,'Gold primary':c.bySubject,'Metadata description':c.byDescription,'Captured author':c.byAuthor,'Scope':c.byScope,'Party primary':c.byPartyPrimary,'Original partition':c.byPartition,'Original panel':c.byPanel}))lines.push('## '+name,'','| Slice | n | TP | FP | FN | TN | Precision | Recall |','| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',...Object.entries(groups).map(([k,v])=>`| ${esc(k)} | ${v.n} | ${v.tp} | ${v.fp} | ${v.fn} | ${v.tn} | ${pct(v.precision)} | ${pct(v.recall)} |`),'')
 lines.push('## Interpretation and ownership','','The sole false positive (#22) is a memorial-corridor opening: bilateral names and an India link supply evidence but the owner identifies ceremonial value. Stage C should gate ceremonial events without suppressing material India-Japan agreements. Party-primary and foreign-domestic rejects currently pass as negative controls; avoid undoing them while recovering positives.','','False negatives include threshold losses with detected concepts, absent lexical coverage, and a substance gate that requires a factual action even for valuable institutional criticism (#21). The eight requested-author cases are all present with legitimate bylines; missing discovery is not demonstrated here. Their acceptance failures concern captured content and analysis framing, compounded by missing summaries. Authorship is contextual evidence and cannot justify unconditional acceptance.','','All 22 empty-description cases are separately tabulated, as are the 28 nonempty descriptions. Nonempty does not mean useful: #3 has a two-word summary. The three unresolvable cases (#3, #23, #36) need acquisition/metadata evidence or explicit abstention, not forced Stage C labels. For resolved sparse cases, title/section/byline may support bounded qualification; opaque rhetoric still limits what can be concluded about the argument. No body fetching or fabricated summary is warranted.','','Publisher counts describe this selected set, not publisher quality. Indian Express and The Hindu include deliberately enriched opinion, explainer and missing-summary slices. Other-source losses include oil-market analysis, newsletter economics, palaeontology and behavioural economics. Prefer independent value evidence; do not compensate using publisher quotas.','','Science losses #35/#39 and river-rejuvenation #5 demonstrate global-knowledge and environmental-method relevance without country-name prestige. Subject errors (AI law enforcement, R&D ecosystem, diplomacy/climate and mining/federalism) belong to D. Repeated oil, enrichment and fossil stories remain article-level observations: no equivalence, novelty or saturation conclusion is licensed by these labels.','','See stage-c-requirements.json and STAGE_C_REQUIREMENTS.md for bounded, prioritized acceptance/regression work. No Stage C/D/E/F logic was implemented.','')
 return lines.join('\n')
}
export function inventory(root) {const out=[];function walk(dir,prefix=''){for(const f of readdirSync(dir,{withFileTypes:true})){const p=prefix+f.name;if(f.isDirectory())walk(join(dir,f.name),p+'/');else if(!['sha256-manifest.json','sha256-manifest.sha256'].includes(p))out.push({path:p,sha256:hash(join(root,p))})}}walk(root);return out.sort((a,b)=>a.path.localeCompare(b.path,'en'))}
export function verifyInventory(root) {const inv=read(join(root,'sha256-manifest.json'));assert.equal(hash(join(root,'sha256-manifest.json')),readFileSync(join(root,'sha256-manifest.sha256'),'utf8').trim().split(/\s/)[0]);assert.deepEqual(inventory(root),inv.files);return inv.files.length}
export function generate({sourcePackage,input,output,recordedAt,requirements}) {
 assert.ok(!existsSync(output),'Frozen output already exists; use verify, never overwrite')
 instant(recordedAt)
 const manifestPath='tools/news/evaluation/calibration-reviewer-v1/calibration-manifest.json'
 assert.equal(hash(manifestPath),MANIFEST_HASH)
 const manifest=read(manifestPath)
 const protectedFiles=manifest.originalFiles.map(f=>{assert.equal(hash(join(sourcePackage,f.path)),f.sha256,'Frozen original drift: '+f.path);return f})
 const sourceInventory=read(join(sourcePackage,'artifact-hashes.json'))
 for(const f of sourceInventory.files)assert.equal(hash(join(sourcePackage,f.path)),f.sha256,'A2a inventory drift: '+f.path)
 const corpus=read(join(sourcePackage,'corpus.json')),observations=read(join(sourcePackage,'observations.json')),frozen=read(join(sourcePackage,'frozen-v2/predictions.json')),responses=read(input)
 const attestation={version:'tars-owner-calibration-attestation/v1',ownerId:OWNER,recordedAt,validationTime:null,validationTimeNote:'Owner validation supplied in task instruction; no historical validation timestamp or signature asserted.',statement:'Preserve original provenance: 47 owner-ID records + 3 model-origin records explicitly validated by the owner. Store owner validation separately; do not falsify authorship.',source:'Direct owner request in this chat, 2026-10-08 Asia/Calcutta; not inferred from attachment contents',inputSha256:hash(input),responseSemanticSha256:digest(responses),calibrationManifestSha256:MANIFEST_HASH,validatedArticleIds:manifest.articleIds,modelOriginArticleIds:responses.filter(r=>r.annotation.reviewerId===MODEL).map(r=>r.id),scope:'Owner-validated calibration gold only; no independent second human review or release certification'}
 const gold=importCalibration(corpus,observations,responses,manifest,attestation)
 const selectedObservationIds=new Set(gold.records.flatMap(r=>r.record.observationIds)),selectedObservations=observations.filter(o=>selectedObservationIds.has(o.id))
 // Reconstruct exactly the original baseline input, one actual matching revision per article.
 const representativeObservations=corpus.map(r=>{const t=frozen.traces.find(t=>t.url===r.metadata.url);assert.ok(t);const o=observations.find(o=>o.id===t.observationId);assert.ok(o&&r.observationIds.includes(o.id));assert.equal(stableJson(o.metadata),stableJson(r.metadata));assert.equal(o.metadataHash,t.metadataHash);return o})
 const archivedCodeRoot=resolve(sourcePackage,'../../../../../..')
 const codeVerification=frozen.files.map(f=>{
  const currentSha256=hash(f.path)
  if(currentSha256===f.sha256)return {...f,currentSha256,status:'exact_bytes'}
  const archived=join(archivedCodeRoot,f.path)
  assert.equal(hash(archived),f.sha256,'Frozen code unavailable: '+f.path)
  assert.equal(readFileSync(f.path,'utf8').replaceAll('\r\n','\n'),readFileSync(archived,'utf8').replaceAll('\r\n','\n'),'Semantic code drift: '+f.path)
  return {...f,currentSha256,status:'archived_exact_bytes_current_CRLF_equivalent',archived}
 })
 assert.equal(hash(frozen.index.path),frozen.index.sha256)
 const replay=freezeV2(representativeObservations,frozen.clock,frozen.baseCommit)
 assert.equal(replay.run.outputHash,frozen.run.outputHash,'Frozen v2 replay changed output')
 assert.deepEqual(replay.run.articles,frozen.run.articles)
 assert.deepEqual(replay.traces,frozen.traces)
 const reverseReplay=freezeV2([...representativeObservations].reverse(),frozen.clock,frozen.baseCommit)
 assert.equal(reverseReplay.run.outputHash,frozen.run.outputHash)
 assert.deepEqual(reverseReplay.traces,frozen.traces)
 const comparison=compareCalibration(gold,frozen,manifest)
 assert.equal(comparison.metrics.n,47)
 const reqs=requirements(comparison)
 mkdirSync(output,{recursive:true})
 const write=(name,value)=>writeFileSync(join(output,name),JSON.stringify(value,null,2)+'\n','utf8')
 writeFileSync(join(output,'human-annotations.original.json'),readFileSync(input))
 writeFileSync(join(output,'calibration-manifest.json'),readFileSync(manifestPath))
 write('response-schema.json',JSON.parse(JSON.stringify(responseSchema).replaceAll('"#/$defs/','"'+schema.$id+'#/$defs/')));writeFileSync(join(output,'a1-schema.json'),readFileSync(new URL('./schema.json',import.meta.url)));write('owner-attestation.json',attestation);write('gold.json',gold);write('observations.json',selectedObservations);write('comparison.json',comparison);write('stage-c-requirements.json',reqs)
 writeFileSync(join(output,'COMPARISON.md'),markdown(comparison),'utf8')
 const cols=['number','id','title','publisher','origin','disposition','value','result','mustReadMiss','contentType','goldPrimary','v2Primary','primaryMatch','scope','descriptionMissing','descriptionLength','bylineMissing','v2Score','v2Rejection','rationale']
 writeFileSync(join(output,'error-cases.tsv'),[cols.join('\t'),...comparison.rows.map(r=>cols.map(k=>String(r[k]??'').replaceAll('\t',' ').replaceAll('\n',' ')).join('\t'))].join('\n')+'\n','utf8')
 writeFileSync(join(output,'ERROR_CASES.md'),['# Complete 50-case comparison','','Full annotation evidence, legitimate bylines, scope, subject confusion, traces and causal limitations: comparison.json. Case numbers retain frozen manifest order.','','| # | Article ID | Title | Gold / v2 | Result | Must-read miss | Subject gold / v2 | Metadata | Trace / owner rationale |','| ---: | --- | --- | --- | --- | --- | --- | --- | --- |',...comparison.rows.map(r=>`| ${r.number} | ${r.id} | ${esc(r.title)} | ${r.value??'unresolved'} / ${r.v2Decision} | ${r.result} | ${r.mustReadMiss} | ${esc(r.goldPrimary)} / ${esc(r.v2Primary)} | ${r.descriptionMissing?'No description':r.descriptionLength+' chars'}; ${r.metadataSufficiency.level} | ${esc(r.v2Rejection??'Accepted')}; ${esc(r.rationale)} |`),''].join('\n'),'utf8')
 writeFileSync(join(output,'STAGE_C_REQUIREMENTS.md'),['# Prioritized Stage C requirements and regression specification','','Specification only. Each natural case below uses the frozen owner validation. Proposed counterfactual fixtures must be explicitly synthetic and never become gold.','','Contract: deterministic metadata-only eligibility and value/substance outputs with versioned reason codes, exact observed evidence spans, explicit clock and policy/index/registry/author hashes. Keep scope, value, subject, novelty and diversity independently owned. Stage C must not own D subject selection, E grouping/history or F ranking.','','Acceptance: run every resolved calibration case; report all remaining FP/FN/must-read misses and all abstentions, plus owner-only sensitivity. Target these named regressions individually; do not promise release gates from 50 enriched cases. Preserve negative controls. Evaluate against wider reviewed development/validation gold before any release claim; never tune on the future holdout.','',...reqs.requirements.flatMap(r=>['## '+r.priority+' '+r.id+' — '+r.title,'',r.requirement,'','Observed cases: '+r.evidence.map(e=>'#'+e.number+' `'+e.id+'`').join(', '),'','Regression assertions:',...r.regressions.map(s=>'- '+s),'','Boundary: '+r.boundary,'']),'## Metadata and later-stage handoffs','','- Acquisition: recover permitted feed summary/byline only in separately authorized source work; record semantic sufficiency, including nonempty placeholder summaries. No body fetch, generated summary or prestige fallback. No corpus-wide acquisition recall is measurable from these 50.','- D: exact-primary regression fixtures for every positive subject mismatch, including C rejects; keep owner secondary labels distinct.','- E/F: uncertain novelty remains unknown; no deduplication, selection, publisher preference or saturation implementation from this import.','- The 8 selected original validation rows are exposed calibration data. Preserve their partition assignments; do not present them as untouched release evaluation.',''].join('\n'),'utf8')
 write('provenance.json',{version:'tars-calibration-provenance/v1',parentCommit:PARENT,branch:'codex/validator-v3-calibration-gold',recordedAt,annotationInput:{sha256:hash(input),ownerIdRecords:47,modelOriginRecords:3},calibrationManifestSha256:MANIFEST_HASH,sourcePackage,protectedFiles,sourceInventoryVerified:sourceInventory.files.length,codeVerification,sourceHashes:['calibration-gold.mjs','calibration-gold-requirements.mjs','calibration-gold.test.mjs','schema.json','validate.ts','bootstrap-review.ts'].map(p=>({path:'tools/news/evaluation/'+p,sha256:hash('tools/news/evaluation/'+p)})),replay:{baselineSha256:hash(join(sourcePackage,'frozen-v2/predictions.json')),clock:frozen.clock,outputHash:frozen.run.outputHash,reconstructedOutputHash:replay.run.outputHash,exactPredictions:true,exactTraces:true,reverseOrderOutputHash:reverseReplay.run.outputHash,codeByteNote:'One CRLF in archived frozen-v2.ts becomes LF in Git checkout; exact archived hash and normalized text equality verified. Current runner code hash therefore differs; prediction and trace digests match.'},counts:{corpus:1000,selected:50,resolved:47,unresolvable:3,selectedObservations:selectedObservations.length,originalPartitions:Object.fromEntries(['development','validation'].map(p=>[p,gold.records.filter(r=>r.record.partition===p).length]))},boundaries:{parentCorpusUnchanged:true,ownerExemplarsUnchanged:true,futureHoldoutOpened:false,productionChanged:false,laterStagesImplemented:false},immutability:'Content-addressed freeze with SHA-256 verification and no-overwrite generator; local files are not filesystem WORM or a cryptographic owner signature.'})
 writeFileSync(join(output,'README.md'),'# Frozen owner-validated calibration gold v1\n\nOwner calibration set — not statistical release evaluation. All 50 original annotations and their authorship are preserved. owner-attestation.json separately binds owner validation to exact input bytes and IDs. gold.json is a versioned envelope: record preserves A1 compatibility; model-origin resolved records remain in_review in that inner record because the single-human policy cannot name the model as the human adjudicator. resolvedGold plus separate owner validation is authoritative for this calibration only. Unresolvable resolvedGold is null; inner gold stays blank. Do not feed this envelope to the generic A1 evaluator as a release corpus.\n\nSHA-256 manifest covers all package files except itself and its companion; the companion pins the manifest hash. Verify before use. No original input is overwritten. Reruns must target a new directory. Parent/input/tool hashes, provenance and exact baseline replay evidence are in provenance.json. Comparison uses unchanged frozen predictions, not new predictions.\n\nRead COMPARISON.md, ERROR_CASES.md and STAGE_C_REQUIREMENTS.md; JSON and TSV retain full machine-readable results. Verification of repository checks is stored separately in ../CALIBRATION_GOLD_VERIFICATION.json. No Stage C/D/E/F implementation, production edit, commit, push, merge or deployment is authorized by this package.\n','utf8')
 for(const f of protectedFiles)assert.equal(hash(join(sourcePackage,f.path)),f.sha256)
 write('sha256-manifest.json',{version:'tars-calibration-sha256/v1',algorithm:'SHA-256',files:inventory(output),note:'Self and sha256 companion excluded; companion pins exact manifest bytes.'})
 writeFileSync(join(output,'sha256-manifest.sha256'),hash(join(output,'sha256-manifest.json'))+'  sha256-manifest.json\n','utf8')
 verifyInventory(output)
 return {output,manifestSha256:hash(join(output,'sha256-manifest.json')),metrics:comparison.metrics,mustRead:comparison.mustRead,primary:comparison.primarySubject}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
 const [mode,...args]=process.argv.slice(2)
 if(mode==='verify'){console.log(JSON.stringify({filesVerified:verifyInventory(args[0])}))}
 else if(mode==='import') {const {requirements}=await import('./calibration-gold-requirements.mjs');console.log(JSON.stringify(generate({sourcePackage:args[0],input:args[1],output:args[2],recordedAt:args[3],requirements}),null,2))}
 else throw Error('Usage: node calibration-gold.mjs import SOURCE ANNOTATIONS NEW_OUTPUT UTC | verify OUTPUT')
}
