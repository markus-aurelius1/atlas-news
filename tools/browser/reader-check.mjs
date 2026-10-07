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
import { FEED_REGISTRY_GENERATION } from '../../src/current-affairs/shards.ts'
import { prepare } from './lib.mjs'

const dist = resolve(process.env.CA_DIST ?? fileURLToPath(new URL('../../dist/', import.meta.url))), out = new URL('./out/reader/', import.meta.url)
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
  [URLS.rbi]: () => rich,
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
const checks = [], errors = []
const check = (tag, name, evidence = true) => { assert(evidence, `${tag}: ${name}`); checks.push({ tag, name }); console.log(`PASS ${tag}: ${name}`) }
const picture = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"><rect width="1200" height="675" fill="#b9c8c4"/><path d="M0 675L420 210L760 520L940 380L1200 675Z" fill="#5f7a70"/><circle cx="930" cy="170" r="64" fill="#e9dfc6"/></svg>'

try {
  for (const width of [375, 1366]) for (const theme of ['light', 'dark']) {
    const tag = `${width}-${theme}`
    requests.clear(); healthFailures = 1; session = 'ok'; sessionVisits = 0
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, timezoneId: 'Asia/Kolkata', serviceWorkers: 'block' }), page = await ctx.newPage()
    page.on('pageerror', e => errors.push(`${tag}: ${e.message}`))
    await ctx.route('https://**/*fixture*', route => route.fulfill({ contentType: 'text/html', body: '<h1>Original publisher fixture</h1>' }))
    // smry.ai is stood in for: the check is about where Tars sends the reader, not about that service.
    await ctx.route(url => url.hostname === 'smry.ai', route => route.fulfill({ contentType: 'text/html', body: '<h1>Outside Tars</h1>' }))
    await ctx.route('https://images.example.org/**', route => route.request().url().includes('broken') ? route.fulfill({ status: 404 }) : route.fulfill({ contentType: 'image/svg+xml', body: picture }))
    const shot = name => page.screenshot({ path: fileURLToPath(new URL(`${tag}-${name}.png`, out)) })
    const rows = page.locator('[data-news-event]'), reader = page.locator('[data-reader]')
    const story = text => rows.filter({ hasText: text }).first()
    const headline = text => story(text).locator('[data-news-original]').first()
    const open = async text => { await headline(text).click(); await reader.waitFor() }
    const close = async () => { await reader.getByRole('button', { name: 'Back to News', exact: true }).first().click(); await reader.waitFor({ state: 'detached' }) }
    const listTop = () => page.evaluate(() => Math.max(scrollY, document.querySelector('.stage-scroll')?.scrollTop ?? 0))
    const scrollReader = y => reader.evaluate((el, top) => new Promise(done => { el.scrollTo(0, top === -1 ? el.scrollHeight : top); requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 120))) }), y)
    const notice = () => reader.getByRole('alert')
    const marks = url => page.evaluate(key => JSON.parse(localStorage.getItem('tars.current-affairs.state.v1') ?? '{"entries":{}}').entries[key] ?? {}, url)

    await prepare(page, base, { route: '#/current-affairs' })
    await rows.first().waitFor()
    const total = await rows.count()
    check(tag, 'the list is unchanged before reading', total >= 9)

    // ── Opening ──
    const link = headline('RBI revises')
    check(tag, 'a headline is still a safe link to the publisher', await link.getAttribute('href') === URLS.rbi && await link.getAttribute('target') === '_blank' && (await link.getAttribute('rel')).includes('noopener'))
    await link.click(); await reader.waitFor()
    check(tag, 'a headline opens the reader inside Tars, not the publisher', (await page.evaluate(() => location.hash)).includes('read=') && ctx.pages().length === 1)
    check(tag, 'the reader is a full-screen modal dialog', await reader.getAttribute('role') === 'dialog' && await reader.getAttribute('aria-modal') === 'true' && await reader.evaluate(el => { const r = el.getBoundingClientRect(); return r.x === 0 && r.y === 0 && r.width === innerWidth && r.height === innerHeight }))
    check(tag, 'the app behind is inert, not gone', await page.evaluate(() => document.getElementById('root').inert) && await rows.count() === total)
    check(tag, 'headline and excerpt come from the feed', await reader.locator('h1').innerText() === 'RBI revises banking liquidity regulation framework' && (await reader.locator('.reader-standfirst').innerText()).startsWith('The central bank has rewritten'))
    await reader.locator('.reader-body').waitFor()
    check(tag, 'one gateway request for the opened article, none for any other', requests.get(URLS.rbi) === 1 && requests.size === 1)

    // ── The article as drawn ──
    const body = reader.locator('.reader-body')
    check(tag, 'paragraphs, headings, quotation, list and table are kept', await body.locator('p').count() >= 15 && await body.locator('h2').innerText() === 'What the committee found' && await body.locator('h3').count() === 3 && await body.locator('blockquote').count() === 1 && await body.locator('ul li').count() === 2 && await body.locator('.reader-table td').count() === 4)
    await page.waitForFunction(() => { const img = document.querySelector('[data-reader] .reader-figure img'); return img && img.complete && img.naturalWidth > 0 })
    const figure = reader.locator('.reader-figure').first()
    check(tag, 'the picture keeps its caption and loads without a referrer', await figure.locator('figcaption').innerText() === 'The reservoir in June. Photo: Fixture' && await figure.locator('img').getAttribute('referrerpolicy') === 'no-referrer' && await figure.locator('img').getAttribute('alt') === 'A reservoir at low water')
    await reader.locator('.reader-figure img[alt="Broken"]').waitFor({ state: 'detached' })
    check(tag, 'a picture that fails disappears with its caption', !(await body.innerText()).includes('A picture that fails to load'))
    check(tag, 'publisher furniture is removed', !(await body.innerText()).includes('Also Read') && !(await reader.innerText()).includes('Home'))
    check(tag, 'no script, handler, form or unsafe link reaches the page', await reader.evaluate(el => el.querySelectorAll('script, iframe, form, input, [onclick], [onerror], [style*="expression"], a[href^="javascript"]').length === 0) && await page.evaluate(() => window.__pwned === undefined))
    const relative = body.locator('a', { hasText: 'relative link' })
    check(tag, 'article links are absolute and open outside the reader', await relative.getAttribute('href') === 'https://indianexpress.com/explained/related' && await relative.getAttribute('target') === '_blank' && (await relative.getAttribute('rel')).includes('noopener'))
    const stats = body.locator('.reader-stats').first()
    check(tag, 'an infographic’s figures are one grid of number, unit and label, not loose lines', await body.locator('.reader-stats').count() === 2 && await stats.locator('.reader-stat').count() === 3 && await stats.locator('.reader-stat').first().evaluate(el => el.querySelector('strong').textContent === '11,098' && el.querySelector('.reader-stat-value').textContent.replace(/\s+/g, ' ').trim() === '11,098 km' && el.querySelector('dt').textContent === 'Length of the coastline') && !(await body.locator('p').allInnerTexts()).some(t => /^(11,098|km|Length of the coastline)$/.test(t.trim())))
    check(tag, 'the grid is a grid: cells side by side where there is room, the number larger than its label', await stats.evaluate((el, wide) => { const cells = [...el.querySelectorAll('.reader-stat')].map(c => c.getBoundingClientRect()); const number = parseFloat(getComputedStyle(el.querySelector('strong')).fontSize), label = parseFloat(getComputedStyle(el.querySelector('dt')).fontSize); const sideBySide = cells[1].left > cells[0].right - 1 && Math.abs(cells[1].top - cells[0].top) < 2; return number >= label * 1.8 && cells.every(c => c.right <= innerWidth) && (wide ? sideBySide : true) }, width > 600))
    check(tag, 'a comparison keeps each figure with its note, under its tab’s name', (await body.locator('.reader-stats').nth(1).locator('.reader-stat-note').first().innerText()) === 'The first sovereign bond of its kind.' && (await body.locator('h3').allInnerTexts()).join('|') === 'By the numbers|Lessons|What happens next')
    const embed = body.locator('.reader-embed')
    check(tag, 'a removed embed leaves one quiet pointer to it; an advertising frame leaves nothing', await embed.count() === 1 && (await embed.innerText()).replace(/\s+/g, ' ').includes('Video on YouTube') && await embed.locator('a').getAttribute('href') === 'https://www.youtube.com/embed/fixture' && await embed.locator('a').getAttribute('target') === '_blank' && (await embed.locator('a').innerText()).trim() === 'View on original' && !(await body.innerHTML()).includes('ads.example'))
    await stats.scrollIntoViewIfNeeded(); await page.waitForTimeout(400); await shot('stats'); await scrollReader(0)
    check(tag, 'byline, date and reading time', (await reader.locator('.reader-meta').innerText()).includes('Fixture Reporter') && /min read/.test(await reader.locator('.reader-meta').innerText()) && /IST/.test(await reader.locator('.reader-meta').innerText()))
    check(tag, 'the reader never scrolls sideways', await reader.evaluate(el => el.scrollWidth <= el.clientWidth) && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    const measure = await body.evaluate(el => ({ width: el.getBoundingClientRect().width, size: parseFloat(getComputedStyle(el).fontSize), family: getComputedStyle(el).fontFamily, line: parseFloat(getComputedStyle(el).lineHeight) }))
    check(tag, 'a readable measure and line height', measure.width / measure.size <= 34 && measure.size >= 17 && measure.line / measure.size >= 1.5 && /Newsreader/.test(measure.family))
    await page.waitForTimeout(500); await shot('article')

    // ── Progress and quiet controls ──
    const progress = reader.getByRole('progressbar', { name: 'Reading progress' })
    check(tag, 'progress starts at the top', await progress.getAttribute('aria-valuenow') === '0')
    await scrollReader(700); await scrollReader(1400)
    check(tag, 'reading down advances progress and hides the controls', Number(await progress.getAttribute('aria-valuenow')) > 5 && await reader.evaluate(el => el.hasAttribute('data-quiet')))
    await shot('reading')
    await scrollReader(1200)
    check(tag, 'scrolling back returns the controls', !(await reader.evaluate(el => el.hasAttribute('data-quiet'))))
    await scrollReader(-1)
    check(tag, 'the end of the article is 100%', await progress.getAttribute('aria-valuenow') === '100' && await reader.locator('.reader-progress span').evaluate(el => getComputedStyle(el).transform === 'matrix(1, 0, 0, 1, 0, 0)' || getComputedStyle(el).transform === 'none'))
    check(tag, 'a rendered article offers Read Original and no other way out', await reader.evaluate((el, url) => { const out = [...el.querySelectorAll('a[target="_blank"]')].filter(a => !el.querySelector('.reader-body').contains(a)); return out.length === 3 && out.every(a => a.href === url) && !/smry|elsewhere/i.test(el.textContent) && [...el.querySelectorAll('a')].filter(a => a.textContent.trim() === 'Read Original').length === 2 }, URLS.rbi))
    check(tag, 'the end credits the publisher and offers the original', (await reader.locator('.reader-credit').innerText()).includes('Indian Express') && await reader.locator('.reader-end-actions a').getAttribute('href') === URLS.rbi)
    await page.waitForTimeout(400); await shot('end')

    // ── Typography ──
    await scrollReader(0)
    const settings = () => page.locator('[data-reader-type]')
    await reader.getByRole('button', { name: 'Text and appearance', exact: true }).click(); await settings().waitFor()
    await settings().getByRole('button', { name: 'Larger text', exact: true }).click()
    const larger = await body.evaluate(el => parseFloat(getComputedStyle(el).fontSize))
    check(tag, 'text size steps up', larger > measure.size * 1.05)
    await settings().getByRole('radio', { name: 'Sans', exact: true }).click()
    check(tag, 'typeface changes', !/^"?Newsreader/.test(await body.evaluate(el => getComputedStyle(el).fontFamily)))
    await settings().getByRole('radio', { name: 'Wide', exact: true }).click(); await settings().getByRole('radio', { name: 'Relaxed', exact: true }).click()
    await page.waitForTimeout(350); await shot('type')
    const wide = await body.evaluate(el => ({ width: el.getBoundingClientRect().width, line: parseFloat(getComputedStyle(el).lineHeight) / parseFloat(getComputedStyle(el).fontSize) }))
    check(tag, 'column and line spacing change', wide.line > 1.7 && (width < 600 || wide.width > measure.width))
    check(tag, 'the reading settings are kept on this device', await page.evaluate(() => { const p = JSON.parse(localStorage.getItem('tars.reader.prefs')); return p.face === 'sans' && p.width === 'wide' && p.leading === 'relaxed' && p.size === 3 }))
    await page.keyboard.press('Escape'); await settings().waitFor({ state: 'detached' })
    check(tag, 'Escape closes the settings, not the reader', await reader.count() === 1)
    await page.reload(); await reader.locator('.reader-body').waitFor()
    check(tag, 'a reload returns to the same article with the same settings', await reader.locator('h1').innerText() === 'RBI revises banking liquidity regulation framework' && await reader.getAttribute('data-face') === 'sans' && await reader.getAttribute('data-width') === 'wide')
    await page.evaluate(() => localStorage.removeItem('tars.reader.prefs'))
    await page.reload(); await reader.locator('.reader-body').waitFor(); await close()
    check(tag, 'closing a reader opened from its address lands on the list', await page.evaluate(() => location.hash) === '#/current-affairs' && await rows.count() === total)

    // ── Closing, position, Back ──
    // Somewhere down the list, with the headline clear of the pinned header, so that a click moves nothing and losing the position would show.
    await rows.last().evaluate(el => el.scrollIntoView({ block: 'end' })); await link.evaluate(el => el.scrollIntoView({ block: 'center' })); const position = await listTop()
    await link.click(); await reader.waitFor(); await reader.locator('.reader-body').waitFor(); await scrollReader(500)
    await page.keyboard.press('Escape'); await reader.waitFor({ state: 'detached' })
    check(tag, 'Escape closes the reader and the list is where it was', Math.abs(await listTop() - position) <= 2 && (position > 0 || width > 600) && await page.evaluate(() => location.hash) === '#/current-affairs')
    check(tag, 'focus returns to the headline that was opened', await page.evaluate(() => document.activeElement?.getAttribute('href')) === URLS.rbi)
    check(tag, 'a reopened article is not fetched twice', requests.get(URLS.rbi) === 3)
    await link.click(); await reader.waitFor(); await page.goBack(); await reader.waitFor({ state: 'detached' })
    check(tag, 'the browser’s Back closes the reader', Math.abs(await listTop() - position) <= 2 && await rows.count() === total)
    const publisherTab = ctx.waitForEvent('page'); await link.click({ modifiers: ['ControlOrMeta'] }); const tab = await publisherTab; await tab.waitForLoadState()
    check(tag, 'a modified click still opens the publisher in another tab', tab.url() === URLS.rbi && await reader.count() === 0); await tab.close()

    // ── Read, Saved, previous and next ──
    await open('RBI revises'); await reader.locator('.reader-body').waitFor()
    const counter = await reader.locator('.reader-position').count() ? await reader.locator('.reader-position').getAttribute('aria-label') : null
    const read = reader.getByRole('button', { name: 'Read', exact: true }), saved = reader.getByRole('button', { name: 'Saved', exact: true })
    check(tag, 'Read and Saved start unset', await read.getAttribute('aria-pressed') === 'false' && await saved.getAttribute('aria-pressed') === 'false')
    await read.click(); await saved.click()
    check(tag, 'Read and Saved are recorded with the list’s own marks', await read.getAttribute('aria-pressed') === 'true' && await saved.getAttribute('aria-pressed') === 'true' && (await marks(URLS.rbi)).readAt > 0 && (await marks(URLS.rbi)).savedAt > 0)
    const historyLength = await page.evaluate(() => history.length)
    const next = reader.getByRole('button', { name: 'Next article', exact: true }), prev = reader.getByRole('button', { name: 'Previous article', exact: true })
    const firstTitle = await reader.locator('h1').innerText()
    await scrollReader(600); await scrollReader(1300)
    check(tag, 'next is offered although the article just left To Read', await next.isEnabled())
    check(tag, 'the controls are away while reading down', await reader.evaluate(el => el.hasAttribute('data-quiet')))
    await page.keyboard.press('j'); await page.waitForFunction(title => document.querySelector('[data-reader] h1')?.textContent !== title, firstTitle)
    const secondTitle = await reader.locator('h1').innerText()
    check(tag, 'next opens another article at its top with its controls in view, without adding history', secondTitle !== firstTitle && await page.evaluate(() => history.length) === historyLength && await reader.evaluate(el => el.scrollTop === 0 && !el.hasAttribute('data-quiet')))
    check(tag, 'the position follows', width < 640 || (counter !== await reader.locator('.reader-position').getAttribute('aria-label')))
    await page.keyboard.press('k'); await page.waitForFunction(title => document.querySelector('[data-reader] h1')?.textContent === title, firstTitle)
    check(tag, 'K returns to the previous article, still marked', await read.getAttribute('aria-pressed') === 'true' && await prev.count() === 1)
    await page.keyboard.press('j'); await page.waitForFunction(title => document.querySelector('[data-reader] h1')?.textContent === title, secondTitle)
    await reader.locator('.reader-body, .reader-notice').first().waitFor()
    await page.keyboard.press('Escape'); await reader.waitFor({ state: 'detached' })
    check(tag, 'Back from a stepped article returns straight to the list', await page.evaluate(() => location.hash) === '#/current-affairs')
    check(tag, 'the list shows what was marked in the reader', await rows.count() === total - 1 && await story('RBI revises').count() === 0)
    await page.getByRole('group', { name: 'Reading filter' }).getByRole('button', { name: 'Saved', exact: true }).click()
    check(tag, 'the saved article is in Saved, read', await rows.count() === 1 && await story('RBI revises').getAttribute('data-read') === 'true')
    await open('RBI revises'); await reader.locator('.reader-body').waitFor(); await reader.getByRole('button', { name: 'Read', exact: true }).click(); await reader.getByRole('button', { name: 'Saved', exact: true }).click(); await close()
    await page.getByRole('group', { name: 'Reading filter' }).getByRole('button', { name: 'To be Read', exact: true }).click()
    check(tag, 'unmarking in the reader restores the queue', await rows.count() === total && Object.keys(await marks(URLS.rbi)).length === 0)

    // ── Another publisher's report of the same story ──
    await story('RBI revises').locator('.story-cluster').click()
    await story('RBI revises').locator('[data-related-coverage] a').click(); await reader.waitFor(); await reader.locator('.reader-body').waitFor()
    check(tag, 'related coverage opens in the reader too', (await reader.locator('.reader-kicker').innerText()).toUpperCase().includes('THE HINDU') && await reader.locator('[data-reader-original]').getAttribute('href') === URLS.rbiHindu)
    const originalTab = ctx.waitForEvent('page'); await reader.locator('[data-reader-original]').click(); const original = await originalTab; await original.waitForLoadState()
    check(tag, 'Open original leads to the publisher’s own page', original.url() === URLS.rbiHindu && await reader.count() === 1); await original.close(); await close()

    // ── Loading ──
    await headline('New GDP series').click(); await reader.getByRole('status').waitFor()
    check(tag, 'while the publisher answers, the headline is shown and the text is not invented', await reader.locator('h1').innerText() === 'New GDP series uses double deflation' && await reader.locator('.reader-body').count() === 0 && (await reader.getByRole('status').innerText()).includes('Loading the article from Indian Express'))
    await shot('loading'); await reader.locator('.reader-body').waitFor(); await close()

    // ── Articles that cannot be shown ──
    const unavailable = async (text, title, { retry, url }) => {
      await open(text); await notice().waitFor()
      check(tag, `${title}: explained, with no article text`, (await notice().locator('h2').innerText()).includes(title) && await reader.locator('.reader-body').count() === 0 && !(await reader.innerText()).includes(MARK))
      const ways = await notice().locator('a').evaluateAll(links => links.map(a => [a.textContent.replace(/\s+/g, ' ').trim().replace(/\(\d+\/20 today\)/, '(n/20 today)'), a.href, a.target, a.rel]))
      check(tag, `${title}: exactly Read Original and smry.ai, each in a new tab`, JSON.stringify(ways) === JSON.stringify([['Read Original', url, '_blank', 'noopener noreferrer'], ['Read at smry.ai (n/20 today)', 'https://smry.ai/' + url, '_blank', 'noopener noreferrer']]) && !/Read elsewhere|removepaywall/i.test(await reader.innerHTML()) && retry === false && await notice().locator('a, button').count() === 2)
    }
    await unavailable('Supreme Court ruling', 'For subscribers', { retry: false, url: URLS.rights }); await page.waitForTimeout(300); await shot('subscribers'); await close()
    await unavailable('Ramsar protected area', 'Guardian declined the request', { retry: false, url: URLS.ramsar }); await close()
    await unavailable('UPSC Key', 'No article text to show', { retry: false, url: URLS.key }); await close()
    await unavailable('Finance Commission', 'Read this on Financial Times', { retry: false, url: URLS.ft })
    check(tag, 'a subscription publisher is never requested', !requests.has(URLS.ft)); await close()
    await unavailable('Ayushman Bharat', 'Couldn’t load this article', { retry: false, url: URLS.health })
    await close(); await open('Ayushman Bharat'); await reader.locator('.reader-body').waitFor()
    check(tag, 'a failed fetch is not remembered: reopening the article loads it', requests.get(URLS.health) === 2 && await reader.locator('.reader-body p').count() === 9); await close()
    // ── The smry.ai count ──
    const smry = () => notice().getByRole('link', { name: /Read at smry\.ai/ })
    const today = () => page.evaluate(() => { const d = new Date(), day = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); return (JSON.parse(localStorage.getItem('tars.reader.smry.v1') ?? '{"days":{}}').days[day] ?? []) })
    await open('Supreme Court ruling'); await notice().waitFor()
    check(tag, 'the count starts at nothing opened today', (await smry().innerText()).includes('(0/20 today)'))
    for (const expected of ['(1/20 today)', '(1/20 today)']) {
      const tabOpened = ctx.waitForEvent('page'); await smry().click(); const tab = await tabOpened; await tab.waitForLoadState()
      check(tag, 'smry.ai opens in another tab at the article: ' + expected, tab.url() === 'https://smry.ai/' + URLS.rights && (await smry().innerText()).includes(expected) && await reader.count() === 1); await tab.close()
    }
    await close()
    await open('Ramsar protected area'); await notice().waitFor()
    const second = ctx.waitForEvent('page'); await smry().click(); await (await second).close()
    check(tag, 'a different article is the second of the day, on every notice', (await smry().innerText()).includes('(2/20 today)') && JSON.stringify(await today()) === JSON.stringify([URLS.ramsar, URLS.rights].sort()))
    await page.evaluate(() => { const key = 'tars.reader.smry.v1', s = JSON.parse(localStorage.getItem(key)), day = Object.keys(s.days)[0]; s.days[day] = [...s.days[day], ...Array.from({ length: 19 }, (_, i) => 'https://example.org/' + i)]; localStorage.setItem(key, JSON.stringify(s)); dispatchEvent(new Event('tars:reader-smry')) })
    await page.waitForFunction(() => document.querySelector('[data-reader-elsewhere]')?.textContent.includes('(21/20 today)'))
    check(tag, 'past twenty the count goes on and the link still opens', await smry().isEnabled() && await smry().getAttribute('href') === 'https://smry.ai/' + URLS.ramsar && await smry().getAttribute('aria-disabled') === null)
    await page.evaluate(() => { const key = 'tars.reader.smry.v1', s = JSON.parse(localStorage.getItem(key)), day = Object.keys(s.days)[0]; localStorage.setItem(key, JSON.stringify({ version: 1, days: { '2020-01-01': s.days[day] } })); dispatchEvent(new Event('tars:reader-smry')) })
    await page.waitForFunction(() => document.querySelector('[data-reader-elsewhere]')?.textContent.includes('(0/20 today)'))
    check(tag, 'a new local day starts the count again'); await page.waitForTimeout(250); await shot('elsewhere'); await close()

    // ── A lapsed session ──
    session = 'expired'
    await open('WHO public health'); await notice().waitFor()
    check(tag, 'a lapsed Access session is named as one, with no ways round it offered', (await notice().locator('h2').innerText()) === 'Session expired' && await notice().locator('[data-reader-elsewhere]').count() === 0 && await reader.locator('.reader-body').count() === 0)
    await shot('session')
    await notice().getByRole('button', { name: 'Sign in again', exact: true }).click()
    await page.waitForURL(url => url.hash.includes('read=' + encodeURIComponent(URLS.who))); await reader.locator('.reader-body').waitFor()
    check(tag, 'after signing in the same article opens, loaded', sessionVisits === 1 && await reader.locator('h1').innerText() === 'WHO public health vaccination framework expands' && await page.evaluate(() => sessionStorage.getItem('tars.resume')) === null)
    sessionVisits = 0; await close()
    check(tag, 'and closing it lands on the list', await page.evaluate(() => location.hash) === '#/current-affairs' && await rows.count() === total)

    await open('ISRO launches'); await reader.getByRole('note').waitFor()
    check(tag, 'a short text is shown as possibly incomplete, never as the whole article', (await reader.getByRole('note').innerText()).includes('This may not be the whole article') && (await reader.locator('.reader-credit').innerText()).startsWith('Part of an article'))
    await page.waitForTimeout(300); await shot('partial'); await close()

    // ── Offline ──
    await ctx.setOffline(true)
    await open('El Niño'); await notice().waitFor()
    check(tag, 'offline: said plainly, with no request and no stale text', (await notice().locator('h2').innerText()).includes('offline') && !requests.has(URLS.wildfire) && await reader.locator('.reader-body').count() === 0)
    await page.waitForTimeout(300); await shot('offline')
    await ctx.setOffline(false); await reader.locator('.reader-body').waitFor()
    check(tag, 'back online, the article loads by itself', requests.get(URLS.wildfire) === 1); await close()
    await ctx.setOffline(true); await open('El Niño'); await reader.locator('.reader-body').waitFor()
    check(tag, 'an article read this visit is still there offline', requests.get(URLS.wildfire) === 1); await close(); await ctx.setOffline(false)

    // ── An address the list does not know ──
    await page.goto(base + '#/current-affairs?read=' + encodeURIComponent('https://www.thehindu.com/not-in-the-list')); await notice().waitFor()
    check(tag, 'an unknown article is not fetched', (await notice().innerText()).includes('isn’t in your reading list') && !requests.has('https://www.thehindu.com/not-in-the-list'))
    await notice().getByRole('button', { name: 'Back to News' }).click(); await reader.waitFor({ state: 'detached' })

    // ── Nothing of an article is left on the device ──
    const kept = await page.evaluate(async mark => {
      const found = []
      for (let i = 0; i < localStorage.length; i++) if ((localStorage.getItem(localStorage.key(i)) ?? '').includes(mark)) found.push('localStorage:' + localStorage.key(i))
      for (let i = 0; i < sessionStorage.length; i++) if ((sessionStorage.getItem(sessionStorage.key(i)) ?? '').includes(mark)) found.push('sessionStorage:' + sessionStorage.key(i))
      for (const name of await caches.keys()) for (const request of await (await caches.open(name)).keys()) if ((await (await caches.match(request)).text()).includes(mark)) found.push('cache:' + request.url)
      for (const { name } of await indexedDB.databases()) {
        const db = await new Promise((done, fail) => { const open = indexedDB.open(name); open.onsuccess = () => done(open.result); open.onerror = () => fail(open.error) })
        for (const store of db.objectStoreNames) {
          const all = await new Promise(done => { const get = db.transaction(store).objectStore(store).getAll(); get.onsuccess = () => done(get.result); get.onerror = () => done([]) })
          if (JSON.stringify(all).includes(mark)) found.push(`indexedDB:${name}/${store}`)
        }
        db.close()
      }
      return found
    }, MARK)
    check(tag, 'no article text is stored in localStorage, sessionStorage, Cache Storage or IndexedDB', kept.length === 0)
    check(tag, 'the list is intact after reading', await rows.count() === total && await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    await ctx.close()
  }
  assert.deepEqual(errors, [])
  writeFileSync(new URL('results.json', out), JSON.stringify({ checks, errors }, null, 2) + '\n')
  console.log(`${checks.length} reader checks passed; no page errors`)
} catch (error) {
  for (const ctx of browser.contexts()) for (const page of ctx.pages()) { await page.screenshot({ path: fileURLToPath(new URL('failure.png', out)) }).catch(() => {}); console.log((await page.locator('body').innerText().catch(() => '')).slice(-1500)) }
  throw error
} finally { await browser.close(); await new Promise(r => server.close(r)) }
