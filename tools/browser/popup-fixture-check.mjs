/** Offline regression for the routed publisher popup; no publisher contacted. */
import assert from 'node:assert/strict'
import { chromium } from 'playwright-core'
import { createServer } from 'node:http'
const server = createServer((req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(req.url === '/publisher' ? '<h1>Original publisher fixture</h1>' : '<a href="/publisher" target="_blank" rel="noopener noreferrer">Publisher</a>') })
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const base = `http://127.0.0.1:${server.address().port}`
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost'] })
try {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(base)
  const pending = context.waitForEvent('page')
  await page.locator('a').click({ modifiers: ['ControlOrMeta'] })
  const popup = await pending
  popup.on('framenavigated', frame => console.log('navigation', frame.url()))
  console.log('initial', popup.url())
  await popup.waitForURL(base + '/publisher', { waitUntil: 'domcontentloaded', timeout: 15000 })
  assert.equal(await popup.locator('h1').innerText(), 'Original publisher fixture')
  console.log('PASS modified publisher click commits the fixture URL and renders its DOM')
} finally { await browser.close(); server.close() }
