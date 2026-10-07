/** Local browser QA for the blind annotation UI. No substantive labels are entered or retained. */
import assert from 'node:assert/strict'
import { readFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'
const root=process.argv[2]
assert.ok(root?.startsWith('tools/news/evaluation/data/'))
const packageRoot=resolve(root),records=JSON.parse(readFileSync(packageRoot+'/reviewer/annotations.json','utf8'))
const out=resolve('tools/news/evaluation/.runs/a2a-browser');mkdirSync(out,{recursive:true})
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'})
let checks=0
try {
  for(const width of [375,1366]) {
    const page=await browser.newPage({viewport:{width,height:900}}),errors=[],requests=[]
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url())})
    await page.goto(pathToFileURL(packageRoot+'/reviewer/index.html').href)
    assert.equal(await page.locator('#pick option').count(),1000);checks++
    assert.equal(await page.locator('#title').textContent(),records[0].metadata.title);checks++
    const shown=JSON.parse(await page.locator('#metadata').textContent())
    assert.ok(shown.metadataObservationId&&shown.revisions.length>0);checks++
    assert.ok(!('sampling' in shown)&&!('score' in shown)&&!('coverageTags' in shown));checks++
    const original=JSON.parse(await page.locator('#answer').inputValue());assert.equal(original.labels.value,null);assert.equal(original.labels.metadataSufficiency,null);checks++
    await page.locator('#reviewer').fill('qa-only-no-human-review')
    await page.locator('#next').click();assert.equal(await page.locator('#title').textContent(),records[1].metadata.title);checks++
    await page.locator('#previous').click();assert.equal(await page.locator('#title').textContent(),records[0].metadata.title);checks++
    await page.locator('#answer').fill('{invalid');await page.locator('#apply').click();assert.ok((await page.locator('#error').textContent()).length>0);checks++
    await page.locator('#answer').fill(JSON.stringify(original));await page.locator('#apply').click()
    const download=page.waitForEvent('download');await page.locator('#save').click();const downloaded=await download
    const stream=await downloaded.createReadStream(),chunks=[];for await(const c of stream)chunks.push(c)
    const payload=Buffer.concat(chunks),answers=JSON.parse(payload.toString('utf8'))
    assert.ok(answers.every(r=>r.annotation.labels.value===null&&r.annotation.labels.metadataSufficiency===null));checks++
    await page.locator('#load').setInputFiles({name:'qa-blank-resume.json',mimeType:'application/json',buffer:payload})
    assert.equal(await page.locator('#title').textContent(),records[0].metadata.title);checks++
    assert.equal(requests.length,0);assert.equal(errors.length,0);checks+=2
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));checks++
    await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:out+'/'+width+'.png',fullPage:false});await page.close()
  }
  console.log(JSON.stringify({checks,layouts:[375,1366],networkRequests:0,pageErrors:0,labelsEntered:0,scope:'local offline annotation UI only; blank QA downloads held in memory, never corpus inputs'}))
}finally{await browser.close()}
