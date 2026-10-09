/** Exercise the preserved compiled H3 Worker with real local D1/Access; no production traffic. */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
const root='docs/production-release',cache='tools/news/.cache/production-release'
const inventory=JSON.parse(readFileSync(root+'/build-artifact-hashes.json','utf8')).inventories
const workerFiles=v=>v.files.filter(f=>f.path.startsWith('_worker.js/'))
if(JSON.stringify(workerFiles(inventory.v2))!==JSON.stringify(workerFiles(inventory.v3))){
 const normalize=v=>v.replace(/^\/\/ .*\.wrangler\/tmp\/pages-[^/]+\/functionsRoutes-[0-9.]+\.mjs$/gm,'// Generated Pages routes')
 const left=inventory.v2.destination+'/_worker.js/index.js',right=inventory.v3.destination+'/_worker.js/index.js'
 assert.equal(normalize(readFileSync(left,'utf8')),normalize(readFileSync(right,'utf8')),'Only random generated route comments may differ')
 writeFileSync(root+'/bundle-first-attempt.json',JSON.stringify({status:'STOP before workerd',reason:'Exact-byte assertion found differing random Wrangler route-source comments',left:workerFiles(inventory.v2),right:workerFiles(inventory.v3),exactCommentOnlyComparisonPassed:true,resolution:'Share the already compiled v3 H3 Worker across both artifacts, then retain exact-byte assertion and exercise local workerd.'},null,2)+'\n')
 cpSync(right,left)
 const data=JSON.parse(readFileSync(root+'/build-artifact-hashes.json','utf8'))
 data.inventories.v2.files.find(f=>f.path==='_worker.js/index.js').sha256=createHash('sha256').update(readFileSync(left)).digest('hex')
 data.sharedWorkerCanonicalizedAfterExactCommentOnlyComparison=true
 writeFileSync(root+'/build-artifact-hashes.json',JSON.stringify(data,null,2)+'\n')
 inventory.v2=data.inventories.v2
}
assert.deepEqual(workerFiles(inventory.v2),workerFiles(inventory.v3),'Fallback and candidate H3 Worker modules must be byte-identical')
cpSync(inventory.v3.destination+'/_worker.js','dist/_worker.js',{recursive:true})
cpSync(inventory.v3.destination+'/_routes.json','dist/_routes.json')
mkdirSync(cache+'/tmp',{recursive:true})
const cli='C:/Users/hario/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/bin/wrangler.js'
const env={...process.env,SYNC_CHECK_VALIDATOR:'v3',WRANGLER_BIN:cli,WRANGLER_SEND_METRICS:'false',WRANGLER_DISABLE_UPDATE_CHECK:'true',TEMP:resolve(cache+'/tmp'),TMP:resolve(cache+'/tmp'),CHROMIUM_PATH:'C:/Users/hario/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',PLAYWRIGHT_BROWSERS_PATH:'C:/Users/hario/AppData/Local/ms-playwright'}
const start=Date.now(),r=spawnSync(process.execPath,['tools/browser/sync-check.mjs'],{env,encoding:'utf8',maxBuffer:32*1024*1024}),log=(r.stdout??'')+(r.stderr??'')
writeFileSync(cache+'/bundle-workerd.log',log)
const result={name:'compiled-standalone-v3-H3-workerd',status:r.status===0?'PASS':'FAIL',exitCode:r.status,elapsedMs:Date.now()-start,log:cache+'/bundle-workerd.log',sha256:createHash('sha256').update(log).digest('hex'),fallbackWorkerModulesByteIdentical:true,summary:[...log.matchAll(/\d+ sync checks passed/g)].map(m=>m[0]),remote:false}
writeFileSync(root+'/bundle-check.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));assert.equal(r.status,0,'Compiled local bundle check failed; preserve log and investigate')
