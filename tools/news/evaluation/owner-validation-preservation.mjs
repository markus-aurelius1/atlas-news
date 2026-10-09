/** Read-only verification of protected packages and original dirty checkout. */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { PARENT, ROOT, hash } from './owner-validation.mjs'
const read=p=>JSON.parse(readFileSync(p,'utf8'))
const p=read(ROOT+'/provenance.json')
for(const f of p.sourceProtectedFiles)assert.equal(hash(p.sourcePackage+'/'+f.path),f.sha256,f.path)
const prior=read('C:/Users/hario/.codex/worktrees/9498/Atlas-News/tools/news/.cache/release/original-before.json')
const originalRoot='C:/Users/hario/Downloads/Atlas-News'
const git=args=>execFileSync('git',args,{encoding:'utf8'}).trimEnd()
assert.equal(git(['-C',originalRoot,'rev-parse','HEAD']),prior.head)
assert.deepEqual(git(['-C',originalRoot,'status','--short','--untracked-files=all']).split(/\r?\n/),prior.status)
for(const f of prior.files)assert.equal(hash(originalRoot+'/'+f.path),f.sha256,'Original dirty file: '+f.path)
// Every pre-existing tracked file must remain unchanged, including H3 and frozen evidence.
assert.equal(git(['diff',PARENT,'--diff-filter=MDRT','--name-only']),'','Existing tracked files changed')
const manifest=read('docs/release/protected-hashes.json')
const replaced=['src/current-affairs/validator-v3/policy.ts','src/current-affairs/validator-v3/evidence.ts']
for(const f of manifest.files){
  if(replaced.includes(f.path))assert.equal(createHash('sha256').update(execFileSync('git',['show','b30ef74cfd3b923940cd5968877452c99ca0bac8:'+f.path])).digest('hex'),f.sha256)
  else assert.equal(hash(f.path),f.sha256,f.path)
}
const sourceFiles=['owner-validation.mjs','owner-validation-predict.mjs','owner-validation.test.mjs','owner-validation-report.mjs','owner-validation-checks.mjs','owner-validation-preservation.mjs'].map(n=>'tools/news/evaluation/'+n)
if(!process.argv.includes('--verify-only')) {
  assert(!existsSync(ROOT+'/sha256-manifest.json'), 'Package is sealed; never overwrite preservation evidence')
  writeFileSync(ROOT+'/PRESERVATION.json',JSON.stringify({mandatoryParent:PARENT,existingTrackedDiffEmpty:true,externalSourceProtectedFiles:p.sourceProtectedFiles.length,protectedManifestFiles:manifest.files.length,oldRuntimeCommitmentsVerifiedFromOriginalGit:replaced,originalHead:prior.head,originalStatusRows:prior.status.length,originalDirtyFileHashes:prior.files.length,originalMatchesPriorReadOnlyCapture:true,H3ReaderSyncUnchanged:true,original50CalibrationUnchanged:true,frozenCoverageEvidenceUnchanged:true,holdoutOpened:false,toolHashes:sourceFiles.map(path=>({path,sha256:hash(path)}))},null,2)+'\n')
}
console.log('Original dirty checkout, external frozen source, all existing tracked files and H3 preservation verified.')
