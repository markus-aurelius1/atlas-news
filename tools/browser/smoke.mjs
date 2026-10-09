/** Current application routes, shell, map and settings at both responsive sizes and themes. */
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'
const base=process.argv[2]??'http://127.0.0.1:4173/'
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||undefined,args:['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost']})
let checks=0
try {
  for(const width of [390,1366])for(const theme of ['light','dark']) {
    const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme})
    const page=await context.newPage(),errors=[]
    page.on('pageerror',e=>errors.push(e.message))
    await prepare(page,base)
    const nav=page.getByRole('navigation',{name:'Workspace'})
    assert(await nav.getByRole('button',{name:'Atlas',exact:true}).isVisible())
    assert(await nav.getByRole('button',{name:'News',exact:true}).isVisible())
    await page.getByRole('application').waitFor()
    await page.locator('.atlas-names').waitFor()
    await page.goto(base+'#/atlas?place=in.pass.nathu-la')
    await page.getByRole('heading',{name:'Nathu La',exact:true}).waitFor()
    assert(await page.getByRole('button',{name:'Test me',exact:true}).isVisible())
    await page.goto(base+'#/settings')
    await page.getByRole('heading',{name:'Settings',exact:true}).waitFor()
    assert(await page.getByText('Map style',{exact:true}).isVisible())
    assert(await page.getByText('Back up everything',{exact:true}).isVisible())
    await page.goto(base+'#/unknown?unsafe=1')
    await page.waitForFunction(()=>location.hash==='#/atlas')
    assert.deepEqual(errors,[])
    checks+=9
    console.log('PASS '+width+' '+theme+' shell, place, settings and route fallback')
    await context.close()
  }
  console.log('Browser smoke: '+checks+' checks')
}finally{await browser.close()}
