/**
 * Two devices, one account, the real stack: the production build and the real Pages functions under
 * `wrangler pages dev`, a local D1 with the real migration, and Access tokens signed by a local issuer that
 * the functions verify exactly as they verify Cloudflare's. Each browser context is a device with its own
 * storage. Only the News feed is a fixture, so the check needs no publisher.
 *
 * Usage: npm run build && node tools/browser/sync-check.mjs   (CHROMIUM_PATH as for the other checks)
 */
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { webcrypto } from 'node:crypto'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const root = fileURLToPath(new URL('../../', import.meta.url)), out = new URL('./out/sync/', import.meta.url)
mkdirSync(out, { recursive: true })
const port = Number(process.env.SYNC_CHECK_PORT ?? 8799), base = `http://127.0.0.1:${port}/`
const state = mkdtempSync(join(tmpdir(), 'tars-sync-check-'))
const AUD = 'sync-check-audience', USER = 'reader@example.org', OTHER = 'someone-else@example.org'
const HISTORY = 1500
const checks = [], errors = [], usage = []
const check = (name, evidence = true) => { assert(evidence, name); checks.push(name); console.log('PASS ' + name) }
/** Records compared field by field, whatever order a store returns the fields in. */
const sameRecords = (a, b) => { const flat = list => JSON.stringify(list.map(r => Object.entries(r).sort(([x], [y]) => x.localeCompare(y))).sort((x, y) => JSON.stringify(x).localeCompare(JSON.stringify(y)))); return flat(a) === flat(b) }
const wrangler = (args, options = {}) => spawnSync('npx', ['wrangler', ...args], { cwd: root, shell: true, encoding: 'utf8', ...options })

// A stand-in for the Access team: publishes its keys where Access does, and signs tokens with them.
const pair = await webcrypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify'])
const jwk = { ...(await webcrypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'sync-check', alg: 'RS256', use: 'sig' }
let certRequests = 0
const issuerServer = createServer((req, res) => {
  if (req.url === '/cdn-cgi/access/certs') { certRequests++; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ keys: [jwk] })) }
  else { res.writeHead(404); res.end() }
})
await new Promise(r => issuerServer.listen(0, '127.0.0.1', r))
const issuer = `http://127.0.0.1:${issuerServer.address().port}`
const b64 = value => Buffer.from(value).toString('base64url')
async function token(email, claims = {}) {
  const now = Math.floor(Date.now() / 1000)
  const signed = `${b64(JSON.stringify({ alg: 'RS256', kid: 'sync-check', typ: 'JWT' }))}.${b64(JSON.stringify({ iss: issuer, aud: [AUD], email, sub: 'sub-' + email, iat: now, nbf: now - 5, exp: now + 3600, type: 'app', ...claims }))}`
  return `${signed}.${b64(new Uint8Array(await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(signed))))}`
}

// News feed fixture: two publishers on one story, and separate stories to mark.
const published = new Date(Date.now() - 2 * 3600000).toISOString()
const row = (title, sourceId, publisher, url, section = 'Explained') => ({ title, sourceId, publisher, url, section, description: '', publishedAt: published })
const RBI = 'https://indianexpress.com/article/fixture-rbi', RBI_HINDU = 'https://www.thehindu.com/fixture-rbi', SPACE = 'https://indianexpress.com/article/fixture-space', RIGHTS = 'https://www.thehindu.com/fixture-rights', GDP = 'https://indianexpress.com/article/fixture-gdp', HEALTH = 'https://www.thehindu.com/fixture-health'
const items = [
  row('RBI revises banking liquidity regulation framework', 'ie-explained', 'Indian Express', RBI),
  row('RBI revises banking liquidity regulation framework today', 'hindu-national', 'The Hindu', RBI_HINDU),
  row('ISRO launches important lunar space mission', 'ie-explained', 'Indian Express', SPACE),
  row('Supreme Court ruling on constitutional fundamental rights', 'hindu-national', 'The Hindu', RIGHTS, 'National'),
  row('Cabinet approves expansion of Ayushman Bharat scheme coverage', 'hindu-national', 'The Hindu', HEALTH, 'National'),
  row('New GDP series uses double deflation', 'ie-economy', 'Indian Express', GDP, 'Economy'),
]
const feed = list => ({ version: 1, fetchedAt: new Date().toISOString(), sources: [...new Set(list.map(i => i.sourceId))].map(sourceId => ({ sourceId, status: 'ok', count: 1 })), items: list })
const STATE_KEY = 'tars.current-affairs.state.v1'

let server
function stop() {
  if (server?.pid) process.platform === 'win32' ? spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F']) : server.kill('SIGKILL')
  issuerServer.close()
  try { rmSync(state, { recursive: true, force: true }) } catch { /* the runtime may still hold the files for a moment */ }
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
try {
  const migrated = wrangler(['d1', 'execute', 'tars-sync', '--local', '--persist-to', state, '--file', 'migrations/0001_sync.sql'])
  assert.equal(migrated.status, 0, migrated.stderr || migrated.stdout)
  let log = ''
  server = spawn('npx', ['wrangler', 'pages', 'dev', 'dist', '--port', String(port), '--ip', '127.0.0.1', '--persist-to', state, '--binding', `ACCESS_TEAM_DOMAIN=${issuer}`, '--binding', `ACCESS_AUD=${AUD}`, '--show-interactive-dev-session=false'], { cwd: root, shell: true })
  server.stdout.on('data', d => { log += d }); server.stderr.on('data', d => { log += d })
  for (let attempt = 0; ; attempt++) {
    if (server.exitCode !== null || attempt > 120) throw new Error('wrangler pages dev did not start:\n' + log)
    try { if ((await fetch(base)).ok) break } catch { /* not listening yet */ }
    await new Promise(r => setTimeout(r, 500))
  }

  /** A device: its own storage, and the token Access would attach for whoever is signed in on it. */
  async function device(name, { email = USER, list = items, seed } = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'Asia/Kolkata', serviceWorkers: 'block', ...(email ? { extraHTTPHeaders: { 'Cf-Access-Jwt-Assertion': await token(email) } } : {}) })
    const link = { sync: true, list }
    await ctx.route('**/api/current-affairs*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify(feed(link.list)) }))
    // "No route to the sync service" without cutting the rest of the page off.
    await ctx.route('**/api/sync', route => (link.sync ? route.continue() : route.abort('internetdisconnected')))
    if (seed) await ctx.addInitScript(([key, value]) => { if (localStorage.getItem(key) === null && !sessionStorage.getItem('seeded')) { localStorage.setItem(key, value); sessionStorage.setItem('seeded', '1') } }, [STATE_KEY, JSON.stringify(seed)])
    const page = await ctx.newPage()
    page.on('pageerror', e => errors.push(`${name}: ${e.message}`))
    page.on('response', response => { const u = response.headers()['x-tars-sync-usage']; if (u) usage.push({ device: name, usage: u, sent: JSON.parse(response.request().postData() ?? '{}').changes?.length ?? 0 }) })
    const rows = page.locator('[data-news-event]'), reading = page.getByRole('group', { name: 'Reading filter' })
    const open = async route => { await page.goto(base + route); await page.locator('main.stage:not([aria-busy="true"])').waitFor() }
    const news = async tab => { if (!page.url().includes('current-affairs')) { await open('#/current-affairs') } await reading.getByRole('button', { name: tab, exact: true }).click() }
    const titles = async tab => { await news(tab); await page.waitForTimeout(250); return (await rows.locator('h3').allInnerTexts()).map(t => t.trim()).sort() }
    const stored = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? '{"entries":{}}').entries, STATE_KEY)
    const line = () => page.locator('[data-sync]')
    const status = async () => { await open('#/settings'); await line().waitFor(); return { phase: await line().getAttribute('data-sync'), text: (await line().innerText()).replace(/\s+/g, ' ') } }
    /** Wait until the Settings line reports a state, then until nothing is waiting to be sent. */
    const settled = async (phase = 'synced') => { await open('#/settings'); await page.locator(`[data-sync="${phase}"]`).waitFor({ timeout: 30000 }); if (phase === 'synced') await page.waitForFunction(() => !/waiting on this device|Syncing…/.test(document.querySelector('[data-sync]')?.textContent ?? ''), null, { timeout: 30000 }) }
    const syncNow = async () => { await open('#/settings'); await line().getByRole('button', { name: 'Sync now' }).click(); await page.waitForTimeout(300); await settled() }
    const recalls = () => page.evaluate(() => new Promise((resolve, reject) => { const open = indexedDB.open('lodestar'); open.onerror = () => reject(open.error); open.onsuccess = () => { const get = open.result.transaction('recalls').objectStore('recalls').getAll(); get.onsuccess = () => { open.result.close(); resolve(get.result) } } }))
    const settings = () => page.evaluate(() => new Promise(resolve => { const open = indexedDB.open('lodestar'); open.onsuccess = () => { const get = open.result.transaction('settings').objectStore('settings').get('settings'); get.onsuccess = () => { open.result.close(); resolve(get.result) } } }))
    /** A change made in the app goes out by itself about a second and a half later: wait for that request, not for a button. */
    const sent = async () => { const from = usage.length; for (let i = 0; i < 100 && !usage.slice(from).some(u => u.device === name && u.sent > 0); i++) await page.waitForTimeout(100); assert(usage.slice(from).some(u => u.device === name && u.sent > 0), name + ' did not send its change on its own'); await settled() }
    return { name, ctx, page, link, rows, open, news, titles, stored, status, settled, sent, syncNow, recalls, settings }
  }
  const act = (d, title, button) => d.rows.filter({ hasText: title }).first().getByRole('button', { name: button }).click()
  const READ = /^Mark (?:as read|unread):/, SAVE = /^(?:Save|Unsave) /, REMOVE = /^Remove article:/

  // ── 1. A device that was in use before sync: everything on it predates its first exchange ──────────────
  const one = await device('one')
  one.link.sync = false
  await one.open('#/current-affairs'); await one.rows.first().waitFor()
  await act(one, 'RBI revises', SAVE); await one.news('Saved'); await act(one, 'RBI revises', READ)
  await one.news('To be Read'); await act(one, 'ISRO launches', READ)
  await act(one, 'New GDP series', REMOVE)
  await one.open('#/settings')
  await one.page.getByRole('radiogroup', { name: 'Theme' }).getByRole('radio', { name: 'Dark', exact: true }).click()
  // Atlas history as the app stores it: ids, times and all, written straight into its database.
  await one.page.evaluate(count => new Promise((resolve, reject) => {
    const open = indexedDB.open('lodestar')
    open.onsuccess = () => {
      const tx = open.result.transaction(['recalls', 'claims'], 'readwrite'), at = Date.now() - 86400000
      for (let i = 0; i < count; i++) tx.objectStore('recalls').put({ id: crypto.randomUUID(), createdAt: at + i, updatedAt: at + i, placeId: 'sync-check-place-' + (i % 50), type: 'locate', correct: i % 3 ? 1 : 0, at: at + i, date: new Date(at + i).toISOString().slice(0, 10), source: 'review' })
      tx.objectStore('claims').put({ id: crypto.randomUUID(), createdAt: at, updatedAt: at, challengeId: 'sync-check', period: '2026-10-01', reward: 20 })
      tx.oncomplete = () => { open.result.close(); resolve() }; tx.onerror = () => reject(tx.error)
    }
  }), HISTORY)
  const before = { state: await one.stored(), recalls: await one.recalls(), settings: await one.settings() }
  check('device one works with no sync service: Read, Saved, Removed, settings and Atlas history are all local', before.state[RBI].savedAt > 0 && before.state[RBI].readAt > 0 && before.state[RBI_HINDU].savedAt > 0 && before.state[SPACE].readAt > 0 && before.state[GDP].ignoredAt > 0 && before.recalls.length === HISTORY && before.settings.theme === 'dark')
  await one.open('#/settings'); await one.page.locator('[data-sync="offline"]', { hasText: 'waiting' }).waitFor({ timeout: 15000 })
  const offline = await one.status()
  check('it says so, and counts what is waiting: ' + offline.text, offline.phase === 'offline' && /changes are waiting/.test(offline.text))

  // ── 2. The network returns: it uploads by itself, and nothing on it changes ────────────────────────────
  one.link.sync = true
  const started = Date.now()
  await one.page.evaluate(() => window.dispatchEvent(new Event('online')))
  await one.settled()
  const migration = { ms: Date.now() - started, requests: usage.filter(u => u.device === 'one').length, sent: usage.filter(u => u.device === 'one').reduce((n, u) => n + u.sent, 0) }
  const linked = await one.status()
  check(`first sync started on its own when the network returned and uploaded ${migration.sent} rows in ${migration.requests} requests (${migration.ms} ms): ${linked.text}`, linked.phase === 'synced' && linked.text.includes(USER) && migration.sent === HISTORY + 1 + 6 + 2 + 1)
  const after = { state: await one.stored(), recalls: await one.recalls(), settings: await one.settings() }
  check('nothing on device one changed by uploading', JSON.stringify(after) === JSON.stringify(before))

  // ── 3. A second device with marks of its own downloads and merges on first launch ──────────────────────
  const two = await device('two', { seed: { version: 1, entries: { [RIGHTS]: { savedAt: 1700000000000 }, [SPACE]: { readAt: 1700000000001 } } } })
  await two.open('#/current-affairs'); await two.rows.first().waitFor()
  await two.settled()
  const merged = await two.stored()
  check('device two received Read, Saved and Removed, kept its own Saved article and the later of two Read times', merged[RBI].savedAt === before.state[RBI].savedAt && merged[RBI].readAt === before.state[RBI].readAt && merged[GDP].ignoredAt === before.state[GDP].ignoredAt && merged[RIGHTS].savedAt === 1700000000000 && merged[SPACE].readAt === before.state[SPACE].readAt)
  check('device two lists both Saved stories', JSON.stringify(await two.titles('Saved')) === JSON.stringify(['RBI revises banking liquidity regulation framework', 'Supreme Court ruling on constitutional fundamental rights']))
  check('the removed story stays removed and the read one is under Read', !(await two.titles('To be Read')).some(t => /GDP|ISRO/.test(t)) && (await two.titles('Read')).some(t => /ISRO/.test(t)))
  const history = await two.recalls()
  check(`device two has all ${HISTORY} Atlas answers with the same ids and times`, history.length === HISTORY && sameRecords(history, before.recalls))
  check('device two took the chosen theme', (await two.settings()).theme === 'dark' && await two.page.evaluate(() => document.documentElement.classList.contains('dark') || document.documentElement.dataset.theme === 'dark' || getComputedStyle(document.documentElement).colorScheme.includes('dark')))
  await one.syncNow()
  check('device one received device two’s Saved article', (await one.stored())[RIGHTS]?.savedAt === 1700000000000 && (await one.titles('Saved')).length === 2)

  // ── 4. Unsave and unread on one device reach the other ─────────────────────────────────────────────────
  await two.news('Saved'); await act(two, 'RBI revises', SAVE)
  await two.news('Read'); await act(two, 'ISRO launches', READ)
  await two.sent()
  await one.syncNow()
  const propagated = await one.stored()
  check('unsave and unread on device two cleared the marks on device one', !propagated[RBI].savedAt && !propagated[RBI_HINDU]?.savedAt && propagated[RBI].readAt === before.state[RBI].readAt && !propagated[SPACE])
  check('device one’s Saved list no longer has the unsaved story', JSON.stringify(await one.titles('Saved')) === JSON.stringify(['Supreme Court ruling on constitutional fundamental rights']) && (await one.titles('To be Read')).some(t => /ISRO/.test(t)))

  // ── 5. Offline: the app carries on; the change goes out when the connection is back ────────────────────
  await two.ctx.setOffline(true)
  await two.open('#/current-affairs').catch(() => {})
  await two.news('To be Read'); await act(two, 'Cabinet approves', SAVE)
  check('offline save works immediately', (await two.stored())[HEALTH].savedAt > 0 && (await two.titles('Saved')).some(t => /Cabinet/.test(t)))
  const savedOfflineAt = (await two.stored())[HEALTH].savedAt
  await two.page.waitForTimeout(2500)
  await two.page.evaluate(() => { location.hash = '#/settings' }); await two.page.locator('[data-sync="offline"]').waitFor()
  check('offline is shown with the waiting change: ' + (await two.page.locator('[data-sync]').innerText()).replace(/\s+/g, ' '), /waiting/.test(await two.page.locator('[data-sync]').innerText()))
  await two.ctx.setOffline(false)
  await two.page.locator('[data-sync="synced"]').waitFor({ timeout: 30000 })
  check('it synced by itself when the connection returned')
  await one.syncNow()
  check('device one has the article saved offline, with the time it was saved', (await one.stored())[HEALTH]?.savedAt === savedOfflineAt)

  // ── 6. A Saved article outlives its feed: a new device whose feed never carried it still lists it ──────
  const three = await device('three', { list: items.filter(i => i.url !== RIGHTS && i.url !== HEALTH) })
  await three.open('#/current-affairs'); await three.rows.first().waitFor(); await three.settled()
  const kept = await three.titles('Saved')
  check('Saved articles missing from the feed are listed from their synced metadata: ' + kept.join(' | '), JSON.stringify(kept) === JSON.stringify(['Cabinet approves expansion of Ayushman Bharat scheme coverage', 'Supreme Court ruling on constitutional fundamental rights']))
  const link = three.rows.filter({ hasText: 'Supreme Court' }).locator('[data-news-original]')
  check('and still open the publisher’s page', await link.getAttribute('href') === RIGHTS)
  await three.page.screenshot({ path: fileURLToPath(new URL('saved-without-feed.png', out)) })
  await three.page.reload(); await three.rows.first().waitFor()
  check('they survive a reload with the sync service unreachable', (three.link.sync = false, JSON.stringify(await three.titles('Saved')) === JSON.stringify(kept)))

  // ── 7. Identity comes from Access alone ────────────────────────────────────────────────────────────────
  const anonymous = await device('signed-out', { email: null })
  await anonymous.open('#/current-affairs'); await anonymous.rows.first().waitFor()
  await act(anonymous, 'ISRO launches', READ)
  const signedOut = await anonymous.status()
  check('without an Access token the app works locally and asks for sign-in: ' + signedOut.text, signedOut.phase === 'signin' && Object.keys(await anonymous.stored()).length === 1 && (await anonymous.recalls()).length === 0)
  const claimed = await anonymous.page.evaluate(async user => { const r = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ v: 1, cursor: 0, account: user, user, email: user, changes: [] }) }); return { status: r.status, body: await r.json() } }, USER)
  check('naming an account in the request body opens nothing: ' + JSON.stringify(claimed), claimed.status === 401 && claimed.body.error === 'unauthenticated')
  const stranger = await device('other-account', { email: OTHER })
  await stranger.open('#/current-affairs'); await stranger.rows.first().waitFor(); await stranger.settled()
  check('another account sees none of this data', Object.keys(await stranger.stored()).length === 0 && (await stranger.recalls()).length === 0 && (await stranger.status()).text.includes(OTHER))
  const forged = await stranger.page.evaluate(async user => { const r = await fetch('/api/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ v: 1, cursor: 0, account: user, changes: [] }) }); return { status: r.status, body: await r.json() } }, USER)
  check('and cannot read it by claiming the account: ' + JSON.stringify(forged), forged.status === 409 && forged.body.error === 'account_mismatch')
  const session = await one.page.evaluate(async () => { const r = await fetch('/api/session', { redirect: 'manual' }); return r.type })
  check('the sign-in route answers from the network with a redirect back to the app', session === 'opaqueredirect')

  // ── 8. What it cost ────────────────────────────────────────────────────────────────────────────────────
  await one.syncNow(); await one.syncNow()
  const idle = usage.filter(u => u.device === 'one').at(-1)
  // D1 bills the index seek itself as one row read, also when it finds nothing.
  check('a sync with nothing new is one indexed query and no write: ' + idle.usage, idle.usage === 'queries=1;read=1;written=0')
  const totals = wrangler(['d1', 'execute', 'tars-sync', '--local', '--persist-to', state, '--json', '--command', '"SELECT user_id, collection, sum(deleted) AS tombstones, count(*) AS n FROM sync_records GROUP BY user_id, collection ORDER BY user_id, collection"'])
  const stored = JSON.parse(totals.stdout.slice(totals.stdout.indexOf('[')))[0].results
  console.log('D1 contents', JSON.stringify(stored))
  check('D1 holds one row per key for this account only, and no feed or unsaved-article data', stored.every(r => r.user_id === USER) && stored.find(r => r.collection === 'recall').n === HISTORY && stored.find(r => r.collection === 'article').n <= 4 && !stored.some(r => !['news', 'article', 'note', 'recall', 'claim', 'settings'].includes(r.collection)))
  check('the signing keys were fetched once per runtime, not per request (' + certRequests + ')', certRequests >= 1 && certRequests <= 4)
  assert.deepEqual(errors, [])
  const summary = { checks, migration, usage: { requests: usage.length, byDevice: Object.fromEntries([...new Set(usage.map(u => u.device))].map(d => [d, usage.filter(u => u.device === d).map(u => `${u.sent}→${u.usage}`)])) }, stored }
  writeFileSync(new URL('results.json', out), JSON.stringify(summary, null, 2) + '\n')
  console.log(`${checks.length} sync checks passed; no page errors`)
} catch (error) {
  for (const ctx of browser.contexts()) for (const [i, page] of ctx.pages().entries()) await page.screenshot({ path: fileURLToPath(new URL(`failure-${browser.contexts().indexOf(ctx)}-${i}.png`, out)) }).catch(() => {})
  throw error
} finally { await browser.close(); stop() }
