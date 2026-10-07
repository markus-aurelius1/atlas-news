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

const dist = resolve(process.env.CA_DIST ?? fileURLToPath(new URL('../../dist/', import.meta.url))), out = new URL('./out/highlights/', import.meta.url)
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
const feed = { version: 1, fetchedAt: new Date().toISOString(), sources: [{ sourceId: 'ie-explained', status: 'ok', count: 5 }], items: [
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
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const checks = [], errors = [], performanceEvidence = []
const check = (tag, name, evidence = true) => { assert(evidence, `${tag}: ${name}`); checks.push({ tag, name }); console.log(`PASS ${tag}: ${name}`) }
const picture = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"><rect width="1200" height="675" fill="#b9c8c4"/><path d="M0 675L420 210L760 520L940 380L1200 675Z" fill="#5f7a70"/><circle cx="930" cy="170" r="64" fill="#e9dfc6"/></svg>'

try {
  for (const width of [375, 1366]) for (const theme of ['light', 'dark']) {
    const tag = width + '-' + theme
    requests.clear()
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, hasTouch: width === 375, timezoneId: 'Asia/Kolkata', serviceWorkers: 'block' })
    const page = await ctx.newPage()
    page.on('pageerror', e => errors.push(tag + ': ' + e.message))
    await ctx.route('https://images.example.org/**', route => route.request().url().includes('broken') ? route.fulfill({ status: 404 }) : route.fulfill({ contentType: 'image/svg+xml', body: picture }))
    await prepare(page, base, { route: '#/current-affairs' })
    const headline = page.locator('[data-news-event]').filter({ hasText: 'RBI revises' }).first().locator('[data-news-original]').first()
    await headline.click()
    const reader = page.locator('[data-reader]'), body = reader.locator('.reader-body')
    await body.waitFor()
    const button = reader.getByRole('button', { name: 'Highlighter', exact: true })
    const rows = () => page.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('tars-reader-highlights', 10)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const db = request.result
        const read = db.transaction('records').objectStore('records').getAll()
        read.onsuccess = () => { db.close(); resolve(read.result.filter(r => !r.deletedAt)) }
      }
    }))
    const painted = () => page.evaluate(() => [...CSS.highlights.entries()].filter(([name]) => name.startsWith('tars-')).reduce((n, [, h]) => n + h.size, 0))
    const waitCount = async n => {
      for (let i = 0; i < 50; i++) { if ((await rows()).length === n && await painted() === n) return; await page.waitForTimeout(100) }
      assert.equal((await rows()).length, n); assert.equal(await painted(), n)
    }
    const pick = async (which, type = 'mouse') => page.evaluate(({ which, type }) => {
      const body = document.querySelector('.reader-body')
      const p = body.querySelectorAll('p')
      const range = document.createRange()
      if (which === 'inline') {
        const el = [...p].find(p => p.textContent.includes('relative link'))
        range.setStart(el.firstChild, 2); range.setEnd(el.lastChild, el.lastChild.textContent.length - 2)
      } else if (which === 'blocks') {
        const ordinary = [...p].filter(el => el.textContent.startsWith('Paragraph '))
        range.setStart(ordinary[3].firstChild, 10); range.setEnd(ordinary[4].firstChild, 80)
      } else {
        range.setStart(p[0].firstChild, 25); range.setEnd(p[0].firstChild, which === 'overlap' ? 95 : 80)
      }
      body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: type }))
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))
      body.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerType: type }))
      return selection.toString()
    }, { which, type })

    check(tag, 'CSS custom paint supported and Highlighter starts off', await button.getAttribute('aria-pressed') === 'false' && await page.evaluate(() => 'highlights' in CSS && typeof Highlight === 'function'))
    const markup = () => body.evaluate(el => { const copy = el.cloneNode(true); copy.querySelectorAll('figure').forEach(f => f.remove()); return copy.innerHTML })
    const untouched = await markup()
    await pick('first')
    await page.waitForTimeout(150)
    check(tag, 'mode OFF preserves native selection and writes nothing', (await rows()).length === 0 && (await page.evaluate(() => getSelection().toString())).length > 0)
    await button.focus(); await page.keyboard.press('Enter')
    check(tag, 'keyboard activation is visible and accessible', await button.getAttribute('aria-pressed') === 'true' && await button.evaluate(el => getComputedStyle(el).boxShadow !== 'none'))
    await body.locator('p').first().evaluate(el => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(200)
    // Real desktop pointer drag through the browser's native selection mechanism.
    const points = await body.locator('p').first().evaluate(el => {
      const node = el.firstChild
      const point = offset => { const r = document.createRange(); r.setStart(node, offset); r.collapse(true); const b = r.getBoundingClientRect(); return { x: b.x, y: b.y + b.height / 2 } }
      return { start: point(25), end: point(80) }
    })
    await page.mouse.move(points.start.x, points.start.y); await page.mouse.down()
    await page.mouse.move(points.end.x, points.end.y, { steps: 20 }); await page.mouse.up()
    await waitCount(1)
    check(tag, 'native pointer drag commits automatically, mode stays enabled', await button.getAttribute('aria-pressed') === 'true' && (await rows())[0].quote.length > 0)
    check(tag, 'article DOM and sanitization remain unchanged', await markup() === untouched && await body.locator('mark[data-highlight]').count() === 0)
    await page.evaluate(() => getSelection().removeAllRanges())
    await page.screenshot({ path: fileURLToPath(new URL(tag + '-highlight.png', out)) })
    const first = (await rows())[0]
    check(tag, 'record has stable identity, article/subject snapshots and bounded anchor', first.version === 1 && first.highlightId && first.articleUrl === URLS.rbi && first.subjectSnapshot && first.anchor.prefix.length <= 64 && first.anchor.suffix.length <= 64)
    await reader.evaluate(el => el.scrollTop = 0)
    await reader.getByRole('button', { name: 'Highlight colors and edits', exact: true }).click()
    const panel = page.locator('[data-highlight-ui]')
    await panel.waitFor()
    await panel.getByRole('group', { name: 'Highlight color' }).first().getByRole('button', { name: 'Green', exact: true }).click()
    check(tag, 'palette has five fixed colors with a check and pressed state', await panel.getByRole('group', { name: 'Highlight color' }).first().getByRole('button').count() === 5 && await panel.getByRole('group', { name: 'Highlight color' }).first().getByRole('button', { name: 'Green', exact: true }).getAttribute('aria-pressed') === 'true')
    await page.screenshot({ path: fileURLToPath(new URL(tag + '-palette.png', out)) })
    await page.keyboard.press('Escape'); await panel.waitFor({ state: 'detached' })
    const inlineQuote = await pick('inline', 'touch')
    await page.waitForTimeout(650)
    await page.evaluate(() => document.dispatchEvent(new Event('selectionchange')))
    await page.waitForTimeout(800)
    check(tag, 'touch handle adjustment resets completion and does not save prematurely', (await rows()).length === 1)
    await waitCount(2)
    check(tag, 'touch quiet completion preserves exact inline quote and future color', (await rows()).some(r => r.quote === inlineQuote && r.color === 'green') && await markup() === untouched)
    await pick('blocks', 'pen')
    await page.waitForTimeout(300)
    check(tag, 'pen selection is pending while handles can be adjusted', (await rows()).length === 2)
    await waitCount(3)
    check(tag, 'multi-block pen selection paints one logical Range across paragraphs', (await rows()).some(r => r.anchor.quote.includes('Paragraph') && r.quote.length > 100) && await page.evaluate(() => [...CSS.highlights.get('tars-green')].some(r => r.startContainer.parentElement !== r.endContainer.parentElement)))
    // Same range selection is a no-op; overlapping extension does not corrupt prior records.
    await pick('first'); await page.waitForTimeout(150)
    check(tag, 'repeat selection creates no nested duplicates', (await rows()).length === 3)
    await pick('overlap'); await page.waitForTimeout(150)
    check(tag, 'different-color overlap rejects without changing existing records', (await rows()).length === 3 && (await rows()).find(r => r.highlightId === first.highlightId).color === 'yellow')
    await reader.evaluate(el => el.scrollTop = 0)
    await reader.evaluate(el => el.scrollTop = 0)
    await reader.getByRole('button', { name: 'Highlight colors and edits', exact: true }).click(); await panel.waitFor()
    await panel.locator('.highlight-edit').first().getByRole('button', { name: 'Pink', exact: true }).click()
    await page.waitForFunction(id => [...CSS.highlights.get('tars-pink')].length === 1, first.highlightId)
    check(tag, 'existing highlight recolor preserves identity', (await rows()).find(r => r.highlightId === first.highlightId).color === 'pink')
    await panel.locator('.highlight-edit').last().getByRole('button', { name: /^Delete highlight:/ }).click()
    await waitCount(2)
    check(tag, 'delete removes paint and retains tombstone', (await rows()).length === 2)
    await page.keyboard.press('Escape'); await panel.waitFor({ state: 'detached' })
    await button.click()
    await page.reload(); await body.waitFor(); await waitCount(2)
    check(tag, 'page reload restores paints and persisted active color', await button.getAttribute('aria-pressed') === 'false' && await page.evaluate(() => localStorage.getItem('tars.reader.highlight-color.v1')) === 'green')
    await reader.getByRole('button', { name: 'Back to News', exact: true }).click(); await reader.waitFor({ state: 'detached' })
    check(tag, 'closing clears only paint and restores the mounted News list', await painted() === 0 && await headline.isVisible())
    await headline.click(); await body.waitFor(); await waitCount(2)
    check(tag, 'reopen restores local records without extra publisher fetch', requests.get(URLS.rbi) === 2 && requests.size === 1)
    check(tag, 'Save/Read state stays independent', await page.evaluate(() => !JSON.parse(localStorage.getItem('tars.current-affairs.state.v1') ?? '{"entries":{}}').entries['https://indianexpress.com/article/fixture-rbi']))
    check(tag, 'no full body, HTML or extraction result is persisted', (await rows()).every(r => !('html' in r) && !('body' in r) && !('extraction' in r) && r.quote.length < 1000 && r.anchor.prefix.length <= 64 && r.anchor.suffix.length <= 64))
    const contrast = await page.evaluate(() => {
      const lum = rgb => { const values = rgb.map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4); return values[0] * .2126 + values[1] * .7152 + values[2] * .0722 }
      return ['yellow', 'green', 'blue', 'pink', 'orange'].map(c => {
        const s = getComputedStyle(document.querySelector('.reader-body'), '::highlight(tars-' + c + ')')
        const rgb = value => value.match(/\d+/g).slice(0, 3).map(Number)
        const a = lum(rgb(s.color)), b = lum(rgb(s.backgroundColor))
        return { color: c, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) }
      })
    })
    check(tag, 'all five paint colors have readable 4.5:1 text contrast', contrast.every(c => c.ratio >= 4.5))
    check(tag, 'Reader and toolbar fit viewport without sideways scroll', await reader.evaluate(el => el.scrollWidth <= el.clientWidth) && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    // Many persisted excerpts in a long article: restore through the production Reader, not a mock painter.
    await reader.getByRole('button', { name: 'Back to News', exact: true }).click()
    await reader.waitFor({ state: 'detached' })
    const size = await page.evaluate(async metadata => {
      const request = indexedDB.open('tars-reader-highlights', 10)
      const db = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
      const tx = db.transaction('records', 'readwrite')
      const now = Date.now()
      for (let n = 30; n < 110; n++) {
        const quote = `Paragraph ${n} ZETAMARKER reports that the committee reviewed the scheme and set out what it found in the districts it visited during the monsoon session.`
        tx.objectStore('records').put({ ...metadata, highlightId: 'perf-' + n, quote, anchor: { version: 1, quote, prefix: '', suffix: '', start: 0, end: quote.length }, createdAt: now + n, updatedAt: now + n, resolution: 'pending' })
      }
      await new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error) })
      db.close()
      return 82
    }, (await rows())[0])
    const started = performance.now()
    // Native IndexedDB fixture writes bypass Dexie's observable query cache.
    // A real reload makes this a cold restoration check, as it is for persisted user data.
    await headline.click(); await page.reload(); await body.waitFor(); await waitCount(size)
    const elapsed = performance.now() - started
    check(tag, 'long article restores 82 saved excerpts and stays scrollable', await body.locator('p').count() >= 180 && await painted() === 82 && await reader.evaluate(el => el.scrollHeight > el.clientHeight * 10))
    await reader.evaluate(el => el.scrollTo(0, el.scrollHeight / 2))
    await page.screenshot({ path: fileURLToPath(new URL(tag + '-long-article.png', out)) })
    performanceEvidence.push({ tag, savedHighlights: 82, paragraphs: await body.locator('p').count(), reloadToPaintMs: Math.round(elapsed) })
    await ctx.close()
  }
  assert.deepEqual(errors, [])
  writeFileSync(new URL('results.json', out), JSON.stringify({ checks: checks.length, errors, performance: performanceEvidence, evidence: checks }, null, 2))
  console.log('H1 highlight browser checks: ' + checks.length + ' passed')
} finally { await browser.close(); server.close() }
