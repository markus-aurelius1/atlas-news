/** Controlled v3 build, SYNTHETIC local feed/reader fixtures, external DNS off. */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { chromium } from 'playwright-core'
import { FEED_REGISTRY_GENERATION } from '../../src/current-affairs/shards.ts'
import { prepare } from './lib.mjs'
const dist = resolve(process.env.CA_DIST ?? 'dist'), out = 'tools/browser/out/validator-v3'
mkdirSync(out, { recursive: true })
const now = Date.now(), publishedAt = new Date(now - 3600000).toISOString()
const row = (title, url, extra = {}) => ({ title, url, publisher: 'Indian Express', sourceId: 'ie-explained', section: 'Explained', description: '', publishedAt, ...extra })
const scienceUrl = 'https://indianexpress.com/fixture-quantum'
const items = [
  row('Quantum computing research reveals a new mechanism', scienceUrl, { description: 'New research discovers an experimentally evidenced mechanism with broad scientific consequences.' }),
  row('Quantum computing research reveals a new mechanism', 'https://www.thehindu.com/fixture-quantum', { publisher: 'The Hindu', sourceId: 'hindu-science', section: 'Science', description: 'New research discovers an experimentally evidenced mechanism with broad scientific consequences.' }),
  row('India defence readiness: capability assessment and doctrine risks', 'https://indianexpress.com/fixture-defence'),
  row('India monetary policy: inflation transmission effects', 'https://indianexpress.com/fixture-monetary'),
  row('Quantum computing research reveals a mechanism in case HISTORIC', 'https://indianexpress.com/fixture-old', { publishedAt: new Date(now - 5 * 86400000).toISOString() }),
  row('NASA staff personnel dispute', 'https://indianexpress.com/fixture-reject'),
]
const feed = { registryGeneration: FEED_REGISTRY_GENERATION, version: 1, fetchedAt: new Date(now).toISOString(), items, sources: [{ sourceId: 'ie-explained', status: 'ok', count: items.length }] }
let feeds = 0, articles = 0, fail = false, slow = false
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png' }
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1'), path = url.pathname
  const json = (status, body) => { res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.writeHead(status); res.end(JSON.stringify(body)) }
  if (path === '/api/current-affairs') { feeds++; if (slow) await new Promise(r => setTimeout(r, 600)); json(fail ? 503 : 200, fail ? { error: 'synthetic outage' } : feed); return }
  if (path === '/api/article') {
    articles++
    json(200, { v: 1, url: url.searchParams.get('url'), html: '<article><h1>Quantum computing research reveals a new mechanism</h1>' + Array.from({ length: 10 }, (_, i) => `<p>Paragraph ${i + 1}. This locally simulated quantum research describes an experimentally verified mechanism with implications for future instruments and computing systems. Scientists explain the evidence and the limitations of the experiment. BODY_PRIVATE_MARKER</p>`).join('') + '</article>' }); return
  }
  if (path.startsWith('/api/')) { json(200, { v: 1, available: false }); return }
  const file = resolve(dist, '.' + (path === '/' ? '/index.html' : decodeURIComponent(path)))
  if (!file.startsWith(dist + sep) || !existsSync(file)) { res.writeHead(404); res.end(); return }
  res.setHeader('Content-Type', mime[file.slice(file.lastIndexOf('.'))] ?? 'application/octet-stream'); res.end(readFileSync(file))
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const base = `http://127.0.0.1:${server.address().port}/`, browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost'] })
const checks = [], errors = [], check = (tag, name, value) => { assert(value, tag + ': ' + name); checks.push({ tag, name }); console.log('PASS ' + tag + ': ' + name) }
try {
  for (const width of [375, 1366]) for (const theme of ['light', 'dark']) {
    const tag = `${width}-${theme}`, ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, timezoneId: 'Asia/Kolkata', serviceWorkers: 'block' }), page = await ctx.newPage()
    page.on('pageerror', e => errors.push(tag + ': ' + e.message)); page.on('console', msg => { if (msg.type() === 'error' && msg.text().includes('Local reading selection failed')) console.log('Browser console:', msg.text()) }); fail = false; slow = false; feeds = 0; articles = 0
    await prepare(page, base, { route: '#/current-affairs' })
    const rows = page.locator('[data-news-event]')
    try { await rows.first().waitFor() } catch (error) { console.log(await page.locator('main').innerText()); await page.screenshot({ path: `${out}/${tag}-failure.png` }); throw error }
    check(tag, 'three selected reading units; equivalent reports collapse and old/noise units stay out', await rows.count() === 3)
    check(tag, 'independent primary subjects are visible', (await page.locator('.news-section').allInnerTexts()).join(' ').includes('Sci-Tech') || (await page.locator('main').innerText()).includes('Sci-Tech'))
    check(tag, 'validation fetches no article body', articles === 0)
    const before = feeds
    await page.evaluate(() => { location.hash = '#/atlas' }); await page.locator('[data-atlas-surface]').waitFor()
    await page.evaluate(() => { location.hash = '#/current-affairs' }); await rows.first().waitFor()
    check(tag, 'cache-first Atlas round trip has no feed refresh', feeds === before)
    await page.reload(); await rows.first().waitFor()
    check(tag, 'real reload preserves selected identities and deduplication', await rows.count() === 3 && feeds === before)
    const history = await page.evaluate(() => new Promise(resolve => { const request = indexedDB.open('tars-validator-v3-reading-v1'); request.onsuccess = () => { const db = request.result, read = db.transaction('selected').objectStore('selected').getAll(); read.onsuccess = () => { db.close(); resolve(read.result) } } }))
    check(tag, 'only selected units persist in chronological ledger', history.length === 3 && history.every(row => row.selectedAt <= Date.now()))
    check(tag, 'substantive value precedes publisher and no weak filling', history.every(row => !row.representative.url.endsWith('fixture-old') && !row.representative.url.endsWith('fixture-reject')))
    const science = rows.filter({ hasText: 'Quantum computing' }).first()
    await science.locator('[data-news-original]').first().click(); const reader = page.locator('[data-reader]'); await reader.locator('.reader-body').waitFor()
    check(tag, 'selected article opens the preserved Reader with one request', articles === 1 && (await reader.locator('.reader-body').innerText()).includes('BODY_PRIVATE_MARKER'))
    await reader.getByRole('button', { name: 'Highlighter', exact: true }).click()
    const quote = await page.evaluate(() => {
      const body = document.querySelector('.reader-body'), text = body.querySelector('p').firstChild, range = document.createRange()
      range.setStart(text, 13); range.setEnd(text, 70)
      body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }))
      getSelection().removeAllRanges(); getSelection().addRange(range); document.dispatchEvent(new Event('selectionchange'))
      body.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: 'mouse' })); return getSelection().toString()
    })
    const excerpts = () => page.evaluate(() => new Promise((resolve, reject) => { const q = indexedDB.open('tars-reader-highlights'); q.onerror = () => reject(q.error); q.onsuccess = () => { const db = q.result, r = db.transaction('records').objectStore('records').getAll(); r.onsuccess = () => { db.close(); resolve(r.result.filter(r => !r.deletedAt)) } } }))
    for (let attempt = 0; attempt < 50 && !(await excerpts()).length; attempt++) await page.waitForTimeout(100)
    const highlighted = (await excerpts())[0]
    check(tag, 'combined v3 Reader stores one native excerpt with classified subject', highlighted?.quote === quote && highlighted.subjectSnapshot === 'Sci-Tech' && highlighted.highlightId.length > 0)
    await page.keyboard.press('Escape'); await reader.waitFor({ state: 'detached' })
    check(tag, 'Back retains selected list and focus', await rows.count() === 3 && await page.evaluate(() => document.activeElement?.hasAttribute('data-news-original')))
    await page.reload(); await rows.first().waitFor()
    check(tag, 'combined reload preserves highlight UUID, authored quote and subject snapshot', (await excerpts()).some(r => r.highlightId === highlighted.highlightId && r.quote === quote && r.subjectSnapshot === highlighted.subjectSnapshot))
    slow = true
    await page.getByRole('button', { name: 'Refresh news' }).click()
    check(tag, 'background refresh keeps selected feed visible', await rows.count() === 3)
    await page.waitForTimeout(1500); slow = false; fail = true
    await page.getByRole('button', { name: 'Refresh news' }).click(); await page.waitForTimeout(800)
    check(tag, 'failed refresh preserves selected units', await rows.count() === 3)
    check(tag, 'no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await page.screenshot({ path: `${out}/${tag}-today.png` })
    await page.evaluate(async ({ now }) => {
      const url = 'https://indianexpress.com/personal-only', at = now - 30 * 86400000
      const metadata = { url, title: 'Personal Saved constitutional commentary', publisher: 'Indian Express', sourceId: 'ie-explained', section: 'Explained', description: '', publishedAt: new Date(at).toISOString(), firstSeenAt: at, lastSeenAt: at }
      await new Promise((resolve, reject) => { const q = indexedDB.open('tars-sync-v1'); q.onerror = () => reject(q.error); q.onsuccess = () => { const db = q.result, tx = db.transaction('rows', 'readwrite'); tx.objectStore('rows').put({ c: 'article', k: url, v: JSON.stringify(metadata), t: at, d: 0 }); tx.oncomplete = () => { db.close(); resolve() }; tx.onabort = () => reject(tx.error) } })
      const state = JSON.parse(localStorage.getItem('tars.current-affairs.state.v1') ?? '{"version":1,"entries":{}}'); state.entries[url] = { savedAt: at }
      localStorage.setItem('tars.current-affairs.state.v1', JSON.stringify(state)); window.dispatchEvent(new Event('tars:personal-state')); window.dispatchEvent(new Event('tars:pinned-articles'))
    }, { now })
    await page.getByRole('group', { name: 'Edition' }).getByRole('button', { name: 'Archive', exact: true }).click(); await page.waitForTimeout(100)
    check(tag, 'unselected personal Saved rows stay outside curated Archive', await rows.count() === 0)
    await page.getByRole('group', { name: 'Reading filter' }).getByRole('button', { name: /Saved/ }).click()
    await rows.filter({ hasText: 'Personal Saved constitutional commentary' }).waitFor()
    check(tag, 'personal Saved fallback remains explicitly reachable and preserves authored state', await rows.count() === 1)
    const retained = await page.evaluate(async () => {
      const values = [JSON.stringify(localStorage), JSON.stringify(sessionStorage)]
      for (const name of await caches.keys()) { const cache = await caches.open(name); for (const req of await cache.keys()) values.push(await (await cache.match(req)).text()) }
      for (const name of ['tars-validator-v3-reading-v1', 'tars-current-affairs-archive-v1', 'tars-reader-highlights']) values.push(await new Promise(resolve => { const req = indexedDB.open(name); req.onsuccess = () => { const db = req.result, stores = [...db.objectStoreNames]; if (!stores.length) { db.close(); resolve(''); return } const tx = db.transaction(stores), found = []; for (const s of stores) { const r = tx.objectStore(s).getAll(); r.onsuccess = () => found.push(JSON.stringify(r.result)) } tx.oncomplete = () => { db.close(); resolve(found.join('')) } } }))
      return values.join('')
    })
    check(tag, 'article text absent from feed/selection/archive/browser storage', !retained.includes('BODY_PRIVATE_MARKER'))
    await page.screenshot({ path: `${out}/${tag}.png` }); await ctx.close()
  }
  assert.deepEqual(errors, []); writeFileSync(`${out}/results.json`, JSON.stringify({ checks, errors }, null, 2)); console.log(checks.length + ' controlled v3 browser checks passed')
} finally { await browser.close(); server.close() }
