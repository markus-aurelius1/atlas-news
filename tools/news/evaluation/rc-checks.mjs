/** Existing local executables only. No npm installs, npx, remote CI or cloud. */
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
const root='docs/release-candidate',cache='tools/news/.cache/release-candidate'
mkdirSync(cache+'/tmp',{recursive:true})
const env={...process.env,TEMP:resolve(cache+'/tmp'),TMP:resolve(cache+'/tmp'),CHROMIUM_PATH:'C:/Users/hario/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe',PLAYWRIGHT_BROWSERS_PATH:'C:/Users/hario/AppData/Local/ms-playwright',WRANGLER_BIN:'C:/Users/hario/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/bin/wrangler.js',WRANGLER_SEND_METRICS:'false',WRANGLER_DISABLE_UPDATE_CHECK:'true',VALIDATOR_INVENTORY_PATH:root+'/runtime-inventory.json'}
const output=root+'/checks-'+process.argv[2]+'.json'
const results=existsSync(output)?JSON.parse(readFileSync(output,'utf8')).results:[]
async function run(name,args,overrides={}){
  const start=Date.now(),child=spawn(process.execPath,args,{env:{...env,...overrides},stdio:['ignore','pipe','pipe']})
  let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b)
  const code=await new Promise(resolve=>{child.on('error',e=>{log+=e.stack;resolve(-1)});child.on('exit',resolve)})
  const path=cache+'/'+name+'-'+results.filter(r=>r.name===name).length+'.log';writeFileSync(path,log)
  const row={name,command:['node',...args],status:code===0?'PASS':'FAIL',exitCode:code,elapsedMs:Date.now()-start,log:path,sha256:createHash('sha256').update(log).digest('hex'),summary:[...log.matchAll(/(?:# (?:tests|pass|fail|skipped) \d+|Test Files[^\n]*|Tests[^\n]*|\d+[^\n]*checks passed|\d+ problems[^\n]*)/g)].map(m=>m[0])}
  results.push(row);writeFileSync(output,JSON.stringify({environment:envSubset(),results},null,2)+'\n');console.log(JSON.stringify(row));return code===0
}
function envSubset(){return Object.fromEntries(['TEMP','TMP','CHROMIUM_PATH','PLAYWRIGHT_BROWSERS_PATH','WRANGLER_BIN','VALIDATOR_INVENTORY_PATH'].map(k=>[k,env[k]]))}
async function build(mode){
  if(!await run('atlas-assets',['tools/build-atlas-assets.mjs']))return false
  if(!await run('validator-manifest',['tools/news/build-validator-manifest.ts']))return false
  if(!await run('build-typecheck',['node_modules/typescript/bin/tsc','-b']))return false
  return run(mode+'-build',['node_modules/vite/bin/vite.js','build'],{VITE_NEWS_VALIDATOR:mode==='v3'?'v3':'v2'})
}
if(process.argv[2]==='unit'){
  const checks=[['typecheck',['node_modules/typescript/bin/tsc','-b']],['lint',['node_modules/eslint/bin/eslint.js','src','tools/news','functions','vite.config.ts']],['root-tests',['node_modules/vitest/vitest.mjs','run']],['pipeline',['--test',...readdirSync('tools/atlas-build/test').filter(n=>n.endsWith('.test.mjs')).map(n=>'tools/atlas-build/test/'+n)]],['evaluation',['--test',...readdirSync('tools/news/evaluation').filter(n=>/\.test\.(ts|mjs)$/.test(n)).map(n=>'tools/news/evaluation/'+n)]]]
  await Promise.allSettled(checks.map(([name,args])=>run(name,args)))
}else if(process.argv[2]==='combined'){
  if(await build('v3')){
    await run('v3-browser',['tools/browser/validator-v3-check.mjs'])
    if(!process.argv.includes('--v3-only'))await run('v3-h3-workerd',['tools/browser/sync-check.mjs'],{SYNC_CHECK_VALIDATOR:'v3'})
  }
  // Restore default even if a combined gate failed.
  await build('default')
}else if(process.argv[2]==='browser'){
  await run('default-browser',['tools/browser/run.mjs'])
}else throw Error('Use unit, combined or browser')
// Earlier failed attempts remain in the evidence; gate status follows each
// check's latest complete rerun, never a deleted or hidden attempt.
if([...new Map(results.map(r=>[r.name,r])).values()].some(r=>r.status!=='PASS'))process.exitCode=1
