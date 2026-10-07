/** Runs current regression checks against production assets, with a separate development recall check. */
import { spawn, spawnSync } from 'node:child_process'
const host='127.0.0.1',port=4313,devPort=4314,base='http://'+host+':'+port+'/'
const processes=[]
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
  for(const script of ['smoke.mjs','atlas-cold-start.mjs','atlas-label-visibility.mjs','atlas-check.mjs','vnext-learning.mjs'])check(script,[base])
  check('vnext-learning.mjs',[base],{SCHEME:'dark'})
  check('news-check.mjs')
  check('reader-check.mjs')
  check('highlights-check.mjs')
  check('highlight-responsiveness-check.mjs')
  check('highlights-library-check.mjs')
  await serve(['--port',String(devPort)],'http://'+host+':'+devPort+'/')
  check('atlas-recall-check.mjs',['http://'+host+':'+devPort+'/'])
}finally{for(const child of processes)child.kill()}
