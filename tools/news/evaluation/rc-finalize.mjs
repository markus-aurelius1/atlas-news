/** Consolidates actual local results; never executes or certifies external gates. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync } from 'node:fs'
import { dirname } from 'node:path'
const root='docs/release-candidate'
const read=p=>JSON.parse(readFileSync(p,'utf8'))
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex')
const write=(p,v)=>writeFileSync(p,JSON.stringify(v,null,2)+'\n')
const groups=['unit','combined','browser'].map(g=>({group:g,...read(root+'/checks-'+g+'.json')}))
const latest=groups.flatMap(g=>[...new Map(g.results.map(r=>[r.name,r])).values()].map(r=>({group:g.group,...r})))
assert(latest.every(r=>r.status==='PASS'),'Every latest local executable gate must pass')
const log=name=>readFileSync(latest.find(r=>r.name===name).log,'utf8')
assert(/Tests\s+800 passed/.test(log('root-tests')))
assert(/pass 85/.test(log('evaluation')))
assert(/pass 39/.test(log('pipeline'))&&/skipped 6/.test(log('pipeline')))
assert(/133 problems \(0 errors, 133 warnings\)/.test(log('lint')))
assert(/68 controlled v3 browser checks passed/.test(log('v3-browser')))
assert(/42 sync checks passed/.test(log('v3-h3-workerd')))
for(const r of groups.flatMap(g=>g.results))assert.equal(hash(r.log),r.sha256,'Log commitment: '+r.log)
const failedAttempts=groups.flatMap(g=>g.results.filter(r=>r.status!=='PASS').map(r=>({...r,excerpt:readFileSync(r.log,'utf8').split(/\r?\n/).slice(-35).join('\n')})))
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(dir+'/'+e.name):[dir+'/'+e.name])}
const browserEvidence=files('tools/browser/out').filter(p=>p.endsWith('.json')).map(path=>{
  const target=root+'/browser-evidence/'+path.slice('tools/browser/out/'.length)
  const result=read(path)
  mkdirSync(dirname(target),{recursive:true})
  if(path.includes('/label-visibility/'))write(target,{sourceFile:path,sourceSha256:hash(path),checks:result.checks,errors:result.errors,snapshotCount:result.snapshots.length,snapshotSha256:createHash('sha256').update(JSON.stringify(result.snapshots)).digest('hex'),snapshotLocation:'Full layout snapshots remain in the local ignored source result; all assertions are retained here'})
  else copyFileSync(path,target)
  return {path:target,sha256:hash(target),checks:Array.isArray(result.checks)?result.checks.length:null,errors:result.errors??null}
})
const temporal=read(root+'/temporal-procedure-smoke.json')
assert.equal(temporal.consecutive,false);assert.equal(temporal.continuousHealthCertified,false)
const preserved=read(root+'/preservation.json')
assert(preserved.originalHeadStatusAndHashesMatch&&preserved.H3CoreDiffEmpty&&preserved.blindSampleHashesMatch)
write(root+'/final-verification.json',{
  status:'BLOCKED for activation/publication; local executable gates pass',
  parent:preserved.parent,branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),
  latest,failedAttempts,browserEvidence,
  counts:{rootTests:800,rootFiles:59,evaluationTests:85,pipelinePass:39,pipelineGuardedSkips:6,lintErrors:0,lintWarnings:133,v3BrowserChecks:68,v3H3WorkerdChecks:42,offlineReviewerChecks:20},
  preservation:preserved,temporalProcedureSmoke:{days:temporal.days,consecutive:temporal.consecutive,continuousHealthCertified:false},
  independentHumanMetrics:null,
  blockedGates:['Independent owner review of frozen blind v2 package','Untouched future evaluation required by frozen specification','Real consecutive-day temporal/source health evidence','Physical-device and hosted identity/D1/publisher preflight','Six external canonical-ZIP guarded pipeline cases'],
  defaultValidator:'v2',remoteOperations:false,paidServices:false,dependencyDownloads:false,
  detailedLogs:'tools/news/.cache/release-candidate (local ignored); exact log commitments and failed excerpts preserved here'
})
const rows=latest.map(r=>`| ${r.name} | ${r.status} | ${r.summary.join('; ')||'Exit 0; see hashed log commitment'} |`).join('\n')
writeFileSync(root+'/FINAL_VERIFICATION.md',`# Final local verification\n\n**BLOCKED for activation/publication.** All locally executable gates pass on the combined candidate. Independent editorial, untouched future evaluation, consecutive-day temporal and physical-device/hosted evidence are unavailable. V3 remains disabled by default. No push, merge, remote migration, remote CI, deployment, paid API or billing operation was performed. Existing local dependencies and installed Chromium/Wrangler were used without downloads.\n\n| Gate | Latest result | Evidence |\n| --- | --- | --- |\n${rows}\n\nRoot tests: **800/800**, 59 files. Offline evaluation: **85/85**, including exact original-runtime frozen replay and current permutation checks. Pipeline: **39 pass, six guarded skips** because the external canonical ZIP is absent; these cases are unverified, not passing. Lint: **zero errors, 133 existing warnings**. Combined controlled v3 browser: **68 checks**. Real local workerd/ephemeral D1 plus H3/general sync: **42 checks**, applying both actual additive migration files, including the unchanged 1,510-row assertion, offline reconnect, account isolation, tombstones, authentication, body-free payloads and idle-query bounds. The offline blind reviewer passed **20 interface checks**; these automated interactions created no editorial labels.\n\nThe full default-build browser umbrella covers smoke, bundled Atlas/cold start/labels/recall, learning light/dark, News cache/Archive, Reader navigation/paywall links, Highlights selection/anchoring/colors/deletion/responsiveness and library. Its per-suite result records are preserved under browser-evidence/ and summarized in final-verification.json. A final v2 build was restored after combined v3 tests.\n\n## Genuine failed attempts and resolution\n\nEarlier failures remain in checks-*.json and final-verification.json with log hashes and excerpts. The first v3 sync fixture lacked metadata sufficient for its expected accepted rows; opt-in v3 synthetic descriptions now expose the required propositions, while all original assertions and default fixtures remain intact. Subsequent unchanged assertions uncovered two real integration defects: Save uploaded 1,508 instead of 1,510 rows, and pre-existing Saved metadata was unavailable to another device. Explicit Save metadata retention and recovery of available feed metadata for older Saved marks fixed both; all 42 assertions then passed.\n\nA combined browser run timed out during an unchanged Chromium reload while root checks were running concurrently. Its failure is retained; the same 68 checks passed when rerun without that competing suite. A sandbox network attempt could not reach RSS endpoints; the single actual direct public wave succeeded under authorized read-only network access. The first temporal-procedure smoke rejected a six-source registry hash through the full-registry-only adapter; the helper now validates the actual full/six-source allowlist and preserves capture-slice provenance alongside pinned runtime commitments. It successfully replayed the real October 7 partial shard and October 9 six-feed wave, reporting **non-consecutive dates and no continuous-health certification**.\n\n## Integrity and limits\n\nBaseline owner25 hash reproduced before rules changed: d91700f3f0dfe54ab9a401d054cd6b364ee030ed795c51d35b1224bd0a833a69. The three original evaluation cutoffs remain 2026-10-07T13:40:55.600Z. Original 50 judgments/predictions and earlier specifications/handoffs are unchanged. ${preserved.unchangedTrackedFiles} existing tracked files, ${preserved.oldManifestFiles} frozen release commitments, ${preserved.externalSourceCommitments} external source commitments, original dirty checkout HEAD/status/${preserved.originalFileHashes} file hashes, exact H3 core and both blind sample/HTML commitments were checked. Artifact hashes and scoped -text attributes preserve candidate evidence bytes; the staging procedure compares each staged blob with its working-file bytes before the single commit.\n\nThe new #10 Chemistry tier disagreement is disclosed in EDITORIAL_BEFORE_AFTER.md. No negative admissions appear in either exposed owner diagnostic set; unseen errors remain unmeasured. The final 50-article/ten-comparison review remains unanswered and has no independent metrics. IE governance staleness and absent IE descriptions are acquisition limitations. Two capture dates and local Chromium identities cannot certify fourteen healthy days, Samsung/S-Pen behavior, hosted Access/D1 or production publisher responses.\n\n## Candidate identity and handoff\n\nMandatory parent: ${preserved.parent}. Branch: codex/validator-v3-release-candidate. Resolve the single final local commit with git log -1 --format=%H -- docs/release-candidate/FINAL_VERIFICATION.md; its exact SHA and clean-worktree check are reported in the delivery message. CHANGED_FILES.txt is the reviewed staging manifest. See BLIND_REVIEW_HANDOFF.md for the one consolidated editorial review and RELEASE_CANDIDATE_CHECKLIST.md for the remaining device/hosted actions, additive migration order and non-destructive rollback.\n`)
writeFileSync(root+'/FINAL_VERIFICATION.md',readFileSync(root+'/FINAL_VERIFICATION.md','utf8')+'\nPhone 375px dark and desktop 1366px light Highlights-library screenshots, v3 Today and offline reviewer layouts were visually inspected. Label-visibility evidence preserves all 90 assertions and hashes of the 78 full layout snapshots; bulky snapshots remain in the local ignored browser output. The staging-byte verifier initially exceeded its output buffer on a large JSON artifact; increasing the read buffer preserves the exact comparison. Its whitespace check caught CRLF in the new temporal report; that derived report was normalized to LF before its final hash freeze. Captured inputs and blind freezes were unchanged.\n')
// Create manifest paths first so they are included in their own reviewed scope.
writeFileSync(root+'/CHANGED_FILES.txt','');write(root+'/artifact-hashes.json',{})
const git=args=>execFileSync('git',args,{encoding:'utf8'}).split('\0').filter(Boolean)
const changed=[...new Set([...git(['diff','HEAD','--name-only','-z']),...git(['ls-files','--others','--exclude-standard','-z'])])].sort()
assert(changed.every(p=>p.startsWith(root+'/')||p.startsWith('tools/news/evaluation/rc-')||p==='tools/news/evaluation/release-candidate.mjs'||p==='tools/browser/rc-review-check.mjs'||p.endsWith('/final-corrections.test.ts')||p.endsWith('/usePersonalState.test.tsx')||preserved.authorizedExistingReplacements.includes(p)),'Unreviewed staging scope')
writeFileSync(root+'/CHANGED_FILES.txt',changed.join('\n')+'\n')
write(root+'/artifact-hashes.json',{algorithm:'sha256',scope:'Exact candidate evidence bytes, excluding this self-referential manifest',files:files(root).filter(p=>p!==root+'/artifact-hashes.json').sort().map(path=>({path,sha256:hash(path)}))})
console.log(JSON.stringify({localGates:'PASS',release:'BLOCKED',changedFiles:changed.length,browserEvidence:browserEvidence.length,failedAttempts:failedAttempts.length}))
