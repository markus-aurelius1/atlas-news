/** Targeted boundaries: real parser shapes, CSE evidence/noise, and conservative event identity. */
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { canonicalUrl, cleanText, dedupeUrls, parseFeed, thumbnailUrl } from './feed'
import { collectFeeds, COLLECT_BUDGET_MS, FEED_CONCURRENCY } from './gateway'
import { MAX_NEWS_SOURCES, NEWS_SOURCES, activeFeedItems } from './sources'
import { classify } from './relevance'
import { clusterItems } from './cluster'
import { referenceLinks } from './static-links'
import type { ClassifiedItem, NewsItem, RelevanceIndex } from './types'
const source = NEWS_SOURCES.find(s => s.id === 'ie-explained')!
const index: RelevanceIndex = JSON.parse(readFileSync(new URL('../../public/current-affairs/v2/relevance-index.json', import.meta.url), 'utf8'))
const rss = '<rss version="2.0"><channel><item><title>RBI &amp; regulation</title><link>https://example.org/a?utm_source=x&amp;id=7</link><pubDate>Thu, 01 Oct 2026 10:00:00 GMT</pubDate><description><![CDATA[<p>Banking &amp; credit &#8211; rules</p>]]></description><content:encoded>FULL BODY MUST NOT SHIP</content:encoded></item></channel></rss>'
const item = (title: string, overrides: Partial<NewsItem> = {}): NewsItem => ({ title, description: '', publisher: 'Indian Express', section: 'Explained', sourceId: 'ie-explained', url: 'https://example.org/' + encodeURIComponent(title), publishedAt: '2026-10-01T10:00:00Z', ...overrides })
const classified = (title: string, overrides: Partial<NewsItem> = {}): ClassifiedItem => { const row = item(title, overrides); return { ...row, relevance: classify(row, index) } }
describe('RSS and Atom gateway', () => {
  it('fetches newspapers only and excludes removed official items from older caches', () => {
    expect(NEWS_SOURCES).toHaveLength(77)
    expect(new Set(NEWS_SOURCES.map(s => s.publisher)).size).toBe(33)
    expect(NEWS_SOURCES.every(s => s.kind === 'newspaper' || s.kind === 'international' || s.kind === 'newsletter')).toBe(true)
    expect(NEWS_SOURCES.some(s => /^(?:rbi|sebi|pib)/.test(s.id) || /(?:^|.)(?:rbi.org.in|sebi.gov.in|pib.gov.in)$/.test(new URL(s.feedUrl).hostname))).toBe(false)
    expect(activeFeedItems([item('News'), item('Old circular', { sourceId: 'rbi-notifications' }), item('Old SEBI notice', { sourceId: 'sebi' }), item('Unknown feed', { sourceId: 'unknown' })]).map(i => i.title)).toEqual(['News'])
  })
  it('keeps the curated registry capped, unique, HTTPS-only and free of rejected or removed feeds', () => {
    expect(NEWS_SOURCES.length).toBeLessThanOrEqual(MAX_NEWS_SOURCES)
    expect(MAX_NEWS_SOURCES).toBeLessThan(100)
    expect(new Set(NEWS_SOURCES.map(s => s.id)).size).toBe(NEWS_SOURCES.length)
    expect(new Set(NEWS_SOURCES.map(s => s.feedUrl)).size).toBe(NEWS_SOURCES.length)
    expect(NEWS_SOURCES.every(s => new URL(s.feedUrl).protocol === 'https:' && new URL(s.siteUrl).protocol === 'https:' && s.enabled)).toBe(true)
    const substack = NEWS_SOURCES.filter(s => new URL(s.feedUrl).hostname.endsWith('.substack.com'))
    expect(substack.map(s => new URL(s.feedUrl).hostname.split('.')[0]).sort()).toEqual(['foifaction', 'gentleleviathan', 'pibindia', 'publicpolicy', 'rgupta', 'statsandsociety', 'theeconomistoffthecharts', 'thequantifiedindia'])
    expect(substack.every(s => s.kind === 'newsletter' && s.feedUrl.endsWith('/feed'))).toBe(true)
    expect(NEWS_SOURCES.find(s => s.id === 'et-uttarpradesh')).toMatchObject({ section: 'Uttar Pradesh', feedUrl: 'https://b2b.economictimes.indiatimes.com/rss/uttarpradesh' })
    // Shortlisted feeds that failed the 2026-10-05 live probe (empty, dormant, RSS 1.0/RDF or redundant) stay out.
    for (const id of ['et-bfsi', 'et-defence', 'et-energy', 'et-government', 'et-health', 'et-infra', 'et-legal', 'et-psu', 'et-telecom', 'ext-nature', 'ext-science-org-news', 'ext-dw-english', 'nyt-energy-environment', 'toi-education']) expect(NEWS_SOURCES.some(s => s.id === id)).toBe(false)
    expect(NEWS_SOURCES.some(s => /sport|cricket|gaming|games|gizmodo|techcrunch|techmeme|techradar|technologyreview|washingtonpost|news.google|lifestyle|entertainment/i.test(s.feedUrl + ' ' + s.id + ' ' + s.section))).toBe(false)
    // The publisher-curated UPSC admission stays tied to the one verified feed.
    expect(NEWS_SOURCES.filter(s => s.id === 'ie-upsc')).toHaveLength(1)
  })
  it('normalizes RSS metadata without full article content', () => {
    const rows = parseFeed(rss, source)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ title: 'RBI & regulation', url: 'https://example.org/a?id=7', description: 'Banking & credit – rules', publishedAt: '2026-10-01T10:00:00.000Z' })
    expect(JSON.stringify(rows)).not.toContain('FULL BODY')
  })
  it('reads namespaced Atom alternate links and summary without content fallback', () => {
    const rows = parseFeed('<atom:feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:entry><atom:title>Space mission</atom:title><atom:link rel="self" href="https://example.org/self"/><atom:link rel="alternate" href="https://example.org/mission"/><atom:updated>2026-10-01T12:00:00Z</atom:updated><atom:summary>&lt;p&gt;New &amp; useful&lt;/p&gt;</atom:summary><atom:content>FULL BODY</atom:content></atom:entry></atom:feed>', source)
    expect(rows[0]).toMatchObject({ title: 'Space mission', url: 'https://example.org/mission', description: 'New & useful', publishedAt: '2026-10-01T12:00:00.000Z' })
  })
  it('strips markup/scripts, normal entities and numeric Unicode safely', () => {
    expect(cleanText('<script>bad()</script><p>&ldquo;RBI&rdquo;&nbsp;&amp; &#x1f30d;</p>')).toBe('“RBI” & 🌍')
    expect(cleanText('&#999999999;')).toBe('')
  })
  it('rejects malformed feeds, DTDs and unsafe links', () => {
    expect(() => parseFeed('<rss><channel></rss>', source)).toThrow()
    expect(() => parseFeed('<!DOCTYPE rss><rss><channel/></rss>', source)).toThrow()
    expect(canonicalUrl('javascript:alert(1)')).toBeNull()
    expect(canonicalUrl('https://user:secret@example.com/')).toBeNull()
  })
  it('deduplicates canonical URLs and retains identity query parameters', () => {
    const rows = dedupeUrls([item('A', { url: 'https://example.org/a?utm_source=x&id=7#tracking' }), item('B', { url: 'https://example.org/a?id=7' }), item('C', { url: 'https://example.org/a?id=8' })])
    expect(rows.map(r => r.url)).toEqual(['https://example.org/a?id=7', 'https://example.org/a?id=8'])
  })
  it('reads RSS media thumbnails, groups, enclosures and description images without article fetches', () => {
    const image = 'https://images.example.org/photo.jpg?width=140&signature=abc'
    for (const tag of ['<media:thumbnail url="https://images.example.org/photo.jpg?width=140&amp;signature=abc"/>', '<media:group><media:content medium="image" url="https://images.example.org/photo.jpg?width=140&amp;signature=abc"/></media:group>', '<enclosure type="image/jpeg" url="https://images.example.org/photo.jpg?width=140&amp;signature=abc"/>', '<description><![CDATA[<img src="https://images.example.org/photo.jpg?width=140&amp;signature=abc">Feed teaser]]></description>']) {
      const rows = parseFeed(`<rss><channel><item><title>News</title><link>https://example.org/a</link>${tag}<content:encoded>FULL ARTICLE BODY</content:encoded></item></channel></rss>`, source)
      expect(rows[0].thumbnailUrl).toBe(image)
      expect(JSON.stringify(rows)).not.toContain('FULL ARTICLE BODY')
    }
  })
  it('ignores channel logos, full-content images, audio and unsafe thumbnails', () => {
    const rows = parseFeed('<rss><channel><image><url>https://example.org/logo.jpg</url></image><item><title>News</title><link>https://example.org/a</link><media:thumbnail url="javascript:alert(1)"/><enclosure type="audio/mpeg" url="https://example.org/audio.mp3"/><content:encoded><![CDATA[<img src="https://example.org/body.jpg">FULL BODY]]></content:encoded></item></channel></rss>', source)
    expect(rows[0].thumbnailUrl).toBeUndefined()
    for (const value of ['data:image/png;base64,xxx', 'http://example.org/a.jpg', 'https://127.0.0.1/a.jpg', 'https://localhost/a.jpg', 'https://user:pass@example.org/a.jpg']) expect(thumbnailUrl(value)).toBeNull()
  })
  it('supports an Atom image enclosure without using Atom content', () => {
    const rows = parseFeed('<feed><entry><title>News</title><link href="https://example.org/a"/><link rel="enclosure" type="image/jpeg" href="https://images.example.org/a.jpg"/><content>FULL BODY</content></entry></feed>', source)
    expect(rows[0]).toMatchObject({ thumbnailUrl: 'https://images.example.org/a.jpg', description: '' })
  })
  it('isolates malformed/failed publishers and never fetches disabled feeds', async () => {
    const sources = [source, { ...source, id: 'bad', feedUrl: 'https://example.org/bad' }, { ...source, id: 'disabled', enabled: false }]
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => new Response(url === source.feedUrl ? rss : '<rss><channel></rss>'))
    const data = await collectFeeds(fetcher, sources, 0)
    expect(data.items).toHaveLength(1)
    expect(data.sources.map(s => s.status)).toEqual(['ok', 'failed'])
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(data.fetchedAt).toBe('1970-01-01T00:00:00.000Z')
  })
  it('keeps upstream fan-out bounded and reports sources in registry order', async () => {
    const sources = Array.from({ length: 25 }, (_, i) => ({ ...source, id: 's' + i, feedUrl: 'https://example.org/feed/' + i }))
    let inFlight = 0, peak = 0
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => {
      peak = Math.max(peak, ++inFlight)
      await new Promise(r => setTimeout(r, 2))
      inFlight--
      return new Response(String(url).endsWith('/7') ? '' : rss.replace('https://example.org/a?', String(url) + '/a?'), { status: String(url).endsWith('/7') ? 502 : 200 })
    })
    const data = await collectFeeds(fetcher, sources, 0)
    expect(peak).toBe(FEED_CONCURRENCY)
    expect(fetcher).toHaveBeenCalledTimes(25)
    expect(data.sources.map(s => s.sourceId)).toEqual(sources.map(s => s.id))
    expect(data.sources.filter(s => s.status === 'failed').map(s => s.sourceId)).toEqual(['s7'])
    expect(data.items).toHaveLength(24)
  })
  it('stops starting upstream requests once the collection budget is spent', async () => {
    vi.useFakeTimers()
    try {
      const sources = Array.from({ length: FEED_CONCURRENCY * 2 + 3 }, (_, i) => ({ ...source, id: 'hang' + i, feedUrl: 'https://example.org/hang/' + i }))
      const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, options) => new Promise((_, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('timeout')))))
      const promise = collectFeeds(fetcher, sources)
      await vi.advanceTimersByTimeAsync(COLLECT_BUDGET_MS + 1)
      const data = await promise
      expect(fetcher).toHaveBeenCalledTimes(FEED_CONCURRENCY * 2)
      expect(data.sources).toHaveLength(sources.length)
      expect(data.sources.every(s => s.status === 'failed')).toBe(true)
    } finally { vi.useRealTimers() }
  })
  it('times out an individual publisher without suppressing a successful one', async () => {
    vi.useFakeTimers()
    try {
      const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, options) => {
        if (url === source.feedUrl) return new Response(rss)
        return new Promise((_, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('timeout'))))
      })
      const promise = collectFeeds(fetcher, [source, { ...source, id: 'slow', feedUrl: 'https://example.org/slow' }])
      await vi.advanceTimersByTimeAsync(10001)
      expect((await promise).sources.map(s => s.status)).toEqual(['ok', 'failed'])
    } finally { vi.useRealTimers() }
  })
})
describe('CSE relevance', () => {
  it.each(['About 20 per cent CBG blending could make CNG carbon neutral on life-cycle basis: Study', 'How India must plug its leachate problem', 'Why Himalayas are caught off guard during floods', 'India’s next big public health tool could fit on a food packet'])('keeps supported specialist environment and health coverage: %s', title => {
    const result = classify(item(title, { sourceId: 'dte-news', publisher: 'Down To Earth', section: 'Environment & development' }), index)
    expect(result.accepted).toBe(true)
    expect(result.staticAnchors.length).toBeGreaterThan(0)
  })
  it.each(['New GDP series uses double deflation', 'JPC examines FCRA Amendment Bill', 'UPI payments fee study published', 'El Niño-driven wildfires threaten orangutan habitat', 'Swiss glaciers lost 20% of their volume', 'Green Energy Corridor boosts renewable energy', 'RBI amends guidelines for payments banks'])('includes broader syllabus vocabulary: %s', title => {
    const result = classify(item(title), index)
    expect(result.accepted).toBe(true)
    expect(result.staticAnchors.length).toBeGreaterThan(0)
  })
  it('treats the publisher-curated UPSC feed as a prior, never a bypass, and invents no exam demand', () => {
    const title = 'UPSC Key: Poompuhar, NCERT Textbooks and Article 370'
    const result = classify(item(title, { sourceId: 'ie-upsc', section: 'UPSC Current Affairs' }), index)
    expect(result).toMatchObject({ accepted: true, staticAnchors: ['Constitutional articles'], subjects: ['Polity'] })
    expect(result.evidence).toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'source', label: 'Publisher-curated UPSC section' })]))
    // The same feed without any syllabus concept stays out, with no exam demand claimed.
    expect(classify(item('UPSC Key: Poompuhar and a long weekend', { sourceId: 'ie-upsc', section: 'UPSC Current Affairs' }), index)).toMatchObject({ accepted: false, exam: 'general', staticAnchors: [], signals: [] })
    expect(classify(item('UPSC MCQs on science', { sourceId: 'ie-upsc' }), index).accepted).toBe(false)
    expect(classify(item('Cricket match score', { sourceId: 'ie-upsc' }), index).accepted).toBe(false)
  })
  it('admits supported explainers without requiring policy verbs, but keeps unrelated explainers out', () => {
    expect(classify(item('What is renewable energy?'), index).accepted).toBe(true)
    expect(classify(item('How did a pilot save the passengers?'), index).accepted).toBe(false)
    expect(classify(item('Supreme Court dismisses plea over frozen bank accounts'), index).accepted).toBe(false)
  })
  it.each(['RBI revises banking regulation', 'Supreme Court ruling on constitutional fundamental rights', 'Ramsar protected area conservation expands', 'Government scheme expands Ayushman Bharat coverage', 'New international treaty on nuclear security', 'ISRO launches important lunar space mission'])('accepts %s with subject and exam demand', title => {
    const result = classify(item(title), index)
    expect(result.accepted).toBe(true)
    expect(result.subjects.length).toBeGreaterThan(0)
    expect(['prelims', 'mains', 'both']).toContain(result.exam)
    expect(result.staticAnchors.length).toBeGreaterThan(0)
  })
  it.each(['Cricket score: India wins', 'Film release breaks box office record', 'Celebrity wedding goes viral', 'Police arrested suspect in routine murder', 'Horoscope: your lucky day', 'New smartphone product launch', 'RBI news: shares rise after stock price rally'])('rejects %s', title => expect(classify(item(title), index).accepted).toBe(false))
  it('does not let publisher/section alone determine acceptance or teaser override noise', () => {
    expect(classify(item('Today’s top news', { publisher: 'RBI', section: 'Economy' }), index).accepted).toBe(false)
    expect(classify(item('Celebrity arrested', { description: 'Supreme Court constitutional ruling' }), index).accepted).toBe(false)
    expect(classify(item('Supreme Court dismisses plea over frozen bank accounts', { description: 'Today’s court ruling' }), index).accepted).toBe(false)
    expect(classify(item('UPSC Mains Answer Practice: Fiscal Federalism'), index).accepted).toBe(false)
  })
  it('runtime contains compact CSE provenance, counts and taxonomy anchors', () => {
    expect(index.provenance.prelimsQuestions).toBe(3896)
    expect(index.provenance.mainsQuestions).toBe(1130)
    expect(index.signals.some(s => s.taxonomyIds.length > 0)).toBe(true)
    expect(index.signals.every(s => s.prelimsDemand || s.mainsDemand)).toBe(true)
    expect(JSON.stringify(index)).not.toContain('question_text')
  })
})
describe('event identity and exact references', () => {
  it('groups differently worded reports on the same development and prefers richer metadata', () => {
    const a = classified('Ramsar wetland conservation expands with new protected sites', { section: 'Environment', description: '', url: 'https://example.org/short' })
    const b = classified('New protected Ramsar sites expand wetland conservation framework', { section: 'Environment', description: 'The feed offers more context on wetland conservation with details of designated sites and their ecological significance.', url: 'https://example.org/rich' })
    expect(clusterItems([a, b])).toHaveLength(1)
    expect(clusterItems([a, b])[0].primary.url).toBe(b.url)
  })
  it('prefers an explainer over a longer teaser, retains links, and does not bridge distinct events', () => {
    const a = classified('RBI banking liquidity regulation framework revised', { section: 'Economy', description: 'Banking regulation '.repeat(30) })
    const b = classified('Explained RBI banking liquidity regulation framework changes', { section: 'Explained', url: 'https://example.org/explainer' })
    expect(clusterItems([a, b])[0].primary.url).toBe(b.url)
    expect(clusterItems([a, b])[0].members).toHaveLength(2)
    const nextDay = { ...b, publishedAt: '2026-10-02T10:00:00Z' }
    expect(clusterItems([a, nextDay])).toHaveLength(2)
  })
  it('merges matching newspaper coverage and prefers explainers, keeping every link', () => {
    const rows = [classified('RBI revises banking liquidity regulation framework'), classified('RBI revises banking liquidity regulation framework today', { url: 'https://thehindu.com/1', sourceId: 'hindu-national', publisher: 'The Hindu' })]
    const events = clusterItems(rows)
    expect(events).toHaveLength(1)
    expect(events[0].members).toHaveLength(2)
    expect(events[0].primary.publisher).toBe('Indian Express')
  })
  it('keeps distinct RBI and Supreme Court developments apart', () => {
    expect(clusterItems([classified('RBI revises banking liquidity regulation framework'), classified('RBI monetary policy holds repo rate'), classified('Supreme Court constitutional ruling on federalism'), classified('Supreme Court ruling protects fundamental rights')])).toHaveLength(4)
  })
  it('does not merge repeated titles across dates or undated stories', () => {
    const a = classified('RBI revises banking regulation')
    expect(clusterItems([a, classified(a.title, { publishedAt: '2026-09-01T10:00:00Z', url: 'https://example.org/old' }), classified(a.title, { publishedAt: null, url: 'https://example.org/undated' })])).toHaveLength(3)
  })
  it('uses exact known official URLs and nothing for unknown concepts', () => {
    expect(referenceLinks('RBI')[0].url).toBe('https://www.rbi.org.in/')
    expect(referenceLinks('Unknown <entity>')).toEqual([])
    expect(referenceLinks('toString')).toEqual([])
  })
})
