/** Offline release diagnostics. Never writes earlier freezes or reads a sealed holdout. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { evaluateReading } from '../../../src/current-affairs/validator-v3/orchestrator.ts'
import { stageCVersions } from './stage-c-runner.ts'
import { digest } from './core.ts'
const root = 'docs/release-candidate', cache = 'tools/news/.cache/release-candidate'
mkdirSync(root, { recursive: true }); mkdirSync(cache + '/tmp', { recursive: true })
const read = p => JSON.parse(readFileSync(p, 'utf8'))
const hash = p => createHash('sha256').update(readFileSync(p)).digest('hex')
const write = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + '\n')
const parent = '6d88835e275fd97d0f5ebd21908d75992630eb66'
const packageRoot = read('tools/news/evaluation/calibration-gold-v1/provenance.json').sourcePackage
const clock = read(packageRoot + '/frozen-v2/predictions.json').clock
const datasets = {
  owner25: read('docs/owner-validation-v1/observations.json'),
  calibration50: read('tools/news/evaluation/calibration-gold-v1/observations.json'),
  historical1000: read(packageRoot + '/observations.json'),
}
const mode = process.argv[2]
if (mode === 'blind') {
  const sample = read(root + '/blind-review-v2/sample.json'), freeze = read(root + '/blind-review-v2/hashes.json')
  assert.equal(hash(root + '/blind-review-v2/sample.json'), freeze.sampleSha256)
  const ids = new Set(sample.records.flatMap(r => r.observations))
  const observations = datasets.historical1000.filter(o => ids.has(o.id))
  assert.equal(new Set(observations.map(o=>o.metadata.url)).size, 50)
  const input = { observations, clock, versions: stageCVersions(observations[0].registryHash) }
  const run = evaluateReading(input, [], [])
  assert.deepEqual(evaluateReading({...input,observations:[...observations].reverse()},[],[]),run)
  write(cache + '/blind-v2-machine-predictions.json',run)
  write(root + '/blind-evaluation-status-v2.json',{sampleSha256:freeze.sampleSha256,articles:50,decisions:Object.fromEntries(['accepted','rejected','deferred'].map(s=>[s,run.c.articles.filter(a=>a.decision===s).length])),independentHumanLabels:0,independentMetrics:null,qualityGate:'BLOCKED: blind human review pending; previously machine-evaluated historical corpus is not a sealed future holdout',predictionsLocation:cache+'/blind-v2-machine-predictions.json',reviewerAssetsContainPredictions:false})
  console.log('Frozen blind package verified; machine diagnostics kept outside reviewer directory.')
}
if (mode === 'baseline') {
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), parent)
  assert(!existsSync(root + '/baseline.json'))
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
  write(root + '/parent-hashes.json', { parent, files: files.map(path => ({ path, sha256: hash(path) })) })
  const original = 'C:/Users/hario/Downloads/Atlas-News'
  const git = args => execFileSync('git', ['-C', original, ...args], { encoding: 'utf8' }).trimEnd()
  const status = git(['status', '--short', '--untracked-files=all']).split(/\r?\n/).filter(Boolean)
  write(root + '/original-before.json', { root: original, head: git(['rev-parse', 'HEAD']), status, files: status.map(s => s.slice(3).replace(/^"|"$/g, '')).filter(p => existsSync(original + '/' + p)).map(path => ({ path, sha256: hash(original + '/' + path) })) })
}
if (mode === 'baseline' || mode === 'after') {
  const outputs = {}
  for (const [name, observations] of Object.entries(datasets)) {
    const input = { observations, clock, versions: stageCVersions(observations[0].registryHash) }
    const run = evaluateReading(input, [], [])
    assert.deepEqual(evaluateReading({ ...input, observations: [...observations].reverse() }, [], []), run)
    outputs[name] = { inputHash: digest(observations), outputHash: digest(run), reverseOrderEqual: true, clock, observations: observations.length,
      decisions: run.articles.map(a => { const c = run.c.articles.find(c => c.url === a.item.url); const u = run.stories.units.find(u => u.members.some(m => m.url === a.item.url)); return { url: a.item.url, title: a.item.title, decision: c.decision, subject: a.subject.primary, tier: c.relevance.status, reasons: c.eligibility.reasonCodes, unit: u?.id ?? null, angle: u?.frame.angle ?? null, action: u?.frame.action ?? null } }),
      today: run.selection.today.map(r => ({ id: r.unit.id, primary: r.primary.item.url, members: r.unit.members.map(m => m.url) })), diagnostics: run.selection.diagnostics }
    write(cache + '/' + mode + '-' + name + '.json', run)
  }
  if (mode === 'baseline') {
    const frozen = read('docs/owner-validation-v1/predictions.json')
    // Frozen export wraps the complete run; compare semantic decisions below as well.
    const committed = frozen.run ?? frozen
    if (committed.c) assert.deepEqual(outputs.owner25.decisions.map(r => [r.url, r.decision]), committed.c.articles.map(r => [r.url, r.decision]))
    const owner = read('docs/owner-validation-v1/owner-review.original.json').records
    const positives = owner.filter(r => ['useful', 'must_read'].includes(r.annotation.value))
    assert.equal(positives.filter(r => outputs.owner25.decisions.find(a => a.url === r.metadata.url).decision === 'accepted').length, 17)
    assert.equal(owner.filter(r => r.annotation.value === 'reject').filter(r => outputs.owner25.decisions.find(a => a.url === r.metadata.url).decision === 'deferred').length, 5)
  }
  write(root + '/' + mode + '.json', outputs)
  console.log(JSON.stringify(Object.fromEntries(Object.entries(outputs).map(([k,v]) => [k, {articles:v.decisions.length,accepted:v.decisions.filter(a=>a.decision==='accepted').length,deferred:v.decisions.filter(a=>a.decision==='deferred').length,today:v.today.length,outputHash:v.outputHash}]))))
}
if (mode === 'preserve') {
  const allowed = ['.gitattributes','src/current-affairs/validator-v3/policy.ts','src/current-affairs/validator-v3/evidence.ts','src/current-affairs/validator-v3/subject.ts','src/current-affairs/validator-v3/stories.ts','src/current-affairs/validator-v3/runtime-manifest.ts','src/features/current-affairs/usePersonalState.ts','src/features/current-affairs/useNewsModel.ts','tools/news/build-validator-manifest.ts','tools/news/evaluation/owner-validation.test.mjs','tools/browser/sync-check.mjs']
  const initial = read(root + '/parent-hashes.json')
  for(const f of initial.files)if(!allowed.includes(f.path))assert.equal(hash(f.path),f.sha256,'Unauthorized tracked change: '+f.path)
  const original = read(root + '/original-before.json'), git=args=>execFileSync('git',['-C',original.root,...args],{encoding:'utf8'}).trimEnd()
  assert.equal(git(['rev-parse','HEAD']),original.head)
  assert.deepEqual(git(['status','--short','--untracked-files=all']).split(/\r?\n/).filter(Boolean),original.status)
  for(const f of original.files)assert.equal(hash(original.root+'/'+f.path),f.sha256,'Original checkout: '+f.path)
  const provenance=read('docs/owner-validation-v1/provenance.json')
  for(const f of provenance.sourceProtectedFiles)assert.equal(hash(provenance.sourcePackage+'/'+f.path),f.sha256,'External frozen corpus: '+f.path)
  const frozenManifest=read('docs/release/protected-hashes.json')
  for(const f of frozenManifest.files){
    if(allowed.includes(f.path))assert.equal(createHash('sha256').update(execFileSync('git',['show','b30ef74cfd3b923940cd5968877452c99ca0bac8:'+f.path])).digest('hex'),f.sha256,'Original release commitment: '+f.path)
    else assert.equal(hash(f.path),f.sha256,'Frozen protected file: '+f.path)
  }
  for(const dir of ['blind-review','blind-review-v2']){const f=read(root+'/'+dir+'/hashes.json');assert.equal(hash(root+'/'+dir+'/sample.json'),f.sampleSha256);assert.equal(hash(root+'/'+dir+'/index.html'),f.htmlSha256)}
  const h3Paths=['src/current-affairs/reader/highlights','src/sync/highlights-engine.ts','src/sync/highlights-transport.ts','src/sync/highlights-protocol.ts','src/sync/highlights-d1.ts','functions/api/highlights-sync.ts','migrations/0002_highlights.sql','src/features/current-affairs/HighlightsLibrary.tsx','src/features/current-affairs/useHighlightLibrary.ts']
  assert.equal(execFileSync('git',['diff','82926e114f1af10302d568ceb5ee2fa40cdfa632','--',...h3Paths],{encoding:'utf8'}),'','H3 core must remain exact')
  write(root+'/preservation.json',{parent,unchangedTrackedFiles:initial.files.length-allowed.length,authorizedExistingReplacements:allowed,oldManifestFiles:frozenManifest.files.length,oldManifestPreserved:true,externalSourceCommitments:provenance.sourceProtectedFiles.length,originalHead:original.head,originalStatusRows:original.status.length,originalFileHashes:original.files.length,originalHeadStatusAndHashesMatch:true,H3CoreDiffEmpty:true,blindSampleHashesMatch:true,holdoutRead:false})
  console.log('Frozen packages, original checkout, H3 core, and scoped runtime replacements verified.')
}
