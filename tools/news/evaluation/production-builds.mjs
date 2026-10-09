/** Local production-origin candidate and v2-with-H3 fallback. Never uploads. */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
const cache='tools/news/.cache/production-release',root='docs/production-release'
const artifactRoot='tools/browser/out/production-release-builds'
const cli='C:/Users/hario/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/bin/wrangler.js'
const env={...process.env,SITE_URL:'https://tars-atlas-news.pages.dev',BASE:'/',WRANGLER_SEND_METRICS:'false',WRANGLER_DISABLE_UPDATE_CHECK:'true',CHROMIUM_PATH:'C:/Users/hario/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',PLAYWRIGHT_BROWSERS_PATH:'C:/Users/hario/AppData/Local/ms-playwright'}
const results=[]
if(existsSync(root+'/production-builds.json')){
  const old=JSON.parse(readFileSync(root+'/production-builds.json','utf8'))
  if(old.results.some(r=>r.status==='FAIL')&&!existsSync(root+'/production-builds-first-attempt.json')){
    for(const r of old.results)if(existsSync(r.log))copyLog(r.log)
    writeFileSync(root+'/production-builds-first-attempt.json',JSON.stringify({...old,results:old.results.map(r=>({...r,log:r.log+'.first-attempt'})),resolution:'Deprecated --outfile emitted multipart data; artifacts replaced with --outdir module directories and verified locally. No upload occurred.'},null,2)+'\n')
  }
}
function copyLog(path){cpSync(path,path+'.first-attempt')}
function run(name,args,overrides={}){const start=Date.now(),r=spawnSync(process.execPath,args,{env:{...env,...overrides},encoding:'utf8',maxBuffer:32*1024*1024}),log=(r.stdout??'')+(r.stderr??'');writeFileSync(cache+'/'+name+'.log',log);const row={name,args,status:r.status===0?'PASS':'FAIL',exitCode:r.status,elapsedMs:Date.now()-start,log:cache+'/'+name+'.log',sha256:createHash('sha256').update(log).digest('hex')};results.push(row);writeFileSync(root+'/production-builds.json',JSON.stringify({env:{SITE_URL:env.SITE_URL,BASE:env.BASE},results},null,2)+'\n');console.log(JSON.stringify(row));assert.equal(r.status,0,name)}
const files=p=>readdirSync(p,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(p+'/'+e.name):[p+'/'+e.name])
const inventories={}
for(const mode of ['v2','v3']){
  run('production-'+mode+'-build',['node_modules/vite/bin/vite.js','build'],{VITE_NEWS_VALIDATOR:mode})
  assert(readFileSync('dist/index.html','utf8').includes(env.SITE_URL),'Confirmed canonical origin required')
  // Delete only the two known invalid generated files; no recursive cleanup or shared data.
  const oldMultipart=cache+'/'+mode+'-h3-build/_worker.js'
  if(existsSync(oldMultipart))unlinkSync(oldMultipart)
  const destination=artifactRoot+'/'+mode+'-h3-build';mkdirSync(destination,{recursive:true});cpSync('dist',destination,{recursive:true})
  run('production-'+mode+'-functions',[cli,'pages','functions','build','functions','--outdir',destination+'/_worker.js','--output-routes-path',destination+'/_routes.json','--build-output-directory',destination,'--compatibility-date','2026-10-04'])
  const workerFiles=files(destination+'/_worker.js')
  assert(workerFiles.some(p=>readFileSync(p,'utf8').includes('/api/highlights-sync')),'Standalone candidate must retain H3 endpoint')
  assert(workerFiles.some(p=>p.endsWith('/index.js')),'Actual Worker module entry required, not multipart upload data')
  inventories[mode]={destination,files:files(destination).sort().map(p=>({path:p.slice(destination.length+1),sha256:createHash('sha256').update(readFileSync(p)).digest('hex')}))}
}
const normalizeWorker=v=>v.replace(/^\/\/ .*\.wrangler\/tmp\/pages-[^/]+\/functionsRoutes-[0-9.]+\.mjs$/gm,'// Generated Pages routes')
assert.equal(normalizeWorker(readFileSync(inventories.v2.destination+'/_worker.js/index.js','utf8')),normalizeWorker(readFileSync(inventories.v3.destination+'/_worker.js/index.js','utf8')),'Only the random generated route comment may differ')
cpSync(inventories.v3.destination+'/_worker.js/index.js',inventories.v2.destination+'/_worker.js/index.js')
inventories.v2.files.find(f=>f.path==='_worker.js/index.js').sha256=createHash('sha256').update(readFileSync(inventories.v2.destination+'/_worker.js/index.js')).digest('hex')
writeFileSync(root+'/build-artifact-hashes.json',JSON.stringify({SITE_URL:env.SITE_URL,BASE:env.BASE,candidateMode:'v3',fallbackMode:'v2',H3Both:true,published:false,sharedWorkerCanonicalizedAfterExactCommentOnlyComparison:true,inventories},null,2)+'\n')
run('production-origin-v3-browser',['tools/browser/validator-v3-check.mjs'])
run('final-lint',['node_modules/eslint/bin/eslint.js','src','tools/news','functions','vite.config.ts'])
