/** Owner-ratified model labels remain separate from blind predictions and human authorship. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Ajv } from 'ajv'
import { digest, instant } from './core.ts'
import { validateObservation } from './validate.ts'
import { equivalentDevelopment, buildStories } from '../../../src/current-affairs/validator-v3/stories.ts'
import { chooseRepresentative } from '../../../src/current-affairs/validator-v3/selection.ts'

export const PARENT = '68657d47a62257a5bff572f2fbd520af5462c0c3'
export const ROOT = 'docs/owner-validation-v1'
const CACHE = 'tools/news/.cache/owner-validation'
const read = p => JSON.parse(readFileSync(p, 'utf8'))
export const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex')
const write = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + '\n')
const subjects = ['Polity','Governance','Economy','International relations','Security','Sci-Tech','Environment','Geography','History & Culture','Unresolved']
const nullable = schema => ({ anyOf: [schema, { type: 'null' }] })
const str = { type: 'string', minLength: 1 }
const annotationSchema = { type: 'object', additionalProperties: false,
  required: ['reviewerId','reviewedAt','value','primarySubject','metadataSufficiency','storyGroup','distinctAngle','rationale'],
  properties: { reviewerId: str, reviewedAt: nullable({ type: 'string', format: 'utc-instant' }), value: { enum: ['must_read','useful','reject','unresolvable'] },
    primarySubject: { enum: subjects }, metadataSufficiency: { enum: ['sufficient','limited','insufficient'] }, storyGroup: nullable({ type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' }), distinctAngle: nullable({ enum: ['yes','no','uncertain'] }), rationale: str } }
export const schema = { $schema: 'http://json-schema.org/draft-07/schema#', type: 'object', additionalProperties: false, required: ['version','records','ownerValidation'],
  properties: { version: { const: 'tars-coverage-owner-review/1' }, records: { type: 'array', minItems: 25, maxItems: 25, items: { type: 'object', additionalProperties: false, required: ['id','metadata','capturedObservations','annotation'], properties: {
    id: { type: 'string', pattern: '^article:[a-f0-9]{64}$' }, metadata: { $ref: 'https://tars.local/evaluation/gold-v1#/$defs/metadata' }, annotation: annotationSchema,
    capturedObservations: { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: false, required: ['id','capturedAt','metadata'], properties: { id: str, capturedAt: { type: 'string', format: 'utc-instant' }, metadata: { $ref: 'https://tars.local/evaluation/gold-v1#/$defs/metadata' } } } }
  } } }, ownerValidation: { type: 'object', additionalProperties: false, required: ['status','ownerReviewerId','validatedArticleIds','validatedCount','validatedAt','originalReviewer','sourceHtmlSha256'], properties: {
    status: { const: 'all_reviewed' }, ownerReviewerId: { const: 'Marcus' }, validatedArticleIds: { type: 'array', minItems: 25, maxItems: 25, uniqueItems: true, items: str }, validatedCount: { const: 25 }, validatedAt: { type: 'string', format: 'utc-instant' }, originalReviewer: str, sourceHtmlSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' }
  } } } }
const ajv = new Ajv({ allErrors: true, strict: false })
ajv.addFormat('utc-instant', { type: 'string', validate: v => { try { instant(v); return true } catch { return false } } })
ajv.addFormat('article-url', { type: 'string', validate: v => /^https?:\/\//.test(v) })
ajv.addSchema(read('tools/news/evaluation/schema.json'))
const check = ajv.compile(schema)
export function validateImport(input, frozen, observations) {
  assert(check(input), JSON.stringify(check.errors))
  assert.equal(new Set(input.records.map(r => r.id)).size, 25, 'Duplicate article ID')
  assert.deepEqual(input.records.map(r => r.id).sort(), frozen.records.map(r => r.id).sort(), 'Frozen 25 IDs')
  assert.deepEqual([...input.ownerValidation.validatedArticleIds].sort(), input.records.map(r => r.id).sort(), 'Attestation ID coverage')
  assert.equal(input.ownerValidation.sourceHtmlSha256, hash('docs/coverage-recovery/OWNER_REVIEW.html'), 'Owner attestation references another review HTML')
  for (const r of input.records) {
    const f = frozen.records.find(f => f.id === r.id)
    assert.equal(r.id, f.id, 'Frozen namespace-bound article identity')
    assert.deepEqual(r.metadata, f.metadata, 'Metadata drift: ' + r.id)
    assert.deepEqual(r.capturedObservations, f.capturedObservations, 'Observation drift: ' + r.id)
    assert.equal(r.annotation.reviewerId, input.ownerValidation.originalReviewer, 'Preserve model reviewer')
    assert.equal(r.annotation.reviewedAt, null, 'Do not invent independent model review time')
    assert.equal(r.annotation.distinctAngle === null, r.annotation.storyGroup === null, 'Group/angle relationship')
    assert(r.capturedObservations.every(o => instant(o.capturedAt) <= instant(input.ownerValidation.validatedAt)), 'Validation precedes evidence')
    const source = observations.filter(o => o.metadata.url === r.metadata.url)
    source.forEach(validateObservation)
    assert.deepEqual(source.map(o => ({ id: o.id, capturedAt: o.capturedAt, metadata: o.metadata })), r.capturedObservations, 'Captured package membership')
  }
  for (const group of new Set(input.records.map(r => r.annotation.storyGroup).filter(Boolean))) {
    assert(input.records.filter(r => r.annotation.storyGroup === group).length >= 2, 'Story group needs related cases')
    assert(input.records.some(r => r.annotation.storyGroup === group && r.annotation.distinctAngle === 'no'), 'Story group needs a base report')
  }
  assert.deepEqual(Object.fromEntries(['must_read','useful','reject'].map(v => [v, input.records.filter(r => r.annotation.value === v).length])), { must_read: 8, useful: 12, reject: 5 })
  return observations.filter(o => input.records.some(r => r.metadata.url === o.metadata.url))
}
export function outcome(value, decision) {
  if (value === 'unresolvable') return 'unresolved_gold'
  if (decision === 'deferred') return value === 'reject' ? 'deferred_negative' : 'deferred_positive'
  return ['must_read','useful'].includes(value) ? decision === 'accepted' ? 'TP' : 'FN' : decision === 'accepted' ? 'FP' : 'TN'
}
export function metrics(rows) {
  const n = k => rows.filter(r => r.result === k).length
  const tp = n('TP'), fp = n('FP'), fn = n('FN'), tn = n('TN'), dp = n('deferred_positive'), dn = n('deferred_negative')
  const must = rows.filter(r => r.gold === 'must_read')
  return { TP: tp, FP: fp, FN: fn, TN: tn, deferredPositive: dp, deferredNegative: dn, decided: tp + fp + fn + tn, total: rows.length,
    precision: tp + fp ? tp / (tp + fp) : null, decidedRecall: tp + fn ? tp / (tp + fn) : null,
    positiveRetention: tp + fn + dp ? tp / (tp + fn + dp) : null,
    mustRead: { total: must.length, accepted: must.filter(r => r.decision === 'accepted').length, rejected: must.filter(r => r.decision === 'rejected').length, deferred: must.filter(r => r.decision === 'deferred').length, todayMembers: must.filter(r => r.todayMember).length, todayPrimaries: must.filter(r => r.todayPrimary).length } }
}
export function inventory(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? inventory(join(dir, e.name)) : [join(dir, e.name)]).sort()
}
export function seal(dir) {
  assert(!existsSync(join(dir, 'sha256-manifest.json')), 'Already sealed')
  write(join(dir, 'sha256-manifest.json'), { algorithm: 'SHA-256', files: inventory(dir).map(p => ({ path: p.slice(dir.length + 1).replaceAll('\\','/'), sha256: hash(p) })) })
  writeFileSync(join(dir, 'sha256-manifest.sha256'), hash(join(dir,'sha256-manifest.json')) + '  sha256-manifest.json\n')
}
export function verify(dir = ROOT) {
  const m = read(join(dir,'sha256-manifest.json'))
  assert.equal(readFileSync(join(dir,'sha256-manifest.sha256'),'utf8'), hash(join(dir,'sha256-manifest.json')) + '  sha256-manifest.json\n')
  assert.deepEqual(inventory(dir).map(p => p.slice(dir.length + 1).replaceAll('\\','/')).filter(p => !p.startsWith('sha256-manifest.')), m.files.map(f => f.path))
  for (const f of m.files) assert.equal(hash(join(dir,f.path)), f.sha256, f.path)
  return m.files.length
}
export function generate(inputPath, output = ROOT) {
  assert(!existsSync(output), 'Output already exists; never overwrite frozen evidence')
  assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(), PARENT)
  const sourceProvenance = read('tools/news/evaluation/calibration-gold-v1/provenance.json')
  for (const f of sourceProvenance.protectedFiles) assert.equal(hash(join(sourceProvenance.sourcePackage,f.path)), f.sha256, f.path)
  const all = read(join(sourceProvenance.sourcePackage,'observations.json'))
  const frozen = read('docs/coverage-recovery/OWNER_REVIEW.json'), input = read(inputPath)
  const observations = validateImport(input, frozen, all)
  const calibrationUrls = new Set(read('tools/news/evaluation/calibration-gold-v1/gold.json').records.map(r => r.record.metadata.url))
  assert(input.records.every(r => !calibrationUrls.has(r.metadata.url)), 'Original calibration overlaps')
  mkdirSync(output,{recursive:true}); mkdirSync(CACHE,{recursive:true})
  copyFileSync(inputPath, join(output,'owner-review.original.json'))
  copyFileSync('docs/coverage-recovery/OWNER_REVIEW.json', join(output,'frozen-review.original.json'))
  copyFileSync('tools/news/evaluation/schema.json',join(output,'metadata-schema.json'))
  write(join(output,'input-schema.json'), schema)
  write(join(output,'observations.json'), observations)
  write(join(output,'owner-attestation.json'), { version: 'tars-owner-ratification/v1', ...input.ownerValidation, inputSha256: hash(inputPath), frozenReviewSha256: hash('docs/coverage-recovery/OWNER_REVIEW.json'), authorship: '25 model-origin annotations individually owner-ratified; zero independently human-authored annotations', signature: 'Imported attestation, not a cryptographic owner signature; sourceHtmlSha256 retained as supplied' })
  const clock = sourceProvenance.replay.clock
  const predict = (cwd, input, output) => execFileSync(process.execPath, [resolve(cwd,'tools/news/evaluation/owner-validation-predict.mjs'),resolve(input),clock,resolve(output)],{cwd,stdio:['ignore','ignore','inherit']})
  // The runner imports only captured observations. Labels join after all four blind runs finish.
  predict('.',join(output,'observations.json'),join(output,'predictions.json'))
  predict('.',join(sourceProvenance.sourcePackage,'observations.json'),CACHE+'/wider-current.json')
  const baseline = resolve(CACHE,'baseline')
  mkdirSync(baseline,{recursive:true})
  execFileSync('git',['archive','--format=zip','-o',resolve(CACHE,'baseline.zip'),'b30ef74cfd3b923940cd5968877452c99ca0bac8','src','tools/news/evaluation','public/current-affairs/v2/relevance-index.json'])
  execFileSync('tar',['-xf',resolve(CACHE,'baseline.zip'),'-C',baseline])
  copyFileSync('tools/news/evaluation/owner-validation-predict.mjs',join(baseline,'tools/news/evaluation/owner-validation-predict.mjs'))
  predict(baseline,join(output,'observations.json'),join(output,'predictions-before-recovery.json'))
  predict(baseline,join(sourceProvenance.sourcePackage,'observations.json'),CACHE+'/wider-before.json')
  assert.equal(baseline, resolve(CACHE,'baseline'), 'Archive cleanup stays in the task cache')
  rmSync(baseline,{recursive:true,force:true})
  const current = read(join(output,'predictions.json')).run, before = read(join(output,'predictions-before-recovery.json')).run
  const wider = read(CACHE+'/wider-current.json').run, oldWider = read(CACHE+'/wider-before.json').run
  const shadow = read('docs/coverage-recovery/DECISION_FUNNEL.json')
  for (const [run, prior] of [[wider,shadow.after.wider],[oldWider,shadow.before.wider]]) {
    assert.equal(run.articles.length,prior.articles.length)
    for (const a of run.articles) { const p = prior.articles.find(p => p.url === a.item.url); assert.equal(a.acceptance.decision,p.decision); assert.equal(a.subject.primary,p.subject) }
    assert.deepEqual(run.selection.today.map(r=>r.primary.item.url).sort(),prior.articles.filter(r=>r.todayPrimary).map(r=>r.url).sort())
  }
  const rowFor = (r, run, i) => {
    const a = run.articles.find(a => a.item.url === r.metadata.url), unit = run.stories.units.find(u => u.members.some(m=>m.url === r.metadata.url))
    const selected = run.selection.today.find(s=>s.unit.id === unit?.id), suppression = run.selection.suppressed.find(s=>s.id === unit?.id)
    const primary = unit ? chooseRepresentative(run.articles.filter(a=>unit.members.some(m=>m.url === a.item.url))).item : null
    const sections = [...new Set(r.metadata.memberships.map(m=>m.section))]
    return { number:i+1,id:r.id,url:r.metadata.url,title:r.metadata.title,publisher:r.metadata.publisher,sections,
      contentTypeProxy: /podcast/i.test(r.metadata.url+' '+r.metadata.title) ? 'podcast' : sections.some(s=>/opinion|editorial|column|analysis/i.test(s)) ? 'editorial_analysis' : sections.some(s=>/explained/i.test(s)) ? 'explainer' : 'news_or_other',
      gold:r.annotation.value,annotation:r.annotation,decision:a.acceptance.decision,result:outcome(r.annotation.value,a.acceptance.decision),relevance:a.acceptance.relevance.status,
      goldSubject:r.annotation.primarySubject,subject:a.subject.primary,subjectCorrect:r.annotation.primarySubject===a.subject.primary,subjectEvidence:a.subject,
      goldMetadataSufficiency:r.annotation.metadataSufficiency,metadataSufficiency:a.acceptance.metadataSufficiency,acceptance:a.acceptance,
      unitId:unit?.id??null,frame:unit?.frame??null,novelty:unit?.novelty??null,representative:primary?.url??null,
      todayMember:!!selected,todayPrimary:selected?.primary.item.url===r.metadata.url,suppression:suppression?.reason??null,
      rationale:r.annotation.rationale }
  }
  const rows = input.records.map((r,i)=>rowFor(r,current,i)), previousRows = input.records.map((r,i)=>rowFor(r,before,i)), contextRows = input.records.map((r,i)=>rowFor(r,wider,i))
  const groupBy = key => Object.fromEntries([...new Set(rows.map(r=>r[key]))].sort().map(v=>[v,metrics(rows.filter(r=>r[key]===v))]))
  const comparison = { sample: 'Enriched targeted nonrandom diagnostic; model-origin labels owner-ratified, not independent human authorship or production estimates', clock, history:'Cold start; no natural temporal truth inferred from publication timestamps', metrics:metrics(rows), beforeRecovery:metrics(previousRows), full1000Context:metrics(contextRows), byPublisher:groupBy('publisher'), byContentTypeProxy:groupBy('contentTypeProxy'),
    errors: { falsePositives:rows.filter(r=>r.result==='FP').map(r=>r.number), falseNegatives:rows.filter(r=>r.result==='FN').map(r=>r.number), deferredPositives:rows.filter(r=>r.result==='deferred_positive').map(r=>r.number), deferredNegatives:rows.filter(r=>r.result==='deferred_negative').map(r=>r.number), incorrectSubjects:rows.filter(r=>!r.subjectCorrect).map(r=>r.number), positiveIncorrectSubjects:rows.filter(r=>r.gold!=='reject'&&!r.subjectCorrect).map(r=>r.number), metadataLevelDisagreements:rows.filter(r=>r.goldMetadataSufficiency!==r.metadataSufficiency.level).map(r=>r.number) },
    changes: rows.map((r,i)=>({number:r.number,id:r.id,before:previousRows[i].decision,after:r.decision,beforeSubject:previousRows[i].subject,afterSubject:r.subject,resultBefore:previousRows[i].result,resultAfter:r.result})).filter(r=>r.before!==r.after||r.beforeSubject!==r.afterSubject), rows, previousRows, contextRows }
  comparison.negativeDecisionMetrics = { ownerRejectTotal: 5, decidedRejectCases: 0, deferredRejectCases: 5, decidedSpecificity: null, negativeDecisionCoverage: 0 }
  comparison.decisionCoverage = comparison.metrics.decided / comparison.metrics.total
  comparison.byGold = Object.fromEntries(['must_read','useful','reject'].map(k => [k, metrics(rows.filter(r=>r.gold===k))]))
  write(join(output,'comparison.json'),comparison)
  const groups = [...new Set(input.records.map(r=>r.annotation.storyGroup).filter(Boolean))].map(group=>{
    const members = rows.filter(r=>r.annotation.storyGroup===group), pairs=[]
    for (let i=0;i<members.length;i++) for (let j=i+1;j<members.length;j++) {
      const a=members[i],b=members[j],aa=current.articles.find(r=>r.item.url===a.url),bb=current.articles.find(r=>r.item.url===b.url)
      const expectedEquivalent=a.annotation.distinctAngle==='no'&&b.annotation.distinctAngle==='no'
      const actualEquivalent=!!a.unitId&&a.unitId===b.unitId
      pairs.push({left:a.number,right:b.number,expectedEquivalent,actualEquivalent,isolatedEquivalent:equivalentDevelopment(aa.item,bb.item),gatedByC:!a.unitId||!b.unitId,result:expectedEquivalent===actualEquivalent?'pass':expectedEquivalent?'split_or_C_loss':'inappropriate_merge'})
    }
    // E-only diagnostic includes deferred positives, expressly not a pipeline admission.
    const items=current.articles.filter(a=>members.some(r=>r.url===a.item.url)).map(a=>a.item)
    const isolated=buildStories(items.map(item=>({item,observedAt:Date.parse(clock),firstSeenAt:Date.parse(clock)})),[],[],Date.parse(clock))
    return {group,members:members.map(r=>({number:r.number,id:r.id,distinctAngle:r.annotation.distinctAngle,decision:r.decision,unitId:r.unitId,representative:r.representative,todayMember:r.todayMember,frame:r.frame,novelty:r.novelty,rationale:r.rationale})),expectedReadingNeeds:1+members.filter(r=>r.annotation.distinctAngle==='yes').length,actualUnits:new Set(members.map(r=>r.unitId).filter(Boolean)).size,actualTodayUnits:new Set(members.filter(r=>r.todayMember).map(r=>r.unitId)).size,pairs,isolatedUnits:isolated.units.map(u=>u.members.map(m=>members.find(r=>r.url===m.url).number))}
  })
  write(join(output,'story-assessment.json'),{clock,history:'cold_start',groups,separateMonetaryPolicyCases:rows.filter(r=>r.goldSubject==='Economy'&&!r.annotation.storyGroup).map(r=>({number:r.number,title:r.title,decision:r.decision,unitId:r.unitId,todayMember:r.todayMember,suppression:r.suppression,rationale:r.rationale})),limitations:'No human timeline or selected-history attestation supplied. Forecast supersession is an owner-stated conditional expectation, not tested temporal truth. E-only diagnostics bypass C for localization only.'})
  const runtimeFiles=execFileSync('git',['ls-files','src/current-affairs/validator-v3','src/current-affairs/sources.ts','src/current-affairs/types.ts','src/current-affairs/feed.ts'],{encoding:'utf8'}).trim().split(/\r?\n/)
  const provenance={parentCommit:PARENT,branch:'codex/validator-v3-owner-validation',preRecoveryCommit:'b30ef74cfd3b923940cd5968877452c99ca0bac8',inputSha256:hash(inputPath),frozenReviewSha256:hash('docs/coverage-recovery/OWNER_REVIEW.json'),frozenHtmlSha256:hash('docs/coverage-recovery/OWNER_REVIEW.html'),sourceHtmlHashMatchesFrozen:input.ownerValidation.sourceHtmlSha256===hash('docs/coverage-recovery/OWNER_REVIEW.html'),sourcePackage:sourceProvenance.sourcePackage,sourceProtectedFiles:sourceProvenance.protectedFiles,clock,observations:observations.length,authorship:{modelOrigin:25,ownerRatified:25,independentlyHumanAuthored:0},runtimeFiles:runtimeFiles.map(path=>({path,sha256:hash(path)})),blind:{runnerHasNoAnnotationInput:true,rulesUnchanged:true,reverseOrderEqual:true,full1000ArticleDecisionsSubjectsAndTodayRepresentativesMatchCommittedShadow:true},freeze:'SHA-256 commitments; no filesystem WORM or cryptographic owner signature',cost:'Existing local dependencies and captured metadata only; zero additional monetary expenditure'}
  write(join(output,'provenance.json'),provenance)
  const cols=['number','id','title','publisher','gold','decision','result','goldSubject','subject','subjectCorrect','goldMetadataSufficiency','unitId','representative','todayMember','todayPrimary','suppression','rationale']
  writeFileSync(join(output,'article-errors.tsv'),[cols.join('\t'),...rows.map(r=>cols.map(k=>String(r[k]??'').replaceAll('\t',' ').replaceAll('\n',' ')).join('\t'))].join('\n')+'\n')
  return {output,metrics:comparison.metrics,errors:comparison.errors,groups:groups.map(g=>({group:g.group,units:g.actualUnits,today:g.actualTodayUnits,pairs:g.pairs}))}
}
if (process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const [mode,input,output]=process.argv.slice(2)
  if(mode==='import') console.log(JSON.stringify(generate(input,output),null,2))
  else if(mode==='seal') { seal(input??ROOT); console.log(verify(input??ROOT)) }
  else if(mode==='verify') console.log(verify(input??ROOT))
  else throw Error('Usage: owner-validation.mjs import INPUT [NEW_OUTPUT] | seal [OUTPUT] | verify [OUTPUT]')
}
