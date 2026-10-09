/** Local existing dependencies only. All logs/output stay in this worktree. */
import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { hash } from './owner-validation.mjs'
assert(!existsSync('docs/owner-validation-v1/sha256-manifest.json'), 'Package is sealed; never overwrite verification')
const cache='tools/news/.cache/owner-validation'
mkdirSync(cache+'/tmp',{recursive:true})
const env={...process.env,TEMP:resolve(cache+'/tmp'),TMP:resolve(cache+'/tmp'),CHROMIUM_PATH:'C:/Users/hario/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe'}
const retry=process.argv.includes('--browser-retry')
const existing=retry?JSON.parse(readFileSync('docs/owner-validation-v1/VERIFICATION.json','utf8')):null
const failedAttempts=existing?.results.filter(r=>r.status==='FAIL')??[]
const results=existing?.results.filter(r=>r.status==='PASS')??[]
function run(name,args,overrides={}){
  const start=Date.now(),r=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:32*1024*1024,env:{...env,...overrides}})
  const log=cache+'/'+name+(retry?'-retry':'')+'.log';writeFileSync(log,(r.stdout??'')+(r.stderr??'')+(r.error?'\n'+r.error.message:''))
  const text=readFileSync(log,'utf8'),counts=[...text.matchAll(/(?:(?:#|ℹ) (?:tests|pass|fail|skipped) \d+|Test Files[^\n]*|Tests[^\n]*|\d+ controlled v3 browser checks passed|\d+[^\n]*checks passed|\d+ problems[^\n]*)/g)].map(m=>m[0])
  const row={name,status:r.status===0?'PASS':'FAIL',exitCode:r.status,elapsedMs:Date.now()-start,command:['node',...args],environmentOverrides:overrides,log,sha256:hash(log),summary:counts}
  results.push(row);console.log(JSON.stringify(row));writeFileSync('docs/owner-validation-v1/VERIFICATION.json',JSON.stringify({results,failedAttempts,limitations:['Local captured replay and synthetic browser fixtures do not certify natural temporal quality, devices, production publishers or hosted Access/D1.','Pipeline canonical-ZIP guards remain intact.',...(retry?['Initial browser launches were blocked by the Windows restricted token (exit 3221225506). Retried existing Chromium with authorized local escalation; no browser assertion changed.']:[])],productionReadiness:'BLOCKED'},null,2)+'\n')
}
if(!retry){
run('evaluation',['--test',...readdirSync('tools/news/evaluation').filter(n=>/\.test\.(ts|mjs)$/.test(n)).map(n=>'tools/news/evaluation/'+n)])
run('typecheck',['node_modules/typescript/bin/tsc','-b'])
run('lint',['node_modules/eslint/bin/eslint.js','src','tools/news','functions','vite.config.ts'])
run('root-tests',['node_modules/vitest/vitest.mjs','run'])
run('pipeline',['--test',...readdirSync('tools/atlas-build/test').filter(n=>n.endsWith('.test.mjs')).map(n=>'tools/atlas-build/test/'+n)])
// Both production build modes use the same authorized root build stages.
run('atlas-assets',['tools/build-atlas-assets.mjs'])
run('validator-manifest',['tools/news/build-validator-manifest.ts'])
run('v3-build',['node_modules/vite/bin/vite.js','build','--outDir','tools/news/.cache/owner-validation/dist-v3'],{VITE_NEWS_VALIDATOR:'v3'})
}
run('v3-browser',['tools/browser/validator-v3-check.mjs'],{CA_DIST:resolve(cache+'/dist-v3')})
if(!retry)
run('default-build',['node_modules/vite/bin/vite.js','build'])
run('default-browser',['tools/browser/news-check.mjs'])
if(results.some(r=>r.status!=='PASS'))process.exitCode=1
