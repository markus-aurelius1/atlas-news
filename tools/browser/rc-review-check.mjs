/** Offline reviewer UX checks; automated interactions are never editorial labels. */
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
const dir='docs/release-candidate/blind-review-v2',out='tools/browser/out/rc-review'
mkdirSync(out,{recursive:true})
const sample=JSON.parse(readFileSync(dir+'/sample.json','utf8'))
const source=readFileSync(dir+'/index.html','utf8')
assert(!/"(?:decision|tier|baselineDecisionStratum|primarySubject|annotation)"\s*:/.test(source))
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost']})
const checks=[],errors=[],requests=[]
const check=(name,truth)=>{assert(truth,name);checks.push(name)}
try{
  for(const width of [375,1366]){
    const ctx=await browser.newContext({viewport:{width,height:900}}),page=await ctx.newPage()
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())})
    await page.goto(pathToFileURL(resolve(dir+'/index.html')).href)
    check(width+' all 50 articles/10 pairs frozen and blank',await page.evaluate(()=>data.records.length===50&&data.pairs.length===10&&Object.keys(state.articles).length===0&&Object.keys(state.pairs).length===0))
    check(width+' primary subject, value and sufficiency independent controls',await page.locator('select').count()===3)
    check(width+' no horizontal overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
    await page.getByRole('button',{name:'Export offline JSON',exact:true}).click()
    check(width+' reviewer name required',await page.locator('#status').innerText()==='Enter your reviewer name before exporting.')
    await page.locator('#reviewer').fill('SYNTHETIC UX TEST — no editorial labels')
    await page.getByRole('button',{name:'Next →',exact:true}).click()
    await page.reload()
    check(width+' identity and position resume after reload',await page.locator('#reviewer').inputValue()==='SYNTHETIC UX TEST — no editorial labels'&&(await page.locator('#progress').innerText()).startsWith('2 / 50'))
    await page.getByRole('button',{name:'Comparisons',exact:true}).click()
    check(width+' both natural comparison headlines visible',(await page.locator('.pair h2').count())===2)
    check(width+' comparison choices stay blank',await page.locator('select').evaluateAll(rows=>rows.every(r=>r.value==='')))
    const download=page.waitForEvent('download')
    await page.getByRole('button',{name:'Export offline JSON',exact:true}).click()
    const d=await download,stream=await d.createReadStream();let text='';for await(const b of stream)text+=b
    const exported=JSON.parse(text)
    check(width+' offline export binds sample and never completes unanswered review',exported.sampleSha256===JSON.parse(readFileSync(dir+'/hashes.json','utf8')).sampleSha256&&exported.status==='partial'&&Object.keys(exported.articles).length===0&&Object.keys(exported.pairs).length===0)
    // Tampered import cannot replace the local draft; no real annotations used.
    const before=await page.evaluate(()=>JSON.stringify(state))
    await page.locator('#import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...exported,sampleSha256:'bad'}))})
    check(width+' wrong sample import rejected without losing draft',(await page.locator('#status').innerText()).startsWith('Import failed:')&&await page.evaluate(()=>JSON.stringify(state))===before)
    await page.screenshot({path:out+'/comparisons-'+width+'.png',fullPage:true})
    await page.getByRole('button',{name:'Articles',exact:true}).click()
    await page.screenshot({path:out+'/article-'+width+'.png',fullPage:true})
    await ctx.close()
  }
  check('No external network requests',requests.length===0)
  check('No browser errors',errors.length===0)
  writeFileSync(out+'/results.json',JSON.stringify({scope:'Synthetic interface interactions only; no article labels authored, persisted as gold or exported for owner review',articles:sample.records.length,pairs:sample.pairs.length,checks,errors,requests},null,2)+'\n')
  console.log(checks.length+' offline blind reviewer checks passed')
}finally{await browser.close()}
