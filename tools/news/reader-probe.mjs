/**
 * Live reader check: for each publisher, take the newest articles from one of its registry feeds and run them
 * through the reader's own fetch, extraction and sanitizer. Prints what a reader would get; stores nothing.
 *
 *   npm run news:reader                     every publisher, two articles each
 *   npm run news:reader -- ht-india 3       one feed, three articles
 *   READER_PROBE_OUT=dir npm run …          also write each sanitized article to dir (for inspection only)
 *
 * The app extracts in the browser; this uses happy-dom for the same code, so treat a difference from the
 * browser check (tools/browser/reader-check.mjs) as a parser difference. Plain JavaScript on purpose: it loads
 * the app's DOM code outside the browser, which the Node type project does not model.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Window } from 'happy-dom'
import { parseFeed } from '../../src/current-affairs/feed.ts'
import { extractArticle } from '../../src/current-affairs/reader/extract.ts'
import { ARTICLE_USER_AGENT, fetchArticle } from '../../src/current-affairs/reader/fetch-article.ts'
import { articleTarget } from '../../src/current-affairs/reader/policy.ts'
import { NEWS_SOURCES } from '../../src/current-affairs/sources.ts'

const window = new Window()
Object.assign(globalThis, { DOMParser: window.DOMParser })

const [only, countArg] = process.argv.slice(2)
const count = Math.max(1, Math.min(5, Number(countArg) || 2))
const out = process.env.READER_PROBE_OUT
if (out) mkdirSync(out, { recursive: true })

// One feed per publisher unless a source id is given.
const seen = new Set()
const sources = NEWS_SOURCES.filter((source) => (only ? source.id === only : !seen.has(source.publisher) && !!seen.add(source.publisher)))
const rows = []

for (const source of sources) {
  let urls = []
  try {
    const response = await fetch(source.feedUrl, { redirect: 'follow', signal: AbortSignal.timeout(12000), headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml', 'User-Agent': 'TarsCurrentAffairs/1.0 (RSS link reader)' } })
    urls = parseFeed(await response.text(), source).slice(0, count)
  } catch {
    rows.push({ publisher: source.publisher, result: 'feed unavailable' })
    continue
  }
  for (const item of urls) {
    const row = { publisher: source.publisher, path: new URL(item.url).pathname.slice(-38) }
    const target = articleTarget(item.url)
    if (!target.ok) {
      rows.push({ ...row, result: target.error })
      continue
    }
    const started = Date.now()
    const page = await fetchArticle(item.url)
    row.ms = Date.now() - started
    if (!page.ok) {
      rows.push({ ...row, result: page.error })
      continue
    }
    row.kb = Math.round(page.html.length / 1024)
    try {
      const extraction = extractArticle(page, item)
      if (extraction.kind !== 'article') {
        rows.push({ ...row, result: extraction.kind })
        continue
      }
      const a = extraction.article
      rows.push({ ...row, result: a.partial ? 'partial' : 'article', words: a.words, images: (a.html.match(/<img /g) ?? []).length + (a.lead ? 1 : 0), lead: a.lead ? 'og' : '', byline: (a.byline ?? '').slice(0, 24) })
      if (out) writeFileSync(join(out, `${source.id}-${rows.length}.html`), `<!-- ${item.url} -->\n<h1>${item.title}</h1>\n${a.lead ? `<img src="${a.lead.src}">\n` : ''}${a.html}\n`)
    } catch (error) {
      rows.push({ ...row, result: 'error: ' + String(error?.message).slice(0, 60) })
    }
  }
}
console.log(`Reader probe as "${ARTICLE_USER_AGENT}"`)
console.table(rows)
window.close()
