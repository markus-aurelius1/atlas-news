/** H2.1 production-build timing and interaction checks: real mouse selection, simulated native
 * touch/pen range changes, queued IndexedDB writes, rapid selections and clean preview handoff.
 * Fixture bodies stay in memory; no publisher is contacted. Frame timings are estimates, not photon measurements.
 */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'
import { FEED_REGISTRY_GENERATION } from '../../src/current-affairs/shards.ts'

const dist = resolve(process.env.CA_DIST ?? fileURLToPath(new URL('../../dist/', import.meta.url))), out = new URL('./out/h21/', import.meta.url)
mkdirSync(out, { recursive: true })
const publishedAt = new Date(Date.now() - 2 * 3600000).toISOString()
const row = (title, sourceId, publisher, url, extra = {}) => ({ title, sourceId, publisher, url, section: 'Explained', description: '', publishedAt, ...extra })
const URLS = {
  rbi: 'https://indianexpress.com/article/fixture-rbi',
  rbiHindu: 'https://www.thehindu.com/fixture-rbi',
  rights: 'https://www.thehindu.com/fixture-rights',
  ramsar: 'https://www.theguardian.com/fixture-environment',
  space: 'https://indianexpress.com/article/fixture-space',
  health: 'https://www.thehindu.com/fixture-health',
  gdp: 'https://indianexpress.com/article/fixture-gdp',
  key: 'https://indianexpress.com/article/fixture-key',
  wildfire: 'https://www.theguardian.com/fixture-wildfire',
  who: 'https://www.hindustantimes.com/fixture-who',
  ft: 'https://www.ft.com/content/fixture-ft',
}
const feed = { registryGeneration: FEED_REGISTRY_GENERATION, version: 1, fetchedAt: new Date().toISOString(), sources: [{ sourceId: 'ie-explained', status: 'ok', count: 5 }], items: [
  row('RBI revises banking liquidity regulation framework', 'ie-explained', 'Indian Express', URLS.rbi, { description: 'The central bank has rewritten how banks must hold liquid assets, with a longer transition than lenders expected.', thumbnailUrl: 'https://images.example.org/fixture-thumbnail.jpg' }),
  row('RBI revises banking liquidity regulation framework today', 'hindu-national', 'The Hindu', URLS.rbiHindu),
  row('Supreme Court ruling on constitutional fundamental rights', 'hindu-national', 'The Hindu', URLS.rights, { section: 'National' }),
  row('Ramsar protected area conservation expands', 'guardian-environment', 'Guardian', URLS.ramsar),
  row('ISRO launches important lunar space mission', 'ie-explained', 'Indian Express', URLS.space),
  row('Cabinet approves expansion of Ayushman Bharat scheme coverage', 'hindu-national', 'The Hindu', URLS.health, { section: 'National' }),
  row('New GDP series uses double deflation', 'ie-economy', 'Indian Express', URLS.gdp, { section: 'Economy' }),
  row('UPSC Key: Poompuhar, NCERT Textbooks and Article 370', 'ie-upsc', 'Indian Express', URLS.key, { section: 'UPSC Current Affairs' }),
  row('El Niño-driven wildfires threaten orangutan habitat, IUCN Red List study warns', 'guardian-environment', 'Guardian', URLS.wildfire),
  row('WHO public health vaccination framework expands', 'ht-science', 'Hindustan Times', URLS.who),
  row('Supreme Court upholds Finance Commission devolution formula for states', 'ext-financial-times', 'Financial Times', URLS.ft, { section: 'International' }),
] }

/** A distinctive word in every fixture article: nothing on the device may contain it once the reader is closed. */
const MARK = 'ZETAMARKER'
const sentence = (n) => `Paragraph ${n} ${MARK} reports that the committee reviewed the scheme and set out what it found in the districts it visited during the monsoon session.`
const paragraphs = (count, from = 1) => Array.from({ length: count }, (_, i) => `<p>${sentence(from + i)}</p>`).join('')
const shell = (body, head = '') => `<!doctype html><html><head><title>Fixture</title><meta name="author" content="Fixture Reporter">${head}</head><body><nav><a href="/">Home</a></nav><main><article>${body}</article></main></body></html>`
const rich = shell(`
  <figure><img src="https://images.example.org/fixture-lead.jpg" width="1200" height="675" alt="A reservoir at low water" onerror="window.__pwned = 1"><figcaption>The reservoir in June. Photo: Fixture</figcaption></figure>
  ${paragraphs(3)}
  <p onclick="window.__pwned = 1">A paragraph with a <a href="/explained/related" onclick="window.__pwned = 1">relative link</a>, a <a href="javascript:window.__pwned = 1">script link</a> and <strong>strong</strong> and <em>emphasised</em> words.</p>
  <img src="x" onerror="window.__pwned = 1">
  <p><strong>Also Read |</strong> <a href="/another">A story that is not this one</a></p>
  <h2>What the committee found</h2>
  ${paragraphs(2, 5)}
  <blockquote><p>The scheme reached fewer households than planned, and nobody could say why.</p></blockquote>
  <ul><li>First finding of the panel</li><li>Second finding of the panel</li></ul>
  <table><thead><tr><th>District</th><th>Households</th></tr></thead><tbody><tr><td>North</td><td>12,400</td></tr><tr><td>South</td><td>9,150</td></tr></tbody></table>
  <figure><img src="https://images.example.org/broken.jpg" width="900" height="600" alt="Broken"><figcaption>A picture that fails to load.</figcaption></figure>
  <div class="infographic-coast"><div class="infographic-coast__tab-strip" role="tablist"><label role="tab">By the numbers</label> <label role="tab">Lessons</label></div>
    <div class="infographic-coast__panel" role="tabpanel"><div class="infographic-coast__stat-grid">
      <div class="infographic-coast__stat-cell"><div class="infographic-coast__stat-number">11,098</div><div class="infographic-coast__stat-unit">km</div><div class="infographic-coast__stat-label">Length of the coastline</div></div>
      <div class="infographic-coast__stat-cell"><div class="infographic-coast__stat-number">~95%</div><div class="infographic-coast__stat-unit">of trade</div><div class="infographic-coast__stat-label">Share of trade carried by sea</div></div>
      <div class="infographic-coast__stat-cell"><div class="infographic-coast__stat-number">~30 mn</div><div class="infographic-coast__stat-unit">livelihoods</div><div class="infographic-coast__stat-label">Supported by fisheries</div></div>
    </div></div>
    <div class="infographic-coast__panel" role="tabpanel"><div class="infographic-coast__compare-grid">
      <div class="infographic-coast__compare-card"><div class="infographic-coast__compare-label">Seychelles, 2018</div><div class="infographic-coast__compare-value">USD 15 mn</div><div class="infographic-coast__compare-text">The first sovereign bond of its kind.</div></div>
      <div class="infographic-coast__compare-card"><div class="infographic-coast__compare-label">Belize</div><div class="infographic-coast__compare-value">USD 364 mn</div><div class="infographic-coast__compare-text">A debt conversion that paid for conservation.</div></div>
    </div></div>
  </div>
  <p data-tars-embed=""><a href="https://www.youtube.com/embed/fixture">Embedded content</a></p>
  <p data-tars-embed=""><a href="https://ads.example.org/frame">Embedded content</a></p>
  <h3>What happens next</h3>
  ${paragraphs(9, 7)}
  <form action="https://evil.example"><input name="q"></form>`)
const plain = (n = 8) => shell(paragraphs(n))
const ARTICLES = {
  [URLS.rbi]: () => rich.replace(paragraphs(9, 7), paragraphs(180, 7)),
  [URLS.rbiHindu]: () => plain(7),
  [URLS.rights]: () => shell(paragraphs(8), '<script type="application/ld+json">{"@type":"NewsArticle","isAccessibleForFree":false}</script>'),
  [URLS.space]: () => plain(3),
  [URLS.health]: () => plain(9),
  [URLS.gdp]: () => plain(8),
  [URLS.key]: () => shell('<p>Watch the video briefing.</p>'),
  [URLS.wildfire]: () => plain(10),
  [URLS.who]: () => plain(6),
}

const requests = new Map()
let healthFailures = 1, session = 'ok', sessionVisits = 0
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' }
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost'), path = url.pathname
  const send = (status, body) => { res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'private, no-store'); res.writeHead(status); res.end(JSON.stringify(body)) }
  if (path === '/api/current-affairs') return send(200, feed)
  // Signing in: Access would ask for the login here; the fixture simply grants it and sends the browser back to the front door.
  if (path === '/api/session') { session = 'ok'; sessionVisits++; res.writeHead(302, { Location: '/', 'Cache-Control': 'no-store' }); res.end(); return }
  if (path === '/api/article') {
    const target = url.searchParams.get('url')
    requests.set(target, (requests.get(target) ?? 0) + 1)
    if (session === 'expired') return send(401, { error: 'unauthenticated' })
    if (target === URLS.gdp) await new Promise(r => setTimeout(r, 1200))
    if (target === URLS.ramsar) return send(502, { error: 'upstream_blocked' })
    if (target === URLS.health && healthFailures-- > 0) return send(502, { error: 'upstream_unavailable' })
    if (target === URLS.ft) return send(451, { error: 'publisher_restricted' })
    return ARTICLES[target] ? send(200, { v: 1, url: target, html: ARTICLES[target]() }) : send(403, { error: 'publisher_not_listed' })
  }
  const file = resolve(dist, '.' + (path === '/' ? '/index.html' : decodeURIComponent(path)))
  if (!file.startsWith(dist + sep) || !existsSync(file)) { res.writeHead(404); res.end(); return }
  res.setHeader('Content-Type', mime[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream')
  res.end(readFileSync(file))
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}/`
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost'] })
const checks = [], errors = [], performanceEvidence = []
const check = (tag, name, evidence = true) => { assert(evidence, `${tag}: ${name}`); checks.push({ tag, name }); console.log(`PASS ${tag}: ${name}`) }
const picture = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"><rect width="1200" height="675" fill="#b9c8c4"/><path d="M0 675L420 210L760 520L940 380L1200 675Z" fill="#5f7a70"/><circle cx="930" cy="170" r="64" fill="#e9dfc6"/></svg>'



try {
  const evidence=[], lifecycle=[]
  for (const width of [375,1366]) for(const theme of ['light','dark']) for (const type of ['mouse','touch','pen']) {
    const tag=width+'-'+theme+'-'+type
    const ctx=await browser.newContext({viewport:{width,height:900},colorScheme:theme,hasTouch:width===375,serviceWorkers:'block'})
    const page=await ctx.newPage()
    page.on('pageerror',e=>errors.push(tag+': '+e.message))
    await page.addInitScript(()=>{
      window.timing={selection:[],completion:[],paint:[],transactions:[]}
      document.addEventListener('selectionchange',()=>{if(getSelection()?.toString())timing.selection.push(performance.now())})
      for(const name of ['pointerup','mouseup'])document.addEventListener(name,()=>timing.completion.push(performance.now()))
      const set=CSS.highlights.set.bind(CSS.highlights)
      CSS.highlights.set=(key,value)=>{if(value.size){const entry={key,at:performance.now()};timing.paint.push(entry);requestAnimationFrame(()=>entry.frame=performance.now())}return set(key,value)}
      const transaction=IDBDatabase.prototype.transaction
      // H3 has separate multi-store bookkeeping transactions. Measure H1's records-only durable save.
      IDBDatabase.prototype.transaction=function(...args){const tx=transaction.apply(this,args);if(this.name==='tars-reader-highlights'&&args[1]==='readwrite'&&tx.objectStoreNames.length===1&&tx.objectStoreNames.contains('records')&&!window.profileBlocker){const entry={start:performance.now()};timing.transactions.push(entry);tx.addEventListener('complete',()=>entry.end=performance.now())}return tx}
    })
    await ctx.route('https://images.example.org/**',route=>route.fulfill({status:404}))
    await prepare(page,base,{route:'#/current-affairs'})
    await page.locator('[data-news-event]').filter({hasText:'RBI revises'}).first().locator('[data-news-original]').first().click()
    const body=page.locator('.reader-body')
    await body.locator('p').first().waitFor()
    await page.getByRole('button',{name:'Highlighter',exact:true}).click()
    await body.locator('p').first().evaluate(el=>el.scrollIntoView({block:'center'}))
    await page.waitForTimeout(200)
    const pick=async(paragraph,start,end,pointer=type)=>page.evaluate(({paragraph,start,end,pointer})=>{
      const b=document.querySelector('.reader-body'),n=[...b.querySelectorAll('p')].filter(p=>p.textContent.startsWith('Paragraph '))[paragraph].firstChild
      b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:pointer}))
      const r=document.createRange();r.setStart(n,start);r.setEnd(n,end);getSelection().removeAllRanges();getSelection().addRange(r);document.dispatchEvent(new Event('selectionchange'))
      b.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerType:pointer}));return getSelection().toString()
    },{paragraph,start,end,pointer})
    const count=()=>page.evaluate(()=>new Promise((resolve,reject)=>{const q=indexedDB.open('tars-reader-highlights');q.onerror=()=>reject(q.error);q.onsuccess=()=>{const db=q.result,r=db.transaction('records').objectStore('records').getAll();r.onsuccess=()=>{db.close();resolve(r.result.filter(r=>!r.deletedAt))}}}))
    const waitCount=async n=>{for(let i=0;i<50;i++){if((await count()).length===n)return;await page.waitForTimeout(50)}assert.equal((await count()).length,n)}
    if(type==='mouse'){
      const points=await body.locator('p').first().evaluate(el=>{const point=n=>{const r=document.createRange();r.setStart(el.firstChild,n);r.collapse(true);const b=r.getBoundingClientRect();return{x:b.x,y:b.y+b.height/2}};return{start:point(25),end:point(65)}})
      await page.mouse.move(points.start.x,points.start.y);await page.mouse.down();await page.mouse.move(points.end.x,points.end.y,{steps:8});await page.mouse.up()
    }else await pick(0,25,65)
    await page.waitForFunction(()=>timing.transactions.some(t=>t.end)&&timing.paint.some(p=>p.key==='tars-yellow'&&p.frame))
    await page.waitForTimeout(40)
    const measurement=await page.evaluate(()=>{
      const start=timing.selection[0],visual=timing.paint[0],tx=timing.transactions.find(t=>t.end),durable=timing.paint.find(p=>p.key==='tars-yellow'&&p.at>=tx.end)
      return {completionToVisualMs:visual.frame-timing.completion.at(-1),completionToSaveMs:tx.end-timing.completion.at(-1),selectionToRegistrationMs:visual.at-start,selectionToVisualMs:visual.frame-start,selectionToSaveMs:tx.end-start,saveToDurablePaintMs:durable?.frame-tx.end,selectionToTransactionMs:tx.start-start,raw:timing}
    })
    evidence.push({tag,type,...measurement})
    check(tag,'first custom paint within 100ms',measurement.selectionToVisualMs<100)
    check(tag,'preview precedes transaction and durable paint replaces it',measurement.raw.paint[0].key==='tars-preview-yellow'&&measurement.raw.paint[0].at<measurement.raw.transactions[0].start&&await page.evaluate(()=>![...CSS.highlights.keys()].some(k=>k.startsWith('tars-preview-'))))
    check(tag,'native selection remains intact',await page.evaluate(()=>getSelection().toString().length>0&&getComputedStyle(document.querySelector('.reader-body'),'::selection').backgroundColor==='rgba(0, 0, 0, 0)'))
    if(type!=='mouse'){
      const first=await pick(1,20,35)
      await page.waitForFunction(quote=>[...CSS.highlights.get('tars-preview-yellow')??[]].some(r=>r.toString()===quote),first)
      await page.waitForTimeout(250)
      const final=await page.evaluate(()=>{const r=getSelection().getRangeAt(0);r.setEnd(r.endContainer,65);document.dispatchEvent(new Event('selectionchange'));return getSelection().toString()})
      await page.waitForFunction(quote=>[...CSS.highlights.get('tars-preview-yellow')??[]].some(r=>r.toString()===quote),final)
      check(tag,'handle movement updates preview without intermediate saves',(await count()).length===1)
      await waitCount(2)
      check(tag,'exact final selection is stored once',(await count()).filter(r=>r.quote===final).length===1)
      lifecycle.push({tag,finalQuote:final,savedRecords:2})
    }else{
      // A real writer holds the store open. The app's write must queue behind it;
      // this tests storage blocking rather than a delayed mock repository response.
      await page.evaluate(async()=>{
        const q=indexedDB.open('tars-reader-highlights');const db=await new Promise((resolve,reject)=>{q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error)})
        window.profileBlocker=true;const tx=db.transaction('records','readwrite');window.profileBlocker=false
        const store=tx.objectStore('records'),until=performance.now()+800
        const keep=()=>{const r=store.get('holding-storage');r.onsuccess=()=>{if(performance.now()<until)keep()}};keep();tx.oncomplete=()=>db.close()
        window.timing={selection:[],completion:[],paint:[],transactions:[]}
      })
      const quote=await pick(1,25,65,'mouse')
      await page.waitForFunction(quote=>[...CSS.highlights.get('tars-preview-yellow')??[]].some(r=>r.toString()===quote),quote)
      check(tag,'blocked IndexedDB writer does not delay preview',await page.evaluate(()=>timing.paint[0].at-timing.selection[0]<100&&!timing.transactions.some(t=>t.end)))
      await page.screenshot({path:fileURLToPath(new URL(tag+'-pending-preview.png',out))})
      await waitCount(2)
      await page.waitForFunction(()=>!CSS.highlights.has('tars-preview-yellow'))
      lifecycle.push({tag,blockedWriter:await page.evaluate(()=>({selectionToPreviewMs:timing.paint[0].at-timing.selection[0],selectionToSaveMs:timing.transactions[0].end-timing.selection[0]}))})
      for(let i=0;i<3;i++){await pick(i+5,20,45,'mouse');await page.waitForTimeout(80)}
      await waitCount(5)
      check(tag,'rapid distinct selections retain five independent records',(await count()).length===5)
    }
    await page.screenshot({path:fileURLToPath(new URL(tag+'-selection.png',out))})
    await ctx.close()
  }
  assert.deepEqual(errors,[])
  writeFileSync(new URL('after-timing.json',out),JSON.stringify({evidence,lifecycle,checks,errors},null,2))
  console.log(JSON.stringify(evidence.map(({raw,...row})=>row),null,2))
}finally{await browser.close();server.close()}
