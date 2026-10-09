/**
 * The News reader against the production build, with a fixture feed and a fixture reader gateway (no publisher is
 * contacted): opening and closing, the article as drawn, its controls, every way an article can be unavailable,
 * and what is left on the device afterwards. Two widths, both themes.
 */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'
import { FEED_REGISTRY_GENERATION } from '../../src/current-affairs/shards.ts'

const dist = resolve(process.env.CA_DIST ?? fileURLToPath(new URL('../../dist/', import.meta.url))), out = new URL('./out/highlights-library/', import.meta.url)
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


const orphan = 'https://www.thehindu.com/fixture-orphan'
ARTICLES[orphan] = () => plain(12)
healthFailures = 0
const passageText = Array.from({ length: 12 }, (_, i) => sentence(i + 1)).join(' ')
const makeRow = (id, url, subject, paragraph = 7, extra = {}) => {
  const quote = sentence(paragraph).slice(0, 95)
  const start = passageText.indexOf(quote), end = start + quote.length
  return { version: 1, highlightId: id, articleUrl: url, title: id === 'orphan' ? 'A retained committee report' : 'Saved report ' + id, publisher: 'The Hindu', sourceId: 'hindu-national', publishedAt, subjectSnapshot: subject, categorySnapshot: 'National', quote,
    anchor: { version: 1, quote, start, end, prefix: passageText.slice(Math.max(0, start - 64), start), suffix: passageText.slice(end, end + 64) }, color: 'yellow', createdAt: 1000, updatedAt: 2000, resolution: 'pending', ...extra }
}
const fixtures = [makeRow('orphan', orphan, 'Polity'), makeRow('early', orphan, 'Polity', 2, { color: 'green' }), makeRow('duplicate', URLS.health, 'Governance'), makeRow('economy', URLS.gdp, 'Economy', 3, { color: 'blue', updatedAt: 3000 }), makeRow('unavailable', URLS.ramsar, 'Environment', 5, { color: 'pink' }), makeRow('unresolved', URLS.space, null, 7, { color: 'orange', resolution: 'unresolved' }), makeRow('tombstone', orphan, 'Polity', 3, { deletedAt: 3000 })]
const idb = async (page, operation, rows = []) => page.evaluate(({ operation, rows }) => new Promise((resolve, reject) => {
  const request = indexedDB.open('tars-reader-highlights')
  request.onerror = () => reject(request.error)
  request.onsuccess = () => {
    const db = request.result, tx = db.transaction('records', operation === 'read' ? 'readonly' : 'readwrite'), store = tx.objectStore('records')
    let result
    if (operation === 'seed') rows.forEach((row) => store.put(row))
    if (operation === 'read') { const read = store.getAll(); read.onsuccess = () => { result = read.result } }
    tx.oncomplete = () => { db.close(); resolve(result) }
    tx.onabort = () => { db.close(); reject(tx.error) }
  }
}), { operation, rows })
try {
  for (const width of [375, 1366]) for (const theme of ['light', 'dark']) {
    const tag = width + '-' + theme
    requests.clear()
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, hasTouch: width === 375, timezoneId: 'Asia/Kolkata', serviceWorkers: 'block' })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(tag + ': ' + e.message))
    await ctx.route('https://images.example.org/**', (route) => route.fulfill({ contentType: 'image/svg+xml', body: picture }))
    await prepare(page, base, { route: '#/current-affairs?view=highlights' })
    const library = page.locator('[data-highlights-library]')
    await library.waitFor()
    check(tag, 'dedicated library loads with zero article requests', requests.size === 0)
    const start = Date.now()
    await idb(page, 'seed', fixtures)
    await page.reload()
    await page.waitForFunction(() => document.querySelectorAll('[data-library-highlight]').length === 6)
    performanceEvidence.push({ tag, sixExcerptsVisibleMs: Date.now() - start })
    check(tag, 'multiple articles, duplicate excerpts and stable independent IDs', await library.locator('[data-library-highlight]').count() === 6)
    check(tag, 'tombstone hidden', await library.locator('[data-library-highlight="tombstone"]').count() === 0)
    check(tag, 'snapshot subjects in News order with null in Other', JSON.stringify(await library.locator('.library-subject > h2').allTextContents()) === JSON.stringify(['Environment1', 'Economy1', 'Polity2', 'Governance1', 'Other1']))
    check(tag, 'passages follow original anchor order', (await library.locator('[data-library-article="' + orphan + '"] [data-library-highlight]').first().getAttribute('data-library-highlight')) === 'early')
    check(tag, 'unresolved excerpt remains displayed', await library.getByText('Passage no longer locatable').count() === 1)
    check(tag, 'library metadata shown', await library.locator('time').count() === 5 && (await library.textContent()).includes('2 highlights'))
    check(tag, 'no bodies fetched for grouping/render', requests.size === 0)
    check(tag, 'startup never resolves article anchors', (await idb(page, 'read')).find((r) => r.highlightId === 'orphan').resolution === 'pending')
    await page.evaluate(() => new Promise((resolve, reject) => {
      const req = indexedDB.open('tars-current-affairs-archive-v1', 1)
      req.onsuccess = () => { const db = req.result, tx = db.transaction('articles', 'readwrite'); tx.objectStore('articles').clear(); tx.oncomplete = () => { db.close(); resolve() }; tx.onabort = () => reject(tx.error) }
      req.onerror = () => reject(req.error)
    }))
    check(tag, 'removing archived article metadata never removes highlights', await library.locator('[data-library-highlight]').count() === 6)
    const search = library.getByRole('searchbox')
    await search.fill('retained committee')
    check(tag, 'local title search', await library.locator('[data-library-article]').count() === 1)
    await search.fill('')
    await library.getByRole('combobox').selectOption('Other')
    check(tag, 'subject filter', await library.locator('[data-library-highlight]').count() === 1)
    await library.getByRole('combobox').selectOption('All subjects')
    const row = library.locator('[data-library-highlight="orphan"]')
    await row.getByRole('button', { name: /Edit highlight/ }).click()
    await page.getByRole('dialog', { name: /Edit.*highlight/ }).getByRole('button', { name: 'Blue', exact: true }).waitFor()
    await page.screenshot({ path: fileURLToPath(new URL(tag + '-edit.png', out)) })
    await page.getByRole('dialog', { name: /Edit.*highlight/ }).getByRole('button', { name: 'Blue', exact: true }).click()
    await page.keyboard.press('Escape')
    await page.getByRole('dialog', { name: /Edit.*highlight/ }).waitFor({ state: 'detached' })
    await page.waitForFunction(() => document.querySelector('[data-library-highlight="orphan"] .library-quote')?.dataset.color === 'blue')
    check(tag, 'recolor reactive and retains ID', (await idb(page, 'read')).find((r) => r.highlightId === 'orphan').color === 'blue')
    await page.getByRole('heading', { name: 'News', exact: true }).click()
    check(tag, 'search icon remains inside its input at narrow and wide widths', await library.locator('.library-filters').evaluate(el => { const a=el.querySelector('svg').getBoundingClientRect(), b=el.querySelector('input').getBoundingClientRect(); return a.top>=b.top && a.bottom<=b.bottom }))
    await page.screenshot({ path: fileURLToPath(new URL(tag + '-library.png', out)), fullPage: true })
    check(tag, 'responsive layout has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    const trigger = row.locator('.library-quote')
    await trigger.click()
    const reader = page.locator('[data-reader]')
    await reader.locator('.reader-body [data-focused-highlight="orphan"]').waitFor()
    check(tag, 'orphan article opens through Reader snapshot', (requests.get(orphan) ?? 0) === 1)
    check(tag, 'only opened article fetched', requests.size === 1)
    check(tag, 'resolved passage scrolled and focused', await reader.evaluate((el) => el.scrollTop > 400 && document.activeElement?.dataset.focusedHighlight === 'orphan'))
    check(tag, 'H1 custom highlight paint retained', await page.evaluate(() => [...CSS.highlights.values()].reduce((n,h) => n + h.size, 0) === 2))
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-reader]')).opacity) > .99)
    await page.screenshot({ path: fileURLToPath(new URL(tag + '-focused.png', out)) })
    await page.keyboard.press('Escape')
    await reader.waitFor({ state: 'detached' })
    check(tag, 'Back restores library and passage focus', await trigger.evaluate((el) => document.activeElement === el))
    check(tag, 'opening does not mark Read/Saved', await page.evaluate(() => { const data = localStorage.getItem('tars.current-affairs.state.v1'); return !data || (!data.includes('readAt') && !data.includes('savedAt')) }))
    await library.locator('[data-library-highlight="unavailable"] .library-quote').click()
    await reader.locator('[data-reader-elsewhere]').waitFor()
    check(tag, 'unavailable source retains saved quote in Reader', await reader.getByRole('complementary', { name: 'Saved passage' }).isVisible())
    check(tag, 'existing two safe terminal links only', await reader.locator('[data-reader-elsewhere] a').count() === 2)
    await page.keyboard.press('Escape'); await reader.waitFor({ state: 'detached' })
    check(tag, 'unavailable status and saved quote retained in library', await library.getByText('Article unavailable · saved passages kept').count() === 1)
    await library.locator('[data-library-highlight="unresolved"] .library-quote').click()
    await reader.getByText('Passage no longer locatable · saved excerpt kept').waitFor()
    check(tag, 'missing anchor never jumps to another passage', await reader.locator('[data-focused-highlight]').count() === 0)
    await page.keyboard.press('Escape'); await reader.waitFor({ state: 'detached' })
    check(tag, 'unresolved quote remains independently revisable', await library.locator('[data-library-highlight="unresolved"] .library-quote').isVisible())
    const requestsBeforeReload = [...requests.values()].reduce((n, c) => n + c, 0)
    await page.reload(); await page.waitForFunction(() => document.querySelectorAll('[data-library-highlight]').length === 6)
    check(tag, 'library survives reload with saved colors', await library.locator('[data-library-highlight="orphan"] .library-quote').getAttribute('data-color') === 'blue')
    check(tag, 'reload never refetches article bodies', [...requests.values()].reduce((n, c) => n + c, 0) === requestsBeforeReload)
    await library.locator('[data-library-highlight="orphan"]').getByRole('button', { name: /Edit highlight/ }).click()
    await page.getByRole('dialog', { name: /Edit.*highlight/ }).getByRole('button', { name: /Delete highlight/ }).click()
    await page.waitForFunction(() => document.querySelectorAll('[data-library-highlight]').length === 5)
    check(tag, 'delete immediate; tombstone retained', !!(await idb(page, 'read')).find((r) => r.highlightId === 'orphan').deletedAt)
    check(tag, 'duplicate excerpt in other article survives deletion', await library.locator('[data-library-highlight="duplicate"]').count() === 1)
    await page.getByRole('button', { name: 'Today', exact: true }).click()
    await page.locator('[data-news-list]').waitFor()
    check(tag, 'Today returns with its existing reading controls', await page.getByRole('button', { name: 'To be Read', exact: true }).count() === 1)
    await page.getByRole('button', { name: 'Archive', exact: true }).click()
    check(tag, 'Archive still available', await page.getByRole('button', { name: 'Archive', exact: true }).getAttribute('aria-pressed') === 'true')
    await page.getByRole('button', { name: 'Saved', exact: true }).click()
    check(tag, 'Saved still available', await page.getByRole('button', { name: 'Saved', exact: true }).getAttribute('aria-pressed') === 'true')
    await page.getByRole('button', { name: 'Highlights', exact: true }).click()
    await page.waitForFunction(() => document.querySelectorAll('[data-library-highlight]').length === 5)
    check(tag, 'library independent of Today/Archive/Saved selection', await library.locator('[data-library-highlight]').count() === 5)
    const libraryStyle = await library.locator('.story-title').first().evaluate(el => { const s=getComputedStyle(el); return [s.fontFamily,s.fontSize,s.fontWeight,s.lineHeight,s.letterSpacing] })
    const librarySection = await library.locator('.news-section > h2').first().evaluate(el => { const s=getComputedStyle(el); return [s.fontSize,s.fontWeight,s.paddingBottom,s.borderBottomWidth] })
    await page.getByRole('button', { name: 'Today', exact: true }).click()
    await page.getByRole('button', { name: 'To be Read', exact: true }).click()
    await page.locator('.story-title').first().waitFor()
    const todayStyle = await page.locator('.story-title').first().evaluate(el => { const s=getComputedStyle(el); return [s.fontFamily,s.fontSize,s.fontWeight,s.lineHeight,s.letterSpacing] })
    const todaySection = await page.locator('.news-section > h2').first().evaluate(el => { const s=getComputedStyle(el); return [s.fontSize,s.fontWeight,s.paddingBottom,s.borderBottomWidth] })
    check(tag, 'headline and section typography match News exactly', JSON.stringify(todayStyle)===JSON.stringify(libraryStyle) && JSON.stringify(todaySection)===JSON.stringify(librarySection))
    await page.screenshot({ path: fileURLToPath(new URL(tag + '-today.png', out)), fullPage: true })
    await page.getByRole('button', { name: 'Archive', exact: true }).click()
    await page.screenshot({ path: fileURLToPath(new URL(tag + '-archive.png', out)), fullPage: true })
    await page.getByRole('button', { name: 'Saved', exact: true }).click()
    await page.screenshot({ path: fileURLToPath(new URL(tag + '-saved.png', out)), fullPage: true })
    await ctx.close()
  }
  assert.deepEqual(errors, [])
  writeFileSync(new URL('results.json', out), JSON.stringify({ checks, errors, performanceEvidence }, null, 2))
  console.log('Highlights library: ' + checks.length + ' checks; no page errors')
} finally { await browser.close(); server.close() }
