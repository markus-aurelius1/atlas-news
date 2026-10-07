/** Focused production fixture QA: four layouts, reading workflow, persistence and the owned offline cache. */
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, sep } from 'node:path'
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'
import { FEED_REGISTRY_GENERATION } from '../../src/current-affairs/shards.ts'
const dist = resolve(process.env.CA_DIST ?? fileURLToPath(new URL('../../dist/', import.meta.url))), out = new URL('./out/current-affairs-direct/', import.meta.url)
mkdirSync(out, { recursive: true })
const fetchedAt = new Date().toISOString()
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
const publishedAt = new Date(Date.now() - 2 * 3600000).toISOString(), yesterday = new Date(Date.now() - 30 * 3600000).toISOString()
const pastYear = `${Number(today.slice(0, 4)) - 1}-01-15`, pastMonth = `${today.slice(0, 4)}-01-15`
const stateKey = 'tars.current-affairs.state.v1'
const row = (title, sourceId, publisher, url) => ({ title, sourceId, publisher, url, section: 'Explained', description: '', publishedAt })
const fixture = { registryGeneration: FEED_REGISTRY_GENERATION, version: 1, fetchedAt, sources: [{ sourceId: 'ie-explained', status: 'ok', count: 5 }, { sourceId: 'ht-india', status: 'failed', count: 0 }], items: [
  { ...row('RBI revises banking liquidity regulation framework', 'ie-explained', 'Indian Express', 'https://indianexpress.com/article/fixture-rbi'), thumbnailUrl: 'https://images.example.org/fixture-thumbnail.jpg' },
  row('RBI revises banking liquidity regulation framework today', 'hindu-national', 'The Hindu', 'https://www.thehindu.com/fixture-rbi'),
  row('RBI master circular on credit facilities', 'rbi-notifications', 'RBI', 'https://www.rbi.org.in/fixture-old-circular'),
  { ...row('Ramsar protected area conservation expands', 'guardian-environment', 'Guardian', 'https://www.theguardian.com/fixture-environment'), thumbnailUrl: 'https://images.example.org/broken.jpg' },
  row('ISRO launches important lunar space mission', 'ie-explained', 'Indian Express', 'https://indianexpress.com/article/fixture-space'),
  { ...row('Supreme Court ruling on constitutional fundamental rights', 'hindu-national', 'The Hindu', 'https://www.thehindu.com/fixture-rights'), section: 'National', description: 'Feed supplied excerpt about the constitutional ruling.' },
  { ...row('Cabinet approves expansion of Ayushman Bharat scheme coverage', 'hindu-national', 'The Hindu', 'https://www.thehindu.com/fixture-health'), section: 'National' },
  { ...row('RBI monetary policy holds repo rate', 'mint-economy', 'Mint', 'https://www.livemint.com/fixture-old'), publishedAt: yesterday, section: 'Economy' },
  { ...row('ISRO launches new space mission', 'hindu-national', 'The Hindu', 'https://www.thehindu.com/fixture-undated'), publishedAt: null },
  { ...row('New GDP series uses double deflation', 'ie-economy', 'Indian Express', 'https://indianexpress.com/article/fixture-gdp'), section: 'Economy' },
  { ...row('UPSC Key: Poompuhar, NCERT Textbooks and Article 370', 'ie-upsc', 'Indian Express', 'https://indianexpress.com/article/fixture-key'), section: 'UPSC Current Affairs' },
  { ...row('El Niño-driven wildfires threaten orangutan habitat, IUCN Red List study warns', 'guardian-environment', 'Guardian', 'https://www.theguardian.com/fixture-wildfire'), thumbnailUrl: 'https://images.example.org/fixture-wildfire.jpg' },
  { ...row('WHO public health vaccination framework expands', 'ht-science', 'Hindustan Times', 'https://www.hindustantimes.com/fixture-recent-prior-day'), publishedAt: new Date(Date.now() - 23 * 3600000).toISOString() },
  row('Cricket score: India wins', 'ie-explained', 'Indian Express', 'https://indianexpress.com/article/fixture-cricket'),
  { ...row('Ramsar wetland conservation framework expands', 'dte-news', 'Down To Earth', 'https://www.downtoearth.org.in/fixture-past-year'), publishedAt: pastYear + 'T06:00:00Z' },
  { ...row('ISRO launches important lunar space mission', 'ie-explained', 'Indian Express', 'https://indianexpress.com/article/fixture-past-month'), publishedAt: pastMonth + 'T06:00:00Z' },
] }
let mode = 'ok', apiRequests = 0
const mime = { '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.html': 'text/html', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' }
const server = createServer(async (req, res) => {
  const path = new URL(req.url, 'http://localhost').pathname
  if (path === '/api/current-affairs') {
    apiRequests++
    const state = mode
    if (state === 'slow') await new Promise(r => setTimeout(r, 1000))
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-store')
    res.writeHead(state === 'fail' ? 503 : 200)
    res.end(JSON.stringify(state === 'fail' ? { error: 'Fixture failure' } : state === 'stale' ? { ...fixture, fetchedAt: new Date(Date.now() - 7200000).toISOString() } : state === 'trimmed' ? { ...fixture, items: fixture.items.filter(i => i.publishedAt === publishedAt) } : fixture)); return
  }
  if (path === '/api/article') {
    // The reader has its own check (reader-check.mjs); here it only needs an article to show.
    const target = new URL(req.url, 'http://localhost').searchParams.get('url')
    res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'private, no-store')
    res.end(JSON.stringify({ v: 1, url: target, html: '<!doctype html><html><head><title>Fixture</title></head><body><article>' + Array.from({ length: 8 }, (_, i) => '<p>Fixture paragraph ' + i + ' reports that the committee reviewed the scheme and set out what it found in the districts it visited during the session.</p>').join('') + '</article></body></html>' })); return
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
try {
  for (const width of process.argv.includes('--workbox-only') ? [] : [375, 1366]) for (const theme of ['light', 'dark']) {
    const tag = width + '-' + theme
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, timezoneId: 'Asia/Kolkata', serviceWorkers: 'block' }), page = await ctx.newPage()
    page.on('pageerror', e => errors.push(e.message))
    await ctx.route('https://**/*fixture*', route => route.fulfill({ contentType: 'text/html', body: '<h1>Original publisher fixture</h1>' }))
    await ctx.route('https://images.example.org/**', route => route.request().url().includes('broken') ? route.fulfill({ status: 404 }) : route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="#bac9c9"/><path d="M0 100L65 20L120 100Z" fill="#647b6f"/></svg>' }))
    const rows = page.locator('[data-news-event]'), reading = page.getByRole('group', { name: 'Reading filter' }), edition = page.getByRole('group', { name: 'Edition' })
    const queue = async name => reading.getByRole('button', { name, exact: true }).click()
    const showFilters = async () => { const b = page.getByRole('button', { name: 'Filters', exact: true }); if (await b.getAttribute('aria-expanded') === 'false') await b.click() }
    const filterDialog = () => page.getByRole('dialog', { name: 'News filters', exact: true })
    const subject = name => page.locator('[aria-label="Subject filter"] button:visible', { hasText: name }).first()
    const hideFilters = async () => { const dialog = page.getByRole('dialog', { name: 'News filters', exact: true }); if (await dialog.count()) { await dialog.getByRole('button', { name: 'Close', exact: true }).click(); await dialog.waitFor({ state: 'detached' }) } }
    const rbi = () => rows.filter({ hasText: 'RBI revises' })
    const read = row => row.getByRole('button', { name: /^Mark (?:as read|unread):/ })
    const save = row => row.getByRole('button', { name: /^(?:Save|Unsave) / })
    const overflow = async () => check(tag, 'no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    mode = 'fail'
    await prepare(page, base, { sample: false, route: '#/current-affairs' }); await page.getByRole('alert').waitFor()
    check(tag, 'first-load failure is visible')
    if (width === 375) check(tag, 'compact navigation remains usable', await page.getByRole('navigation', { name: 'Workspaces', exact: true }).getByRole('button').evaluateAll(buttons => buttons.length === 3 && buttons.every(el => { const r = el.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.x >= 0 && r.right <= innerWidth })))
    mode = 'slow'; await page.getByRole('button', { name: 'Refresh news' }).click(); await page.getByText('Loading trusted feeds…').waitFor(); check(tag, 'loading status')
    await rows.first().waitFor(); mode = 'ok'
    const requestsBeforeRouteSwitch = apiRequests
    await page.evaluate(() => { location.hash = '#/atlas' })
    await page.locator('[data-atlas-surface]').waitFor()
    await page.evaluate(() => { location.hash = '#/current-affairs' })
    await rows.first().waitFor()
    check(tag, 'fresh feed survives Atlas round-trip without refetch', apiRequests === requestsBeforeRouteSwitch)
    check(tag, 'retained state filters and Today default', await reading.locator('button[aria-pressed]').count() === 3 && await edition.getByRole('button', { name: 'Today', exact: true }).getAttribute('aria-pressed') === 'true')
    check(tag, 'nine rolling-24-hour articles including previous calendar day', await rows.count() === 9 && await rows.filter({ hasText: 'vaccination' }).count() === 1 && await rows.filter({ hasText: 'repo rate' }).count() === 0)
    check(tag, 'removed official feed is absent', await page.locator('a[href*="rbi.org.in"]').count() === 0)
    check(tag, 'archive remains a secondary contextual action', await edition.getByRole('button', { name: 'Archive', exact: true }).isVisible())
    check(tag, 'filters start collapsed', !await page.locator('#ca-filters').isVisible())
    check(tag, 'a group shows only its anchor, from a preferred publisher, with a compact count', await rbi().locator('[data-related-coverage]').count() === 0 && (await rbi().locator('.story-meta').innerText()).includes('Indian Express') && (await rbi().locator('[data-topic-count]').innerText()) === '+1 more')
    await rbi().locator('.story-cluster').click(); check(tag, 'grouped alternate original link', await rbi().locator('[data-related-coverage] a').getAttribute('href') === 'https://www.thehindu.com/fixture-rbi' && (await rbi().locator('[data-topic-count]').innerText()) === '2 articles')
    await rbi().locator('.story-cluster').click(); await rbi().locator('[data-related-coverage]').waitFor({ state: 'detached' }); check(tag, 'the group collapses again', await rbi().locator('.story-cluster').getAttribute('aria-expanded') === 'false')
    await page.waitForFunction(() => { const img = document.querySelector('[data-news-event] img'); return img && img.complete && img.naturalWidth > 0 })
    check(tag, 'RSS thumbnail loads lazily without a referrer', await rbi().locator('img').getAttribute('loading') === 'lazy' && await rbi().locator('img').getAttribute('referrerpolicy') === 'no-referrer')
    await rows.filter({ hasText: 'Ramsar' }).scrollIntoViewIfNeeded(); await rows.filter({ hasText: 'Ramsar' }).locator('img').waitFor({ state: 'detached' }); check(tag, 'broken image disappears')
    await showFilters()
    for (const exam of ['Prelims', 'Mains', 'Both']) { await filterDialog().getByRole('group', { name: 'Exam filter' }).getByRole('button', { name: exam, exact: true }).click(); check(tag, exam + ' filter keeps supported coverage and no noise', await rows.count() > 0 && await rows.filter({ hasText: 'Cricket' }).count() === 0) }
    await filterDialog().getByRole('button', { name: 'All exams', exact: true }).click(); await hideFilters()
    await subject('Economy').click(); check(tag, 'subject filter', await rows.count() >= 1 && await subject('Economy').getAttribute('aria-pressed') === 'true'); await subject('Economy').click()
    await showFilters(); await page.getByLabel('Publisher filter').selectOption('The Hindu'); check(tag, 'publisher filter includes grouped alternate coverage', await rbi().count() === 1)
    await hideFilters(); check(tag, 'hidden filters stay resettable', await page.getByRole('button', { name: 'Reset filters', exact: true }).isVisible()); await page.getByRole('button', { name: 'Reset filters', exact: true }).click()
    check(tag, 'reset restores the whole queue', await rows.count() === 9)
    await showFilters()
    for (const budget of [15, 30, 60]) { const b = page.getByRole('button', { name: budget + ' min', exact: true }); await b.click(); check(tag, budget + ' minute unread plan', await rows.count() > 0 && (await page.locator('.news-summary').innerText()).includes('min plan')); await b.click() }
    await hideFilters()
    await page.getByRole('button', { name: 'Search news', exact: true }).click()
    const search = page.getByLabel('Search articles, topics or sources'); await search.fill('GDP'); check(tag, 'metadata search', await rows.count() === 1); await search.fill(''); await search.focus(); await page.keyboard.type('jrsko'); check(tag, 'typing is uninterrupted', await search.inputValue() === 'jrsko'); await search.fill('')
    const original = rbi().locator('[data-news-original]'); check(tag, 'direct safe original publisher link', await original.getAttribute('target') === '_blank' && (await original.getAttribute('rel')).includes('noopener'))
    const readerDialog = page.getByRole('dialog', { name: /^Reader:/ }), leaveReader = async () => { await readerDialog.getByRole('button', { name: 'Back to News', exact: true }).click(); await readerDialog.waitFor({ state: 'detached' }) }
    await original.scrollIntoViewIfNeeded(); const position = await page.evaluate(() => scrollY); await original.click(); await readerDialog.locator('.reader-body').waitFor(); check(tag, 'the headline opens the reader over the list', await rows.count() === 9); await leaveReader(); check(tag, 'return preserves list position', Math.abs(await page.evaluate(() => scrollY) - position) <= 2)
    check(tag, 'opening an article is not reading it', await rows.count() === 9 && await page.evaluate(key => !JSON.parse(localStorage.getItem(key) ?? '{"entries":{}}').entries['https://indianexpress.com/article/fixture-rbi'], stateKey))
    const unreadInk = await rbi().locator('h3').evaluate(el => getComputedStyle(el).color)
    await read(rbi()).click(); check(tag, 'marking done moves out of To be Read', await rows.count() === 8 && await rbi().count() === 0)
    await queue('Read'); check(tag, 'read article moves into Read', await rows.count() === 1 && await rbi().count() === 1)
    check(tag, 'read headline is quieter', await rbi().getAttribute('data-read') === 'true' && await rbi().locator('h3').evaluate(el => getComputedStyle(el).color) !== unreadInk)
    await save(rbi()).click(); check(tag, 'saving a read article moves it out of Read', await rows.count() === 0)
    await queue('Saved'); check(tag, 'Saved owns a read saved article', await rows.count() === 1 && await read(rbi()).getAttribute('aria-pressed') === 'true')
    await page.reload(); await rows.first().waitFor(); check(tag, 'reload defaults to pending with read/save persisted', await rows.count() === 8)
    await queue('Saved'); check(tag, 'read saved state survives reload', await rows.count() === 1 && await read(rbi()).getAttribute('aria-pressed') === 'true')
    const other = await ctx.newPage(); await other.goto(base); await other.evaluate(key => { const s = JSON.parse(localStorage.getItem(key)); s.entries['https://indianexpress.com/article/fixture-rbi'].note = 'Legacy note preserved'; localStorage.setItem(key, JSON.stringify(s)) }, stateKey); await other.close(); await page.waitForTimeout(100)
    await save(rbi()).click(); await queue('Read'); await read(rbi()).click(); await queue('To be Read'); check(tag, 'unsave and unread restore pending', await rows.count() === 9)
    check(tag, 'legacy notes survive new actions', await page.evaluate(key => JSON.parse(localStorage.getItem(key)).entries['https://indianexpress.com/article/fixture-rbi'].note, stateKey) === 'Legacy note preserved')
    await save(rbi()).click(); await queue('Saved'); await read(rbi()).click(); check(tag, 'marking saved article read keeps it in Saved', await rows.count() === 1)
    check(tag, 'Read and Saved use existing durable timestamps', await page.evaluate(key => { const p = JSON.parse(localStorage.getItem(key)).entries['https://indianexpress.com/article/fixture-rbi']; return p.readAt > 0 && p.savedAt > 0 && p.note === 'Legacy note preserved' }, stateKey))
    await rbi().getByRole('button', { name: /^Remove article:/ }).click(); check(tag, 'removing saved article hides it immediately', await rows.count() === 0)
    await page.getByRole('button', { name: 'Undo', exact: true }).click(); check(tag, 'Undo restores saved article and progress', await rows.count() === 1 && await read(rbi()).getAttribute('aria-pressed') === 'true')
    await queue('To be Read'); const gdp = rows.filter({ hasText: 'GDP' }); await gdp.getByRole('button', { name: /^Remove article:/ }).click(); check(tag, 'remove pending persists ignoredAt', await rows.count() === 7 && await page.evaluate(key => JSON.parse(localStorage.getItem(key)).entries['https://indianexpress.com/article/fixture-gdp'].ignoredAt > 0, stateKey))
    await page.reload(); await rows.first().waitFor(); check(tag, 'removed article stays absent after reload', await rows.count() === 7 && await rows.filter({ hasText: 'GDP' }).count() === 0)
    await page.getByRole('button', { name: 'Archive', exact: true }).click(); check(tag, 'archive excludes every rolling-Today item', await rows.count() === 4 && await rbi().count() === 0 && await rows.filter({ hasText: 'vaccination' }).count() === 0)
    check(tag, 'archive starts newest first with undated last', (await rows.first().innerText()).includes('repo rate') && (await rows.last().innerText()).includes('Undated'))
    await showFilters()
    for (const grouping of ['Daily', 'Weekly', 'Monthly', 'Yearly']) { await page.getByLabel('Archive grouping').selectOption(grouping); const options = await page.getByLabel('Archive period').locator('option').count(); check(tag, grouping + ' archive filters are available', options > 1) }
    await page.getByLabel('Archive period').selectOption(pastYear.slice(0, 4)); check(tag, 'prior year filtering', await rows.count() === 1 && (await rows.innerText()).includes('Down To Earth')); await filterDialog().getByRole('button', { name: 'Reset filters', exact: true }).click(); await hideFilters()
    const old = rows.filter({ hasText: 'repo rate' }); await old.getByRole('button', { name: /^Remove article:/ }).click(); check(tag, 'archive removal hides irrelevant older item', await rows.count() === 3)
    await page.getByRole('button', { name: 'Undo', exact: true }).last().click(); check(tag, 'archive Undo restores original ordering', (await rows.first().innerText()).includes('repo rate'))
    await rows.filter({ hasText: 'Down To Earth' }).getByRole('button', { name: /^Save / }).click(); await queue('Saved'); check(tag, 'prior-year saved item is accessible in Archive', await rows.count() === 1)
    await page.screenshot({ path: fileURLToPath(new URL(tag + '-archive.png', out)), fullPage: true })
    mode = 'trimmed'; await page.getByRole('button', { name: 'Refresh news' }).click(); await page.getByText('Loading trusted feeds…').waitFor({ state: 'hidden' }); await page.reload(); await page.getByRole('button', { name: 'Archive', exact: true }).click(); await queue('Saved'); await rows.first().waitFor(); check(tag, 'old saved metadata survives feed omission and reload', (await rows.innerText()).includes('Down To Earth'))
    await edition.getByRole('button', { name: 'Today', exact: true }).click(); await queue('To be Read'); check(tag, 'Today restores the pending queue', await rows.count() === 7)
    const dormant = JSON.stringify({ version: 1, entries: { historical: { id: 'historical', text: 'Keep dated note verbatim', createdDate: today, createdAt: 1 } } })
    await page.evaluate(value => localStorage.setItem('tars.current-affairs.notes.v1', value), dormant)
    await page.reload(); await rows.first().waitFor()
    check(tag, 'dormant dated note collection survives reload verbatim', await page.evaluate(() => localStorage.getItem('tars.current-affairs.notes.v1')) === dormant)
    check(tag, 'dormant article note survives reload', await page.evaluate(key => JSON.parse(localStorage.getItem(key)).entries['https://indianexpress.com/article/fixture-rbi'].note, stateKey) === 'Legacy note preserved')
    const openOriginal = rbi().locator('[data-news-original]')
    await queue('Saved')
    check(tag, 'the headline links to the same safe canonical URL', await openOriginal.getAttribute('href') === 'https://indianexpress.com/article/fixture-rbi' && await openOriginal.getAttribute('target') === '_blank' && (await openOriginal.getAttribute('rel')).includes('noopener'))
    await openOriginal.click(); await readerDialog.locator('.reader-body').waitFor(); const openWait = page.waitForEvent('popup'); await readerDialog.locator('[data-reader-original]').click(); const opened = await openWait; await opened.waitForLoadState(); check(tag, 'the reader’s Open original leads to the publisher', opened.url() === 'https://indianexpress.com/article/fixture-rbi'); await opened.close(); await leaveReader(); await queue('To be Read')
    mode = 'stale'; await page.getByRole('button', { name: 'Refresh news' }).click(); await page.getByText(/Refresh due – showing cached feed/).waitFor(); check(tag, 'stale metadata is explicit')
    await ctx.setOffline(true); const requestsBeforeOfflineRefresh = apiRequests; await page.getByRole('button', { name: 'Refresh news' }).click(); await page.getByText(/Offline – cached feed/).waitFor(); check(tag, 'offline refresh makes no API request', apiRequests === requestsBeforeOfflineRefresh); check(tag, 'offline preserves pending queue and state', await rows.count() === 7); await overflow()
    await ctx.setOffline(false); mode = 'ok'; await page.getByRole('button', { name: 'Refresh news' }).click(); await page.getByText('Loading trusted feeds…').waitFor({ state: 'hidden' }); await hideFilters(); for (const b of await page.getByRole('button', { name: 'Dismiss', exact: true }).all()) await b.click(); await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(400); await page.screenshot({ path: fileURLToPath(new URL(tag + '.png', out)), fullPage: true })
    await page.goto(base + '#/current-affairs?debug=1'); await rows.first().waitFor(); await rows.first().getByText('Evidence', { exact: true }).click(); check(tag, 'debug preserves classifier evidence', (await page.locator('pre').first().innerText()).includes('mustReadScore'))
    check(tag, 'no generic search references', await page.locator('a[href*="google.com/search"], a[href*="wikipedia.org/w/index.php"]').count() === 0); await overflow(); await ctx.close()
  }
  mode = 'ok'

  const ctx = await browser.newContext(), page = await ctx.newPage()
  if (process.env.CACHE_DIAGNOSTIC) ctx.on('serviceworker', worker => {
    void worker.evaluate(() => {
      globalThis.qaCacheDeletes = []
      for (const prototype of [Cache.prototype, CacheStorage.prototype]) {
        const original = prototype.delete
        prototype.delete = function (...args) { globalThis.qaCacheDeletes.push({ url: String(args[0]?.url ?? args[0]), stack: new Error().stack }); return original.apply(this, args) }
      }
    }).catch(error => console.log('SW diagnostic setup:', error.message))
  })
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', msg => { if (msg.type() === 'error') console.log('Browser:', msg.text()) })
  await prepare(page, base, { sample: false, route: '#/current-affairs' })
  await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated', null, { timeout: 20000 })
  await page.reload(); await page.locator('[data-news-event]').first().waitFor()
  await page.waitForFunction(async () => !!await (await caches.open('tars-news-feed-v2')).match('/api/current-affairs'))
  check('News cache', 'successful API response cached')
  // A 503 cannot replace Tars' last successful local feed snapshot.
  mode = 'fail'; await page.getByRole('button', { name: 'Refresh news' }).click(); await page.getByRole('alert').waitFor()
  const cachedAfter503 = await page.evaluate(async () => {
    const cache = await caches.open('tars-news-feed-v2'), response = await cache.match('/api/current-affairs')
    return { keys: (await cache.keys()).map(key => key.url), fetchedAt: response && (await response.json()).fetchedAt }
  })
  console.log('News 503 cache evidence', cachedAfter503)
  check('News cache', '503 preserves last successful response', cachedAfter503.fetchedAt === fixture.fetchedAt)
  const cdp = await ctx.newCDPSession(page); await cdp.send('Network.clearBrowserCache'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  // A refresh is one request per shard; wait until the gateway has stopped receiving them before the connection is cut.
  for (let seen = -1; seen !== apiRequests;) { seen = apiRequests; await page.waitForTimeout(1500) }
  await ctx.setOffline(true); const requestsBeforeOfflineReload = apiRequests; await page.reload(); await page.locator('[data-news-event]').first().waitFor()
  check('News cache', 'offline reload makes no API request', apiRequests === requestsBeforeOfflineReload)
  check('News cache', 'offline reload with HTTP cache disabled shows today cached events', await page.locator('[data-news-event]').count() === 9)
  await page.getByRole('button', { name: 'Archive', exact: true }).click()
  check('News cache', 'offline archive includes earlier months and years', await page.locator('[data-news-event]').count() === 4)
  await page.evaluate(async () => (await caches.open('tars-news-feed-v2')).delete('/api/current-affairs'))
  await page.reload(); await page.locator('[data-news-event]').first().waitFor()
  const localFeedGone = await page.evaluate(async () => !await (await caches.open('tars-news-feed-v2')).match('/api/current-affairs'))
  check('Archive', 'offline metadata survives without the latest local feed snapshot', localFeedGone && await page.locator('[data-news-event]').count() === 9)
  await ctx.close()
  assert.deepEqual(errors, [])
  writeFileSync(new URL('results.json', out), JSON.stringify({ checks, errors }, null, 2) + '\n')
  console.log(`${checks.length} Current Affairs checks passed; no page errors`)
} catch (error) { for (const ctx of browser.contexts()) for (const page of ctx.pages()) { await page.screenshot({ path: fileURLToPath(new URL('failure.png', out)), fullPage: true }).catch(() => {}); console.log((await page.locator('body').innerText()).slice(-4000)) } throw error } finally { await browser.close(); await new Promise(r => server.close(r)) }
