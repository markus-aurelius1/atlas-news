/** Regression: open Atlas directly without Settings/prewarming; catch React boundary errors too. */
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
import { inspectLabelSurface } from './label-surface.mjs'

const base = process.argv[2] ?? 'http://127.0.0.1:4182/'
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ['--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1, EXCLUDE localhost'] })
const checks = [], errors = [], consoleReads = []
const out = `tools/browser/out/atlas-cold-start/${new URL(base).port || 'default'}`
mkdirSync(out, { recursive: true })
try {
  for (const width of [390, 1366]) {
    const context = await browser.newContext({ viewport: { width, height: 900 } })
    await context.route('**/api/current-affairs*', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: 1, fetchedAt: new Date().toISOString(), sources: [], items: [] }) }))
    const page = await context.newPage()
    page.on('pageerror', error => errors.push({ width, stack: error.stack }))
    page.on('console', message => {
      if (message.type() !== 'error') return
      const read = Promise.all(message.args().map(arg => arg.evaluate(value => value instanceof Error ? { message: value.message, stack: value.stack } : String(value)).catch(() => message.text())))
        .then(args => errors.push({ width, args }))
      consoleReads.push(read)
    })
    const ready = async name => {
      // React catches layout-effect exceptions: pageerror alone misses this regression.
      await page.waitForFunction(() => document.querySelector('.atlas-names')?.atlasEntries?.length > 5 || document.querySelector('main [role="alert"]'))
      assert.equal(await page.getByText('This screen ran into a problem', { exact: true }).count(), 0, `${width}: ${name} error boundary`)
      const painted = await page.evaluate(inspectLabelSurface)
      assert(painted.entries.some(e => e.path && e.sourcePainted && e.painted), `${width}: ${name} missing painted river lettering`)
      assert(painted.entries.filter(e => e.tested).every(e => e.matched / e.tested >= 0.9), `${width}: ${name} lost viewport lettering`)
      await page.waitForTimeout(500)
      await Promise.all(consoleReads)
      assert.deepEqual(errors, [], `${width}: ${name} console errors`)
      checks.push(`${width}: ${name}`)
      console.log('PASS', checks.at(-1))
    }
    await page.goto(base)
    await ready('direct landing cold start with river lettering')
    assert(page.url().endsWith('#/atlas'))
    await page.reload()
    await ready('Atlas reload')
    await page.goto(base + '#/current-affairs')
    await page.getByRole('group', { name: 'Reading filter' }).waitFor()
    await page.getByRole('button', { name: 'Atlas', exact: true }).locator('visible=true').click()
    await ready('return from News')
    await page.screenshot({ path: `${out}/${width}.png` })
    await context.close()
  }
  console.log(`PASS ${checks.length} cold-start checks; no console/page errors`)
} finally {
  await browser.close()
  writeFileSync(`${out}/results.json`, JSON.stringify({ base, checks, errors }, null, 2))
}
