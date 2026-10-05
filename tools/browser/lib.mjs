/**
 * Shared browser setup for Atlas and News on a fresh database.
 */
import { chromium } from 'playwright-core'

export async function launch({ touch = false, dpr = 3 } = {}) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr, hasTouch: touch, isMobile: touch })
  const page = await ctx.newPage()
  return { browser, ctx, page }
}

/** Wait for shared settings initialization, then open a route. */
export async function prepare(page, base, { route = '#/atlas' } = {}) {
  await page.goto(base + '#/settings')
  await page.locator('main.stage:not([aria-busy="true"])').waitFor()
  const settingsHandle = await page.waitForFunction(() => new Promise((resolve) => {
    const request = indexedDB.open('lodestar')
    request.onerror = () => resolve(false)
    request.onsuccess = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('settings')) { db.close(); resolve(false); return }
      const read = db.transaction('settings').objectStore('settings').get('settings')
      read.onsuccess = () => { db.close(); resolve(read.result?.updatedAt > 0 ? read.result : false) }
      read.onerror = () => { db.close(); resolve(false) }
    }
  }))
  await settingsHandle.dispose()
  await page.goto(base + route)
  await page.waitForTimeout(3000)
}
