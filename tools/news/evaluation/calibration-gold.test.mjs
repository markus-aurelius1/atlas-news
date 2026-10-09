import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, writeFileSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { digest } from './core.ts'
import { importCalibration, compareCalibration, verifyInventory, generate, MANIFEST_HASH } from './calibration-gold.mjs'
import { requirements } from './calibration-gold-requirements.mjs'
const root=new URL('./calibration-gold-v1/',import.meta.url)
const read=name=>JSON.parse(readFileSync(new URL(name,root),'utf8'))
const gold=read('gold.json'),obs=read('observations.json'),responses=read('human-annotations.original.json'),manifest=read('calibration-manifest.json'),attestation=read('owner-attestation.json')
// Recover source originals from preserved inner records without touching any sealed dataset.
const originals=gold.records.map(g=>{const r=structuredClone(g.record);r.review={status:'unreviewed',annotations:[],adjudication:null};r.gold={value:null,primarySubject:null,secondarySubjects:[],contentType:null,partyPoliticsPrimary:null,partyMention:null,scope:null,scopeReason:null,storyId:null,themeId:null,angleId:null,novelty:null,materialDelta:null,rejectReasons:[],rationale:null,metadataSufficiency:null,reviewBasis:null};return r})
const source=read('provenance.json').sourcePackage
const corpus=JSON.parse(readFileSync(join(source,'corpus.json'),'utf8'))
const observations=JSON.parse(readFileSync(join(source,'observations.json'),'utf8'))
const frozen=JSON.parse(readFileSync(join(source,'frozen-v2/predictions.json'),'utf8'))
const clone=structuredClone
function imported(a=responses,at=attestation,c=corpus,o=observations){return importCalibration(c,o,a,manifest,at)}
test('freeze verifies every exact artifact hash',()=>assert.ok(verifyInventory(fileURLToPath(root))>10))
test('50 exact IDs, schema, provenance, original annotations and inner policy survive import',()=>{assert.deepEqual(imported(),gold);assert.equal(gold.records.filter(g=>g.origin==='owner_id').length,47);assert.equal(gold.records.filter(g=>g.origin==='model_origin_owner_validated').length,3);for(const r of gold.records.filter(g=>g.origin==='model_origin_owner_validated')){assert.equal(r.record.review.annotations[0].reviewerId,responses.find(a=>a.id===r.id).annotation.reviewerId);assert.equal(r.record.review.adjudication,null);assert.equal(r.record.gold.value,null)}})
test('corpus reordering preserves gold; exact-input attestation rejects annotation reordering',()=>{assert.deepEqual(imported(responses,attestation,[...corpus].reverse(),[...observations].reverse()),gold);assert.throws(()=>imported([...responses].reverse()))})
test('reject duplicate, foreign, missing IDs and invented fields',()=>{for(const alter of [a=>a[1]=clone(a[0]),a=>a[0].id='foreign',a=>a.pop(),a=>a[0].annotation.labels.value='invented',a=>a[0].extra=true,a=>a[0].annotation.reviewedAt='yesterday',a=>a[0].annotation.rubricVersion='other']){const a=clone(responses);alter(a);assert.throws(()=>imported(a))}})
test('attestation is exact-input and exact-ID bound',()=>{for(const alter of [a=>a.ownerId='other',a=>a.responseSemanticSha256='0'.repeat(64),a=>a.validatedArticleIds.pop(),a=>a.modelOriginArticleIds.pop(),a=>a.calibrationManifestSha256='0'.repeat(64)]){const a=clone(attestation);alter(a);assert.throws(()=>imported(responses,a))}})
test('no missing/future evidence or metadata drift is accepted',()=>{for(const alter of [a=>a[0].annotation.evidence[0].end=999999,a=>a[0].annotation.evidence[0].observationId=obs.find(o=>!gold.records[0].record.observationIds.includes(o.id)).id,a=>a[1].annotation.labels.novelty.cutoff='2020-01-01T00:00:00.000Z']){const a=clone(responses);alter(a);const at=clone(attestation);at.responseSemanticSha256=digest(a);assert.throws(()=>imported(a,at))}const o=clone(observations);o[0].metadata.title+=' changed';assert.throws(()=>imported(responses,attestation,corpus,o))})
test('comparison reproduces frozen JSON and excludes 3 unresolved cases',()=>{const c=compareCalibration(gold,frozen,manifest);assert.deepEqual(c,read('comparison.json'));assert.equal(c.metrics.n,47);assert.equal(c.metrics.tp+c.metrics.fp+c.metrics.fn+c.metrics.tn,47);assert.equal(c.errors.unresolvable.length,3);assert.equal(c.metrics.fp,1);assert.equal(c.requestedAuthors.retained,4);assert.equal(c.requestedAuthors.n,8);assert.equal(c.primarySubject.n,c.metrics.tp+c.metrics.fn);for(const id of c.errors.unresolvable)assert.ok(!c.errors.falseNegatives.includes(id))})
test('owner-only sensitivity preserves the two resolved model-origin cases',()=>{const c=read('comparison.json');assert.equal(c.byOrigin.owner_id.total,47);assert.equal(c.byOrigin.owner_id.metrics.n,45);assert.equal(c.byOrigin.model_origin_owner_validated.metrics.n,2);assert.equal(c.byOrigin.model_origin_owner_validated.unresolvable,1)})
test('requirements reference observed IDs and do not relabel cases',()=>{assert.deepEqual(requirements(read('comparison.json')),read('stage-c-requirements.json'));assert.equal(attestation.calibrationManifestSha256,MANIFEST_HASH);assert.equal(originals.length,50)})
test('immutability: generator refuses overwrite and altered bytes fail verification',()=>{assert.throws(()=>generate({output:new URL('.',root)}),/already exists/);const dir=mkdtempSync(join(tmpdir(),'tars-calibration-integrity-'));cpSync(root,dir,{recursive:true});writeFileSync(join(dir,'gold.json'),'{}');assert.throws(()=>verifyInventory(dir))})
