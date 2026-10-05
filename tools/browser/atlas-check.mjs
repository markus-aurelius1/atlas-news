/**
 * Atlas interaction checks (desktop and phone), on a production build:
 *   desktop  wheel notches zoom smoothly around the cursor, double-click zooms in,
 *            Shift+double-click zooms out, keys pan and zoom, hover shows a pointer,
 *            layers hide undiscovered places, search → fly → card (other sheet too)
 *   phone    double tap zooms in, two-finger tap zooms out, search → fly → card
 *
 *   node atlas-check.mjs [baseUrl]
 */
import { chromium } from 'playwright-core'
import { prepare } from './lib.mjs'

const base = process.argv[2] ?? 'http://localhost:4173/'
let failed = 0
const ok = (name, cond, extra = '') => {
  if (!cond) failed++
  console.log(`${cond ? 'PASS' : 'FAIL'} ${name}${extra ? ` (${extra})` : ''}`)
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const scaleOf = (page) => page.evaluate(() => (document.querySelector('.atlas-base')?.atlasView?.k ?? Number(document.querySelector('.atlas-layer svg > g')?.getAttribute('transform')?.match(/scale\(([\d.]+)\)/)?.[1] ?? 0)))
const sheetRect = (page) => page.evaluate(() => {
  const map = document.querySelector('[role=application]')?.getBoundingClientRect()
  const base = document.querySelector('.atlas-base')
  const v = base?.atlasView, size = base?.atlasSheet
  const sheet = v && size && map ? new DOMRect(map.x + v.x, map.y + v.y, size.width * v.k, size.height * v.k) : document.querySelector('.atlas-layer svg > g > rect')?.getBoundingClientRect()
  return map && sheet ? { map: map.toJSON(), sheet: sheet.toJSON() } : null
})
const settle = (page, ms = 700) => page.waitForTimeout(ms)

// ── desktop ──────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await prepare(page, base, { sample: true, route: '#/atlas' })
  const box = await page.locator('[role=application]').boundingBox()
  const cx = box.x + box.width * 0.45
  const cy = box.y + box.height * 0.55
  const cdp = await ctx.newCDPSession(page)
  const doubleClick = async (shift = false) => {
    const timestamp = Date.now() / 1000
    const events = [
      ['mousePressed', 1, 0], ['mouseReleased', 1, 0.01],
      ['mousePressed', 2, 0.10], ['mouseReleased', 2, 0.11],
    ]
    // Preserve the synthetic click interval independently of paint/CDP delays.
    await Promise.all(events.map(([type, clickCount, offset]) => cdp.send('Input.dispatchMouseEvent', {
      type, x: cx, y: cy, button: 'left', clickCount, modifiers: shift ? 8 : 0, timestamp: timestamp + offset,
    })))
  }
  const waitScale = (previous, direction) => page.waitForFunction(({ previous, direction }) => {
    const scale = (document.querySelector('.atlas-base')?.atlasView?.k ?? Number(document.querySelector('.atlas-layer svg > g')?.getAttribute('transform')?.match(/scale\(([\d.]+)\)/)?.[1] ?? 0))
    return !document.querySelector('.atlas.atlas-moving') && (direction === 'in' ? scale > previous * 1.6 : scale > 0 && scale < previous / 1.6)
  }, { previous, direction }, { timeout: 10000 })
  const bounds = await sheetRect(page)
  ok('desktop: sheet covers the viewport', bounds && bounds.sheet.left <= bounds.map.left + 2 && bounds.sheet.top <= bounds.map.top + 2 && bounds.sheet.right >= bounds.map.right - 2 && bounds.sheet.bottom >= bounds.map.bottom - 2, JSON.stringify(bounds))

  // Wheel notches: the zoom eases in over several frames rather than jumping.
  const k0 = await scaleOf(page)
  await page.mouse.move(cx, cy)
  const frames = await page.evaluate(() => {
    window.__k = []
    const g = document.querySelector('.atlas-base') ?? document.querySelector('.atlas-layer')
    const loop = () => {
      window.__k.push(g.atlasView ? JSON.stringify(g.atlasView) : g.style.transform)
      if (window.__k.length < 40) requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)
    return true
  })
  await page.mouse.wheel(0, -100)
  await page.waitForTimeout(700)
  await page.waitForFunction(() => !document.querySelector('.atlas.atlas-moving'))
  const steps = await page.evaluate(() => new Set(window.__k).size)
  const k1 = await scaleOf(page)
  ok('wheel notch zooms in', frames && k1 > k0 * 1.1, `${k0} → ${k1}`)
  ok('wheel notch animates over several frames', steps >= 5, `${steps} distinct frames`)

  await doubleClick()
  await waitScale(k1, 'in')
  const k2 = await scaleOf(page)
  ok('double-click zooms in', k2 > k1 * 1.6, `${k1} → ${k2}`)
  await page.keyboard.down('Shift')
  await doubleClick(true)
  await page.keyboard.up('Shift')
  await waitScale(k2, 'out')
  const k3 = await scaleOf(page)
  ok('shift+double-click zooms out', k3 < k2 / 1.6, `${k2} → ${k3}`)

  await page.locator('[role=application]').focus()
  const tf0 = await page.evaluate(() => (document.querySelector('.atlas-base')?.atlasView ? JSON.stringify(document.querySelector('.atlas-base').atlasView) : document.querySelector('.atlas-layer svg > g').getAttribute('transform')))
  // These check what the keys do, not how fast the map repaints (gesture-audit budgets that): the painted transform is
  // read once the repaint that follows the move has happened, however long this machine takes over it.
  const repainted = (was) => page.waitForFunction((was) => (document.querySelector('.atlas-base')?.atlasView ? JSON.stringify(document.querySelector('.atlas-base').atlasView) : document.querySelector('.atlas-layer svg > g').getAttribute('transform')) !== was, was, { timeout: 5000 }).then(() => true, () => false)
  await page.keyboard.press('ArrowRight')
  ok('arrow key pans', await repainted(tf0))
  await settle(page, 300)
  const k4 = await scaleOf(page)
  const tf1 = await page.evaluate(() => (document.querySelector('.atlas-base')?.atlasView ? JSON.stringify(document.querySelector('.atlas-base').atlasView) : document.querySelector('.atlas-layer svg > g').getAttribute('transform')))
  await page.keyboard.press('+')
  await repainted(tf1)
  await settle(page, 300)
  ok('+ key zooms in', (await scaleOf(page)) > k4 * 1.3)

  await page.getByRole('button', { name: 'Map options', exact: true }).click()
  await page.getByRole('button', { name: 'Fit the map' }).click()
  await settle(page)
  await page.mouse.move(cx, cy)
  for (let i = 0; i < 13; i++) await page.mouse.wheel(0, -120)
  await settle(page, 1000)
  const atLimit = await sheetRect(page)
  const anchor = (r) => ({ x: (cx - r.sheet.x) / r.sheet.width, y: (cy - r.sheet.y) / r.sheet.height })
  const before = anchor(atLimit)
  await page.mouse.wheel(0, -1200)
  await settle(page, 700)
  const after = anchor(await sheetRect(page))
  ok('zooming past the limit stays on the same place', Math.hypot(after.x - before.x, after.y - before.y) < 0.002, `${JSON.stringify(before)} → ${JSON.stringify(after)}`)

  // Hover over a symbol shows a pointer.
  const sym = await page.evaluate(() => {
    const r = [...document.querySelectorAll('.atlas-sym')].map((g) => g.getBoundingClientRect()).find((r) => r.width > 4 && r.top > 120 && r.left > 60)
    return r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null
  })
  if (sym) {
    await page.mouse.move(sym.x, sym.y)
    await page.waitForTimeout(250)
    ok('hover over a place shows a pointer', (await page.evaluate(() => document.querySelector('[role=application]').style.cursor)) === 'pointer')
  } else ok('found a symbol to hover', false)

  // Access is independent of travel; the obsolete hiding control must be absent.
  await page.getByRole('button', { name: 'Map options' }).click()
  ok('all places accessible: no discovery visibility gate', await page.getByRole('switch', { name: 'Places not yet discovered' }).count() === 0)
  await page.keyboard.press('Escape')
  // Search → fly → card, on the other sheet.
  await page.getByRole('button', { name: 'Search places' }).click()
  await page.getByRole('textbox', { name: 'Search the gazetteer' }).fill('Nagorno')
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /Nagorno-Karabakh/ }).first().click()
  await page.waitForTimeout(2600)
  ok('search result on the World sheet switches sheet', (await page.locator('[role=application]').getAttribute('aria-label'))?.startsWith('World'))
  ok('its card opens', await page.getByRole('heading', { name: 'Nagorno-Karabakh' }).isVisible())
  const sel = await page.evaluate(() => {
    const g = document.querySelector('.atlas-selected')?.getBoundingClientRect()
    const m = document.querySelector('[role=application]').getBoundingClientRect()
    // The inspector covers the right of the map: the place is centred in what is left.
    const inspector = document.querySelector('[data-inspector]')?.getBoundingClientRect()
    const right = inspector ? inspector.left - 12 : m.right
    return g ? { dx: Math.abs(g.x + g.width / 2 - (m.x + right) / 2), dy: Math.abs(g.y + g.height / 2 - (m.y + m.height / 2)) } : null
  })
  ok('the camera flew to it (selection ring in the middle of the uncovered map)', sel && sel.dx < 80 && sel.dy < 120, JSON.stringify(sel))

  await page.getByRole('button', { name: 'Search places' }).click()
  await page.getByRole('textbox', { name: 'Search the gazetteer' }).fill('ramsar')
  await page.waitForTimeout(400)
  const ramsar = await page.locator('[role=dialog] ul > li').count()
  ok('searching "ramsar" lists Ramsar sites', ramsar >= 60, `${ramsar} results`)
  await page.keyboard.press('Escape')
  ok('no page errors (desktop)' + (errors.length ? ': ' + errors.join(' | ') : ''), errors.length === 0)
  await ctx.close()
}

// ── phone ────────────────────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await prepare(page, base, { sample: true, route: '#/atlas' })
  const cdp = await ctx.newCDPSession(page)
  const touch = (type, pts, timestamp) => cdp.send('Input.dispatchTouchEvent', { type, ...(timestamp === undefined ? {} : { timestamp }), touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) })
  const tapAt = async (x, y) => {
    await touch('touchStart', [[x, y]])
    await touch('touchEnd', [])
  }
  const k0 = await scaleOf(page)
  const phoneBounds = await sheetRect(page)
  ok('phone: sheet covers the viewport', phoneBounds && phoneBounds.sheet.left <= phoneBounds.map.left + 2 && phoneBounds.sheet.top <= phoneBounds.map.top + 2 && phoneBounds.sheet.right >= phoneBounds.map.right - 2 && phoneBounds.sheet.bottom >= phoneBounds.map.bottom - 2, JSON.stringify(phoneBounds))
  await tapAt(160, 380)
  await page.waitForTimeout(120)
  await tapAt(160, 380)
  await settle(page)
  const k1 = await scaleOf(page)
  ok('double tap zooms in', k1 > k0 * 1.6, `${k0} → ${k1}`)
  // A tap may have opened a card; close it.
  if (await page.locator('[role=dialog]').isVisible().catch(() => false)) await page.keyboard.press('Escape')
  await settle(page, 400)
  await page.waitForFunction(() => !document.querySelector('.atlas.atlas-moving'))
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  // Not awaited: CDP answers a touch only once the page has handled it, and if the map happens to be repainting after
  // the zoom above, that answer is late – the "lift" would then be sent hundreds of milliseconds after the "touch" and
  // would not be a tap at all. Real fingers are not held down by a busy frame; the app times taps by the events' own
  // timestamps for the same reason.
  // Explicit input timestamps preserve the intended 60 ms contact even if CDP
  // delivery or the harness's own scheduling is delayed by a busy renderer.
  const tapTime = Date.now() / 1000
  const down = touch('touchStart', [[170, 420], [230, 420]], tapTime)
  await page.waitForTimeout(60)
  await touch('touchEnd', [], tapTime + 0.06)
  await down
  await page.waitForFunction((previous) => {
    const scale = (document.querySelector('.atlas-base')?.atlasView?.k ?? Number(document.querySelector('.atlas-layer svg > g')?.getAttribute('transform')?.match(/scale\(([\d.]+)\)/)?.[1] ?? 0))
    return scale > 0 && scale < previous / 1.6 && !document.querySelector('.atlas.atlas-moving')
  }, k1, { timeout: 10000 })
  const k2 = await scaleOf(page)
  ok('two-finger tap zooms out', k2 < k1 / 1.6, `${k1} → ${k2}`)

  await page.getByRole('button', { name: 'Search places' }).click()
  await page.getByRole('textbox', { name: 'Search the gazetteer' }).fill('Kaziranga')
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: /Kaziranga National Park/ }).first().click()
  await page.waitForTimeout(2000)
  ok('phone: search opens the card', await page.getByRole('heading', { name: 'Kaziranga National Park' }).isVisible())
  const sel = await page.evaluate(() => document.querySelector('.atlas-selected')?.getBoundingClientRect()?.y ?? null)
  ok('phone: the place sits above the card', sel !== null && sel < 844 * 0.45, `ring at y=${sel}`)
  ok('no page errors (phone)' + (errors.length ? ': ' + errors.join(' | ') : ''), errors.length === 0)
  await ctx.close()
}

await browser.close()
process.exit(failed ? 1 : 0)
