/** The reader's request rules: which addresses may be fetched at all, and how the one fetch is bounded. No live publisher is contacted. */
import { describe, expect, it, vi } from 'vitest'
import { NEWS_SOURCES } from '../sources.ts'
import { ARTICLE_MAX_BYTES, ARTICLE_MAX_REDIRECTS, ARTICLE_USER_AGENT, fetchArticle, stripPage } from './fetch-article.ts'
import { READER_PUBLISHERS, articleTarget, readerPublisher, sourcesWithoutPolicy } from './policy.ts'

const page = (body = '<html><body><p>Text</p></body></html>', init: ResponseInit = {}) => new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' }, ...init })
const never: typeof fetch = async () => { throw new Error('No upstream request is allowed here') }

describe('reader policy', () => {
  it('covers every publisher in the registry, so each one is decided on purpose', () => {
    expect(sourcesWithoutPolicy(NEWS_SOURCES)).toEqual([])
    expect(new Set(READER_PUBLISHERS.map((p) => p.domain)).size).toBe(READER_PUBLISHERS.length)
  })

  it('accepts a listed publisher over https, including its subdomains', () => {
    for (const url of ['https://www.thehindu.com/news/national/article1.ece', 'https://indianexpress.com/article/explained/x-1/', 'https://frontline.thehindu.com/cover-story/a.ece', 'https://pibindia.substack.com/p/post']) {
      const target = articleTarget(url)
      expect(target.ok, url).toBe(true)
    }
    const upgraded = articleTarget('http://www.hindustantimes.com/india-news/a.html#comments')
    expect(upgraded.ok && upgraded.url.href).toBe('https://www.hindustantimes.com/india-news/a.html')
  })

  it('never fetches from subscription publishers', () => {
    for (const url of ['https://www.ft.com/content/abc', 'https://www.economist.com/leaders/2026/10/01/x', 'https://www.nytimes.com/2026/10/06/world/x.html', 'https://www.bloomberg.com/news/articles/x']) expect(articleTarget(url)).toEqual({ ok: false, error: 'publisher_restricted' })
    expect(readerPublisher('www.thehindu.com')?.mode).toBe('reader')
  })

  it('refuses anything that is not a listed publisher’s own https page', () => {
    const unlisted = ['https://example.org/a', 'https://thehindu.com.evil.example/a', 'https://evilthehindu.com/a', 'https://localhost.thehindu.com.attacker.net/x']
    for (const url of unlisted) expect(articleTarget(url), url).toEqual({ ok: false, error: 'publisher_not_listed' })
    const invalid = ['', 'not a url', 'javascript:alert(1)', 'file:///etc/passwd', 'ftp://www.thehindu.com/a', 'https://user:pass@www.thehindu.com/a', 'https://www.thehindu.com:8443/a', 'http://www.thehindu.com:8080/a', 'https://127.0.0.1/a', 'https://[::1]/a', 'https://localhost/a', 'https://169.254.169.254/latest/meta-data', 'https://thehindu/a', `https://www.thehindu.com/${'a'.repeat(2100)}`]
    for (const url of invalid) expect(articleTarget(url), url).toEqual({ ok: false, error: 'invalid_url' })
    expect(articleTarget(null)).toEqual({ ok: false, error: 'invalid_url' })
  })
})

describe('bounded article fetch', () => {
  it('makes no request for an address the policy refuses', async () => {
    expect(await fetchArticle('https://example.org/a', never)).toEqual({ ok: false, error: 'publisher_not_listed' })
    expect(await fetchArticle('https://www.ft.com/content/a', never)).toEqual({ ok: false, error: 'publisher_restricted' })
    expect(await fetchArticle('https://10.0.0.1/a', never)).toEqual({ ok: false, error: 'invalid_url' })
    expect(await fetchArticle(null, never)).toEqual({ ok: false, error: 'invalid_url' })
  })

  it('asks once, honestly, without credentials, and follows no redirect by itself', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const result = await fetchArticle('https://www.thehindu.com/a.ece', async (input, init) => { calls.push({ url: String(input), init }); return page() })
    expect(result).toEqual({ ok: true, url: 'https://www.thehindu.com/a.ece', html: '<html><body><p>Text</p></body></html>' })
    expect(calls).toHaveLength(1)
    const { init } = calls[0]
    expect(init?.redirect).toBe('manual')
    expect(init?.credentials).toBe('omit')
    expect(init?.signal).toBeInstanceOf(AbortSignal)
    const headers = init?.headers as Record<string, string>
    expect(headers['User-Agent']).toBe(ARTICLE_USER_AGENT)
    expect(headers['User-Agent']).toMatch(/TarsReader/)
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain('cookie')
  })

  it('follows a redirect only to another allowed address, and only a few', async () => {
    const hop = (location: string) => new Response(null, { status: 302, headers: { Location: location } })
    const seen: string[] = []
    const ok = await fetchArticle('https://thehindu.com/a.ece', async (input) => { seen.push(String(input)); return seen.length === 1 ? hop('https://www.thehindu.com/a.ece') : page() })
    expect(ok.ok && ok.url).toBe('https://www.thehindu.com/a.ece')
    expect(seen).toEqual(['https://thehindu.com/a.ece', 'https://www.thehindu.com/a.ece'])

    for (const [location, error] of [['https://login.example.org/wall', 'upstream_blocked'], ['http://169.254.169.254/', 'upstream_blocked'], ['https://www.ft.com/content/a', 'publisher_restricted']] as const) {
      let requests = 0
      expect(await fetchArticle('https://www.thehindu.com/a.ece', async () => { requests++; return hop(location) })).toEqual({ ok: false, error })
      expect(requests).toBe(1)
    }
    let loops = 0
    expect(await fetchArticle('https://www.thehindu.com/a.ece', async () => { loops++; return hop(`https://www.thehindu.com/hop-${loops}`) })).toEqual({ ok: false, error: 'upstream_unavailable' })
    expect(loops).toBe(ARTICLE_MAX_REDIRECTS + 1)
  })

  it('reports a publisher’s refusal as a refusal, and never tries another way', async () => {
    for (const status of [401, 402, 403, 429, 451]) {
      let requests = 0
      expect(await fetchArticle('https://www.scmp.com/a', async () => { requests++; return new Response('', { status }) })).toEqual({ ok: false, error: 'upstream_blocked' })
      expect(requests).toBe(1)
    }
    expect(await fetchArticle('https://www.scmp.com/a', async () => new Response('', { status: 404 }))).toEqual({ ok: false, error: 'upstream_not_found' })
    expect(await fetchArticle('https://www.scmp.com/a', async () => new Response('', { status: 503 }))).toEqual({ ok: false, error: 'upstream_unavailable' })
    expect(await fetchArticle('https://www.scmp.com/a', async () => { throw new TypeError('network') })).toEqual({ ok: false, error: 'upstream_unavailable' })
  })

  it('reads only HTML, and never hands on part of a page', async () => {
    expect(await fetchArticle('https://www.bbc.com/a', async () => new Response('%PDF', { headers: { 'Content-Type': 'application/pdf' } }))).toEqual({ ok: false, error: 'not_article' })
    expect(await fetchArticle('https://www.bbc.com/a', async () => new Response('{}', { headers: { 'Content-Type': 'application/json' } }))).toEqual({ ok: false, error: 'not_article' })
    expect(await fetchArticle('https://www.bbc.com/a', async () => page('   '))).toEqual({ ok: false, error: 'not_article' })
    expect(await fetchArticle('https://www.bbc.com/a', async () => page('x', { headers: { 'Content-Type': 'text/html', 'Content-Length': String(ARTICLE_MAX_BYTES + 1) } }))).toEqual({ ok: false, error: 'too_large' })
    // A page that keeps arriving past the limit is refused, not cut.
    const endless = () => new Response(new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array(256 * 1024).fill(97)) } }), { headers: { 'Content-Type': 'text/html' } })
    expect(await fetchArticle('https://www.bbc.com/a', async () => endless())).toEqual({ ok: false, error: 'too_large' })
  })

  it('reports a publisher that does not answer in time', async () => {
    const stalled: typeof fetch = (_input, init) => new Promise((_resolve, reject) => init!.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))
    vi.useFakeTimers()
    try {
      const pending = fetchArticle('https://www.bbc.com/a', stalled)
      await vi.advanceTimersByTimeAsync(9500)
      expect(await pending).toEqual({ ok: false, error: 'upstream_timeout' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('decodes the charset the publisher declares', async () => {
    const latin = new Uint8Array([0x3c, 0x70, 0x3e, 0x63, 0x61, 0x66, 0xe9, 0x3c, 0x2f, 0x70, 0x3e])
    const result = await fetchArticle('https://www.bbc.com/a', async () => new Response(latin, { headers: { 'Content-Type': 'text/html; charset=iso-8859-1' } }))
    expect(result.ok && result.html).toBe('<p>café</p>')
  })
})

describe('stripPage', () => {
  it('removes code and embeds, keeps the article and the publisher’s structured data', () => {
    const html = '<head><link rel="stylesheet" href="a.css"><style>p{color:red}</style><script type="application/ld+json">{"@type":"NewsArticle","isAccessibleForFree":false}</script><script>alert(1)</script></head><body><!-- ad --><p>One</p><iframe src="https://ads.example"></iframe><svg><path d="M0"/></svg><p>Two</p><SCRIPT src="x.js"></SCRIPT><embed src="x.swf"><p>Three</p></body>'
    const out = stripPage(html)
    expect(out).toBe('<head><script type="application/ld+json">{"@type":"NewsArticle","isAccessibleForFree":false}</script></head><body><p>One</p><p>Two</p><p>Three</p></body>')
  })

  it('never drops the text that follows an unclosed embed, and treats unclosed code as code', () => {
    expect(stripPage('<p>Before</p><video controls><p>After</p>')).toBe('<p>Before</p><p>After</p>')
    expect(stripPage('<p>Before</p><svg/><p>After</p>')).toBe('<p>Before</p><p>After</p>')
    expect(stripPage('<p>Before</p><script>var a = "<p>not text</p>"')).toBe('<p>Before</p>')
    expect(stripPage('<p>Before</p><!-- unclosed <p>hidden</p>')).toBe('<p>Before</p>')
  })

  it('stays linear on a hostile page', () => {
    const hostile = '<script'.repeat(40000) + '<p>x</p>' + '<!--'.repeat(40000)
    const started = performance.now()
    stripPage(hostile)
    expect(performance.now() - started).toBeLessThan(1500)
  })
})
