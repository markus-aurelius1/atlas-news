import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { validateImport, outcome, metrics, ROOT, seal, verify, generate } from './owner-validation.mjs'
import { evaluateReading } from '../../../src/current-affairs/validator-v3/orchestrator.ts'
const read = p => JSON.parse(readFileSync(p,'utf8'))
const input=read(ROOT+'/owner-review.original.json'),frozen=read(ROOT+'/frozen-review.original.json'),obs=read(ROOT+'/observations.json')
const c=read(ROOT+'/comparison.json'),pred=read(ROOT+'/predictions.json')
test('25 exact frozen cases and owner-ratified model authorship survive import',()=>{
  assert.deepEqual(validateImport(input,frozen,obs),obs)
  assert.equal(input.records.length,25)
  assert(input.records.every(r=>r.annotation.reviewerId===input.ownerValidation.originalReviewer&&r.annotation.reviewedAt===null))
})
test('integrity rejects ID, captured evidence, metadata and owner attestation tampering',()=>{
  for(const mutate of [i=>i.records.pop(),i=>i.records[1]=structuredClone(i.records[0]),i=>i.records[0].id='article:'+'0'.repeat(64),i=>i.records[0].metadata.title+=' invented',i=>i.records[0].capturedObservations[0].capturedAt='2026-10-07T12:00:00.000Z',i=>i.ownerValidation.validatedArticleIds.pop(),i=>i.ownerValidation.validatedArticleIds[0]=i.ownerValidation.validatedArticleIds[1],i=>i.ownerValidation.validatedCount=24,i=>i.ownerValidation.originalReviewer='Marcus',i=>i.ownerValidation.sourceHtmlSha256='0'.repeat(64),i=>i.records[0].annotation.reviewerId='Marcus']){
    const copy=structuredClone(input);mutate(copy);assert.throws(()=>validateImport(copy,frozen,obs))
  }
})
test('closed allowed values, groups and annotation fields are enforced',()=>{
  for(const mutate of [i=>i.records[0].annotation.value='accept',i=>i.records[0].annotation.primarySubject='Chemistry',i=>i.records[0].annotation.metadataSufficiency='assumed',i=>i.records[1].annotation.distinctAngle='maybe',i=>i.records[1].annotation.storyGroup='Invented Group',i=>i.records[1].annotation.storyGroup=null,i=>i.records[0].annotation.extra=true,i=>i.records[0].extra=true,i=>i.records[0].annotation.reviewedAt='yesterday',i=>i.ownerValidation.sourceHtmlSha256='invalid']){
    const copy=structuredClone(input);mutate(copy);assert.throws(()=>validateImport(copy,frozen,obs))
  }
})
test('abstentions never become negatives and zero denominators remain null',()=>{
  assert.equal(outcome('useful','deferred'),'deferred_positive');assert.equal(outcome('reject','deferred'),'deferred_negative')
  assert.equal(outcome('useful','rejected'),'FN');assert.equal(outcome('reject','rejected'),'TN')
  assert.equal(metrics([]).precision,null);assert.equal(metrics([]).positiveRetention,null)
  assert.deepEqual(metrics(c.rows),c.metrics)
  assert.equal(c.metrics.TP+c.metrics.FP+c.metrics.FN+c.metrics.TN+c.metrics.deferredPositive+c.metrics.deferredNegative,25)
})
test('blind frozen-parent replay and reverse order reproduce complete frozen predictions',async()=>{
  // Immutable predictions must be tested against the committed runtime that
  // produced them, even after separately authorized runtime corrections.
  const dir=mkdtempSync(join(tmpdir(),'owner-frozen-runtime-'))
  const archive=join(dir,'runtime.zip'),runtime=join(dir,'runtime')
  mkdirSync(runtime)
  execFileSync('git',['archive','--format=zip','-o',archive,'6d88835e275fd97d0f5ebd21908d75992630eb66','src','package.json'])
  execFileSync('tar',['-xf',archive,'-C',runtime])
  const {evaluateReading:frozenEvaluate}=await import(pathToFileURL(resolve(runtime,'src/current-affairs/validator-v3/orchestrator.ts')).href)
  const replay=frozenEvaluate({observations:obs,clock:pred.run.clock,versions:pred.run.c.versions},[],[])
  assert.deepEqual(replay,pred.run)
  assert.deepEqual(frozenEvaluate({observations:[...obs].reverse(),clock:pred.run.clock,versions:pred.run.c.versions},[],[]),pred.run)
  const current=evaluateReading({observations:obs,clock:pred.run.clock,versions:pred.run.c.versions},[],[])
  assert.deepEqual(evaluateReading({observations:[...obs].reverse(),clock:pred.run.clock,versions:pred.run.c.versions},[],[]),current)
  assert.equal(resolve(dir,'..'),resolve(tmpdir()),'Cleanup stays under the explicit temporary root')
  assert(dir.startsWith(join(tmpdir(),'owner-frozen-runtime-')))
  rmSync(dir,{recursive:true,force:true})
})
test('missing or fabricated source observations cannot satisfy frozen captured evidence',()=>{
  assert.throws(()=>validateImport(input,frozen,obs.slice(1)))
  for(const mutate of [o=>o[0].metadataHash='0'.repeat(64),o=>o[0].metadata.title+=' invented',o=>o[0].sourceId='invented',o=>o[0].capturedAt='2026-10-07T11:00:00.000Z']){
    const copy=structuredClone(obs);mutate(copy);assert.throws(()=>validateImport(input,frozen,copy))
  }
})
test('natural group diagnostics preserve owner equivalence and distinct reading needs',()=>{
  const stories=read(ROOT+'/story-assessment.json').groups
  assert.equal(stories.find(g=>g.group.startsWith('nobel-chemistry')).pairs.filter(p=>p.result!=='pass').length,0)
  assert.equal(stories.find(g=>g.group.startsWith('nobel-physics')).pairs.filter(p=>p.result!=='pass').length,3)
  assert.equal(stories.find(g=>g.group.startsWith('rbi-')).actualUnits,4)
})
test('frozen output refuses overwrite and SHA-256 detects corruption and extra files',()=>{
  assert.throws(()=>generate('unused',ROOT),/already exists/)
  const dir=mkdtempSync(join(tmpdir(),'owner-validation-'));writeFileSync(join(dir,'input.json'),'{}\n');seal(dir);assert.equal(verify(dir),1)
  writeFileSync(join(dir,'extra.json'),'{}');assert.throws(()=>verify(dir));
  const other=mkdtempSync(join(tmpdir(),'owner-validation-'));writeFileSync(join(other,'input.json'),'{}\n');seal(other);writeFileSync(join(other,'input.json'),'[]\n');assert.throws(()=>verify(other))
})
