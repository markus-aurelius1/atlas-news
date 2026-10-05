/** Live registry probe: the gateway's own request shape, limits and parser, with redirects refused as in production. */
import { collectFeeds } from '../../src/current-affairs/gateway.ts'
import { NEWS_SOURCES } from '../../src/current-affairs/sources.ts'

const started = Date.now()
const data = await collectFeeds((input, init) => fetch(input, { ...init, redirect: 'manual' }))
const week = Date.now() - 7 * 24 * 3600000
for (const { sourceId, status, count } of data.sources) {
  // Counts are after cross-feed URL de-duplication, so an overlapping section can report fewer items than it served.
  const dates = data.items.filter(i => i.sourceId === sourceId).map(i => Date.parse(i.publishedAt ?? '')).filter(Number.isFinite)
  const newest = dates.length ? new Date(Math.max(...dates)).toISOString().slice(0, 10) : '-'
  console.log(`${status.padEnd(6)} ${String(count).padStart(3)} items  ${String(dates.filter(d => d >= week).length).padStart(3)} unique this week  newest ${newest}  ${sourceId}`)
}
const bad = data.sources.filter(s => s.status !== 'ok')
console.log(`${NEWS_SOURCES.length} registered, ${data.sources.length - bad.length} ok, ${bad.length} failed or empty, ${data.items.length} unique items, ${Date.now() - started} ms`)
process.exitCode = bad.length ? 1 : 0
