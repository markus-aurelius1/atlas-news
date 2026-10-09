/** Runs current regression checks against production assets, with a separate development recall check. */
import { spawn, spawnSync } from 'node:child_process'
const host='127.0.0.1',port=4313,devPort=4314,base='http://'+host+':'+port+'/'
const processes=[]
const jobs = [
  ...['smoke.mjs','atlas-cold-start.mjs','atlas-label-visibility.mjs','atlas-check.mjs','vnext-learning.mjs'].map(script => ({ script, args:[base], env:{} })),
  {script:'vnext-learning.mjs',args:[base],env:{SCHEME:'dark'}},
  ...['news-check.mjs','reader-check.mjs','highlights-check.mjs','highlight-responsiveness-check.mjs','highlights-library-check.mjs'].map(script => ({script,args:[],env:{}})),
  {script:'atlas-recall-check.mjs',args:['http://'+host+':'+devPort+'/'],env:{},dev:true},
]
const start = process.env.BROWSER_FROM ? jobs.findIndex(job => job.script === process.env.BROWSER_FROM) : 0
if(start<0)throw new Error('Unknown BROWSER_FROM checkpoint')
async function serve(args,url) {
  const child=spawn(process.execPath,['node_modules/vite/bin/vite.js',...args,'--host',host,'--strictPort'],{stdio:'ignore'})
  processes.push(child)
  for(let attempt=0;attempt<60;attempt++) {
    if(child.exitCode!==null)throw new Error('Server exited '+child.exitCode)
    try{if((await fetch(url)).ok)return}catch{}
    await new Promise(resolve=>setTimeout(resolve,500))
  }
  throw new Error('Server did not become ready')
}
function check(script,args=[],env={}) {
  const result=spawnSync(process.execPath,['tools/browser/'+script,...args],{stdio:'inherit',env:{...process.env,...env}})
  if(result.error)throw result.error
  if(result.status!==0)throw new Error(script+' failed with '+result.status)
}
try {
  await serve(['preview','--port',String(port)],base)
  if(start)console.log('Explicit resume after preceding suites passed: '+jobs[start].script)
  for(const job of jobs.slice(start)) {
    if(job.dev)await serve(['--port',String(devPort)],'http://'+host+':'+devPort+'/')
    check(job.script,job.args,job.env)
  }
}finally{for(const child of processes)child.kill()}
