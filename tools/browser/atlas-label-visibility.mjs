/** Paint-order regression: visible labels and symbols must stay above settled detail tiles. */
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright-core'
import { inspectLabelSurface } from './label-surface.mjs'

const base = process.argv[2] ?? 'http://127.0.0.1:4180/'
const names = new Map(JSON.parse(readFileSync(new URL('../../public/atlas/v1/places.json', import.meta.url), 'utf8')).places.map(place => [place.id, place.name]))
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const checks = [], snapshots = [], errors = []
const out = 'tools/browser/out/label-visibility'
mkdirSync(out, { recursive: true })
try {
  for (const width of [1920, 1366, 390]) for (const theme of ['dark', 'light']) {
    const tag = `${width}-${theme}`
    const context = await browser.newContext({ viewport: { width, height: 975 }, colorScheme: theme })
    const page = await context.newPage()
    page.on('pageerror', error => errors.push(error.stack))
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
    const inspect = async phase => {
      const painted = await page.evaluate(inspectLabelSurface)
      const state = await page.evaluate(painted => {
        const map = document.querySelector('.atlas'), box = map.getBoundingClientRect()
        const visible = node => {
          const r = node.getBoundingClientRect(), style = getComputedStyle(node)
          const x = r.x + r.width / 2, y = r.y + r.height / 2
          return r.width > 0 && r.height > 0 && x > box.left + 12 && x < box.right - 12 && y > box.top + 65 && y < box.bottom - 110 && style.visibility === 'visible' && style.display !== 'none' && Number(style.opacity) > 0.5
        }
        const probe = (node, px, py) => {
          const r = node.getBoundingClientRect(), x = px ?? r.x + r.width / 2, y = py ?? r.y + r.height / 2
          const previous = node.style.pointerEvents
          // Labels intentionally ignore pointer events. Temporarily include them in
          // the browser's hit-test stack to inspect paint order, then restore it.
          node.style.pointerEvents = 'auto'
          const stack = document.elementsFromPoint(x, y)
          node.style.pointerEvents = previous
          const index = stack.findIndex(element => element === node || node.contains(element))
          const tile = stack.findIndex(element => {
            if (!element.closest('.atlas-base') || element.tagName !== 'CANVAS' || getComputedStyle(element).visibility === 'hidden' || getComputedStyle(element).display === 'none') return false
            for (let parent = element; parent && parent !== map; parent = parent.parentElement) if (Number(getComputedStyle(parent).opacity) < 0.5) return false
            return true
          })
          const ui = stack.slice(0, index < 0 ? undefined : index).some(element => element.closest('[data-map-ui], [data-inspector], [role="dialog"]'))
          return { above: index >= 0 && (tile < 0 || index < tile), ui, x, y, stack: stack.slice(0, 4).map(element => element.tagName + '.' + (element.className?.baseVal ?? element.className)) }
        }
        const canvas = map.querySelector('.atlas-names canvas')
        const labels = painted.entries.filter(e => e.tested && e.painted).map(e => ({ key: e.key, inkMatch: e.matched / e.tested,
          ...probe(canvas, box.left + e.x + e.spriteWidth / 2, box.top + e.y + e.spriteHeight / 2) })).filter(item => !item.ui && item.x > box.left + 12 && item.x < box.right - 12 && item.y > box.top + 65 && item.y < box.bottom - 110)
        const markers = [...map.querySelectorAll('[data-place]')].filter(visible).map(node => ({ id: node.dataset.place, ...probe(node) })).filter(item => !item.ui)
        return { moving: map.classList.contains('atlas-moving'), view: map.querySelector('.atlas-base').atlasView, isolation: getComputedStyle(map.querySelector('.atlas-base')).isolation, tiles: [...map.querySelectorAll('[data-tile-level]')].map(node => ({ kind: node.dataset.tileKind, z: getComputedStyle(node).zIndex, opacity: getComputedStyle(node).opacity })), labels, markers }
      }, painted)
      snapshots.push({ tag, phase, state })
      assert(state.labels.length >= 3, `${tag} ${phase}: no visible in-view names`)
      assert(state.labels.every(label => label.above && label.inkMatch >= 0.9), `${tag} ${phase}: names covered by base tiles: ${JSON.stringify(state.labels.filter(label => !label.above).slice(0, 2))}`)
      assert(state.markers.length > 0, `${tag} ${phase}: no visible markers`)
      assert(state.markers.every(marker => marker.above), `${tag} ${phase}: markers covered by base tiles`)
      assert.deepEqual(errors, [], `${tag} ${phase}: console/runtime errors`)
      checks.push(`${tag}: ${phase}`)
      console.log('PASS', checks.at(-1), `(${state.labels.length} names, ${state.markers.length} markers)`)
      return state
    }
    const settle = async () => {
      await page.waitForFunction(() => {
        // India/World briefly coexist during their crossfade. Readiness and
        // names must belong to the surviving map, not the outgoing snapshot.
        const maps = document.querySelectorAll('.atlas')
        if (maps.length !== 1) return false
        const map = maps[0]
        return map.querySelector('.atlas-names')?.atlasEntries?.length > 5 && !map.classList.contains('atlas-moving') && map.querySelector('.atlas-base')?.dataset.tilesReady === 'true' && map.querySelector('.atlas-base canvas')
      })
      await page.waitForTimeout(500)
    }
    await page.goto(base + '#/atlas')
    await settle()
    await inspect('initial India')
    for (const sheet of ['India', 'World']) {
      if (sheet === 'World') {
        await page.getByRole('tab', { name: 'World', exact: true }).click()
        await page.getByRole('application', { name: /^World map/ }).waitFor()
        await settle()
        await inspect('initial World')
      }
      for (const direction of ['in', 'out']) {
        await page.getByRole('button', { name: `Zoom ${direction}`, exact: true }).click()
        await page.waitForFunction(() => !!document.querySelector('.atlas-moving'))
        await inspect(`${sheet} zoom ${direction} moving`)
        await settle()
        await inspect(`${sheet} zoom ${direction} settled`)
      }
      const state = await inspect(`${sheet} before selection`)
      const marker = state.markers.find(marker => marker.above)
      await page.mouse.click(marker.x, marker.y)
      await page.getByRole('heading', { name: names.get(marker.id), exact: true }).waitFor()
      checks.push(`${tag}: ${sheet} marker selects its place`)
      console.log('PASS', checks.at(-1))
      if (width >= 1024) await page.getByRole('button', { name: 'Collapse Atlas inspector' }).click()
      else await page.keyboard.press('Escape')
      await settle()
    }
    await page.getByRole('tab', { name: 'India', exact: true }).click()
    await page.getByRole('application', { name: /^India map/ }).waitFor()
    await settle()
    await inspect('return to India')
    await page.screenshot({ path: `${out}/${tag}.png` })
    await context.close()
  }
  console.log(`PASS ${checks.length} label/marker paint-order and selection checks; no console errors`)
} finally {
  await browser.close()
  writeFileSync(`${out}/results.json`, JSON.stringify({ checks, snapshots, errors }, null, 2))
}
