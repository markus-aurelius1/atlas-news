/** Extraction and sanitizing, on pages written for the purpose (shaped like the publishers' own, with none of their text). */
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { MIN_ARTICLE_WORDS, SHORT_ARTICLE_WORDS, extractArticle } from './extract.ts'
import { READER_ELEMENTS, sanitizeArticle } from './sanitize.ts'

const sentence = (n: number) => `Paragraph ${n} reports that the committee reviewed the scheme and set out what it found in the districts it visited during the monsoon session.`
const paragraphs = (count: number, from = 1) => Array.from({ length: count }, (_, i) => `<p>${sentence(from + i)}</p>`).join('\n')
const shell = (body: string, head = '') => `<!doctype html><html><head><title>Fixture | Publisher</title>${head}</head><body><header><nav><a href="/">Home</a><a href="/india">India</a></nav></header><main>${body}</main><footer><p>Copyright Publisher</p></footer></body></html>`
const url = 'https://www.thehindu.com/news/national/fixture/article1.ece'
const hint = { title: 'Committee reviews the rural scheme', description: '', publishedAt: '2026-10-06T04:30:00.000Z' }
const read = (html: string, at = url, h = hint) => extractArticle({ url: at, html }, h)
const article = (html: string, at = url, h = hint) => {
  const result = read(html, at, h)
  if (result.kind !== 'article') throw new Error(`Expected an article, got ${result.kind}`)
  return result.article
}
const parse = (html: string) => new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html')
const clean = (html: string) => { const doc = parse(html); return sanitizeArticle(doc.body, url, doc) }
const tags = (html: string) => [...new Set([...parse(html).body.querySelectorAll('*')].map((el) => el.tagName.toLowerCase()))]

describe('sanitizeArticle', () => {
  it('builds only allowlisted elements, with no publisher attributes', () => {
    const out = clean(`
      <div class="story" id="s" style="color:red" onclick="steal()">
        <h1>Section</h1>
        <p class="lede" style="font-size:40px" data-track="1">Opening <b>bold</b> and <i>italic</i> <span class="x">text</span> with a <a href="/tag/policy" onclick="steal()" target="_top" class="k">relative link</a>.</p>
        <script>alert(1)</script><style>p{display:none}</style>
        <iframe src="about:blank" srcdoc="<p>ad</p>"></iframe><object data="x.swf"></object><embed src="x.swf">
        <form action="https://evil.example"><input name="q"><button>Go</button></form>
        <svg onload="alert(1)"><circle r="4"/></svg><math><mi>x</mi></math>
        <p>Second paragraph <img src="x" onerror="alert(1)"> stays.</p>
        <p><a href="javascript:alert(1)">bad link</a> <a href="data:text/html,x">data link</a> <a href="#top">anchor</a></p>
        <custom-element onfoo="x">Unknown element text</custom-element>
      </div>`)
    for (const tag of tags(out.html)) expect(READER_ELEMENTS.has(tag), tag).toBe(true)
    expect(out.html).not.toMatch(/on\w+=|style=|class=|id=|data-|javascript:|<script|<iframe|<form|<svg|steal|alert/i)
    const doc = parse(out.html)
    expect(doc.body.querySelector('a')?.getAttribute('href')).toBe('https://www.thehindu.com/tag/policy')
    expect([...doc.body.querySelectorAll('a')].map((a) => a.getAttributeNames())).toEqual([['href']])
    expect(out.text).toContain('bad link data link anchor')
    expect(out.html).not.toContain('<p>ad</p>')
    expect(out.text).toContain('Unknown element text')
    expect(doc.body.querySelector('h2')?.textContent).toBe('Section')
    expect(doc.body.querySelector('strong')?.textContent).toBe('bold')
  })

  it('keeps headings, quotations, lists, tables and preformatted text', () => {
    const out = clean(`<h2>Heading</h2><blockquote><p>A quoted line.</p><cite>Speaker</cite></blockquote><ul><li>One</li><li>Two</li></ul><ol start="3"><li>Three</li></ol>
      <table><thead><tr><th colspan="2" style="x">Head</th></tr></thead><tbody><tr><td rowspan="1">A</td><td>B</td></tr></tbody></table><pre>  keep
   spacing</pre><hr><p>After the rule.</p>`)
    const doc = parse(out.html)
    expect(doc.body.querySelector('blockquote p')?.textContent).toBe('A quoted line.')
    expect(doc.body.querySelectorAll('ul li')).toHaveLength(2)
    expect(doc.body.querySelector('ol')?.getAttribute('start')).toBe('3')
    expect(doc.body.querySelector('th')?.getAttribute('colspan')).toBe('2')
    expect(doc.body.querySelector('td')?.hasAttribute('rowspan')).toBe(false)
    expect(doc.body.querySelector('pre')?.textContent).toBe('  keep\n   spacing')
    expect(doc.body.querySelector('hr')).not.toBeNull()
  })

  it('keeps real pictures as figures with captions and drops placeholders, pixels and unsafe addresses', () => {
    const out = clean(`
      <figure><img src="/img/photo.jpg" alt="A  reservoir" width="1200" height="800" onerror="x()"><figcaption>The reservoir in <b>June</b>.</figcaption></figure>
      <p><img src="data:image/gif;base64,R0lGOD" data-src="https://cdn.example.org/lazy.jpg" alt="Lazy"></p>
      <picture><source srcset="https://cdn.example.org/small.jpg 400w, https://cdn.example.org/large.jpg 1200w"><img src="/theme/1x1_spacer.png" alt="From srcset"></picture>
      <p>Text <img src="https://tracker.example/p.gif" width="1" height="1"> and <img src="javascript:alert(1)"> and <img src="http://insecure.example.org/pic.jpg" alt="Upgraded"></p>
      <figure><iframe src="about:blank"></iframe><figcaption>A video caption with no picture.</figcaption></figure>
      <img src="/theme/placeholder.png">`)
    expect(out.images).toEqual(['https://www.thehindu.com/img/photo.jpg', 'https://cdn.example.org/lazy.jpg', 'https://cdn.example.org/large.jpg', 'https://insecure.example.org/pic.jpg'])
    const doc = parse(out.html)
    const first = doc.body.querySelector('figure')!
    expect(first.querySelector('img')?.getAttributeNames().sort()).toEqual(['alt', 'height', 'src', 'width'])
    expect(first.querySelector('img')?.getAttribute('alt')).toBe('A reservoir')
    expect(first.querySelector('figcaption')?.textContent).toBe('The reservoir in June.')
    expect(doc.body.querySelectorAll('img').length).toBe(doc.body.querySelectorAll('figure').length)
    expect(out.html).not.toContain('video caption')
    expect(out.html).not.toMatch(/tracker|javascript|placeholder|spacer|data:image/)
  })

  it('removes publisher furniture but not sentences that merely begin like it', () => {
    const out = clean(`<p>${sentence(1)}</p><p><strong>Also Read:</strong> <a href="/other">Another story entirely</a></p><div><p>ADVERTISEMENT</p></div><p>Story continues below this ad</p>
      <p>Follow us on Instagram and X.</p><p>Read more about the rollout in the committee’s own report, which runs to several hundred pages and was tabled in the House last week after a long delay that members on both sides criticised as avoidable and unexplained by the ministry.</p><p>${sentence(2)}</p>`)
    expect(out.text).not.toMatch(/Also Read|ADVERTISEMENT|Story continues|Follow us/)
    expect(out.text).toContain('Read more about the rollout')
    expect(out.text).toContain('Paragraph 2')
  })

  it('wraps loose text in paragraphs and strips zero-width characters', () => {
    const out = clean('First run of text<br><br><div>Second⁠ block​ here</div><h2>Head</h2>tail text')
    const doc = parse(out.html)
    expect([...doc.body.children].map((el) => el.tagName.toLowerCase())).toEqual(['p', 'h2', 'p'])
    expect(out.text).toBe('First run of text Second block here Head tail text')
  })

  it('measures how much of the text is links', () => {
    expect(clean(`<p>${sentence(1)} <a href="/a">one link</a></p>`).linkDensity).toBeLessThan(0.1)
    expect(clean('<h2><a href="/a">Another headline entirely</a></h2><h2><a href="/b">And a second headline</a></h2><p>4 min read</p>').linkDensity).toBeGreaterThan(0.6)
  })
})

describe('extractArticle', () => {
  it('extracts the article and leaves the page around it', () => {
    const a = article(shell(`<article><h1>${hint.title}</h1><div class="byline">By Staff Reporter</div>${paragraphs(4)}<h2>What the report found</h2>${paragraphs(3, 5)}<blockquote><p>The scheme reached fewer households than planned.</p></blockquote>${paragraphs(2, 8)}</article><aside class="related-stories"><h3>Related stories</h3><ul><li><a href="/x">Unrelated headline one</a></li><li><a href="/y">Unrelated headline two</a></li></ul></aside>`, '<meta property="og:image" content="https://cdn.thehindu.com/lead.jpg"><meta name="author" content="Staff Reporter">'))
    expect(a.words).toBeGreaterThan(180)
    expect(a.partial).toBe(false)
    expect(a.html).toContain('<h2>What the report found</h2>')
    expect(a.html).toContain('<blockquote>')
    expect(a.html).not.toContain(hint.title)
    expect(a.html).not.toMatch(/Unrelated headline|Copyright Publisher|Home/)
    expect(a.byline).toBe('Staff Reporter')
    expect(a.lead).toEqual({ src: 'https://cdn.thehindu.com/lead.jpg', alt: '' })
    expect(a.publishedAt).toBe(hint.publishedAt)
    expect(a.minutes).toBe(Math.max(1, Math.round(a.words / 230)))
    expect(a.url).toBe(url)
  })

  it('does not repeat an opening picture the text already has, or show a publisher’s default share card', () => {
    const opening = '<figure><img src="https://cdn.thehindu.com/photos/dam-1200x800.jpg" width="1200" height="800" alt="Dam"><figcaption>The dam.</figcaption></figure>'
    expect(article(shell(`<article>${opening}${paragraphs(8)}</article>`, '<meta property="og:image" content="https://cdn.thehindu.com/photos/dam.jpg">')).lead).toBeNull()
    expect(article(shell(`<article>${paragraphs(8)}</article>`, '<meta property="og:image" content="https://www.thehindu.com/theme/images/og-image.png">')).lead).toBeNull()
    expect(article(shell(`<article>${paragraphs(8)}</article>`, '<meta property="og:image" content="javascript:alert(1)">')).lead).toBeNull()
  })

  it('shows nothing of an article the publisher marks as for subscribers', () => {
    const body = `<article>${paragraphs(9)}</article>`
    expect(read(shell(body, '<script type="application/ld+json">{"@context":"https://schema.org","@type":"NewsArticle","isAccessibleForFree":"False"}</script>')).kind).toBe('restricted')
    expect(read(shell(body, '<script type="application/ld+json">{"@graph":[{"@type":"WebSite"},{"@type":["Article","NewsArticle"],"isAccessibleForFree":false,"hasPart":{"@type":"WebPageElement","isAccessibleForFree":false,"cssSelector":".paywall"}}]}</script>')).kind).toBe('restricted')
    expect(read(shell(`<meta itemprop="isAccessibleForFree" content="false">${body}`)).kind).toBe('restricted')
    expect(read(shell(body, '<meta property="article:content_tier" content="locked">')).kind).toBe('restricted')
    // Free, metered and undeclared articles are read.
    expect(read(shell(body, '<script type="application/ld+json">{"@type":"NewsArticle","isAccessibleForFree":true}</script><meta property="article:content_tier" content="metered">')).kind).toBe('article')
    expect(read(shell(body, '<script type="application/ld+json">{ not json</script>')).kind).toBe('article')
  })

  it('treats a page that shows its paywall as restricted, not as a short article', () => {
    expect(read(shell(`<article>${paragraphs(3)}<p>Subscribe to continue reading this story.</p></article>`)).kind).toBe('restricted')
    expect(read(shell(`<article>${paragraphs(3)}<div><p>Already a subscriber? Log in</p></div></article>`)).kind).toBe('restricted')
    expect(read(shell(`<article>${paragraphs(2)}<p>This post is for paid subscribers</p></article>`), 'https://pibindia.substack.com/p/x').kind).toBe('restricted')
  })

  it('labels a short or cut-off text as partial and never calls it complete', () => {
    const short = article(shell(`<article>${paragraphs(3)}</article>`))
    expect(short.words).toBeGreaterThanOrEqual(MIN_ARTICLE_WORDS)
    expect(short.words).toBeLessThan(SHORT_ARTICLE_WORDS)
    expect(short.partial).toBe(true)
    expect(article(shell(`<article>${paragraphs(7)}<p>The ministry said the remaining districts would be covered…</p></article>`)).partial).toBe(true)
    expect(article(shell(`<article>${paragraphs(7)}</article>`)).partial).toBe(false)
  })

  it('refuses pages with no article: stubs, link lists and empty shells', () => {
    expect(read(shell('<article><p>Video: watch the briefing.</p></article>')).kind).toBe('unreadable')
    expect(read(shell(`<div class="listing">${Array.from({ length: 12 }, (_, i) => `<div class="card"><h2><a href="/story-${i}">Headline number ${i} about some other matter entirely today</a></h2><p>Oct ${i + 1} · 3 mins read</p></div>`).join('')}</div>`)).kind).toBe('unreadable')
    expect(read('<!doctype html><html><head></head><body></body></html>').kind).toBe('unreadable')
  })

  it('removes a repeated standfirst and a caption that only repeats the headline', () => {
    const h = { ...hint, description: 'The panel found the scheme reached fewer households than planned, and asked for an audit' }
    const a = article(shell(`<article><h2>${h.description}</h2><figure><img src="https://cdn.thehindu.com/a-photo.jpg" width="1200" height="675"><figcaption>${h.title}</figcaption></figure>${paragraphs(8)}</article>`), url, h)
    expect(a.html).not.toContain('fewer households')
    expect(a.html).not.toContain('<figcaption>')
    expect(a.html).toContain('<figure><img')
  })

  it('repairs publisher layouts: break markers, caption paragraphs and scripted opening pictures', () => {
    // Paragraphs written as one run of text with empty break markers (Times of India).
    const run = article(shell(`<article><div class="text">${Array.from({ length: 8 }, (_, i) => sentence(i + 1)).join('<span class="id-r-component br" data-pos="1"></span>')}</div></article>`), 'https://timesofindia.indiatimes.com/india/fixture/articleshow/1.cms')
    expect((run.html.match(/<p>/g) ?? []).length).toBe(8)
    // An opening picture only a script would load, with its caption beside it (The Hindu).
    const hindu = article(shell(`<div class="article-picture top-pic"><div class="picture"><picture><img src="https://www.thehindu.com/theme/images/th-online/1x1_spacer.png" data-original="https://www.thehindu.com/theme/images/th-online/1x1_spacer.png" class="lead-img" alt="The Minister at the symposium"></picture></div><p class="caption">The Minister at the symposium. | Photo Credit: Agency</p></div><div class="articlebodycontent">${paragraphs(4)}<div class="also-read print-hide"><a href="/other">Another story the reader did not open</a><img src="https://th-i.thgim.com/public/x/alternates/SQUARE_80/thumb.jpg" data-src-template="https://th-i.thgim.com/public/x/alternates/SQUARE_80/thumb.jpg"></div>${paragraphs(4, 5)}<div class="related-topics print-hide"><h3>Related Topics</h3><a href="/tag/a">aviation</a></div></div>`, '<meta property="og:image" content="https://th-i.thgim.com/public/lead/alternates/LANDSCAPE_1200/photo.jpg">'))
    expect(hindu.lead?.src).toBe('https://th-i.thgim.com/public/lead/alternates/LANDSCAPE_1200/photo.jpg')
    expect(hindu.html).not.toMatch(/SQUARE_80|Another story|Related Topics|spacer|<img/)
    expect((hindu.html.match(/<p>/g) ?? []).length).toBe(8)
    // The same picture and caption inside the article's own container are kept together, as a figure.
    const inside = article(shell(`<article><div class="story-hero"><img src="/static/placeholder.gif" class="hero-image" alt="The Minister"><p class="image-caption">The Minister at the symposium. | Photo Credit: Agency</p></div>${paragraphs(8)}</article>`, '<meta property="og:image" content="https://cdn.thehindu.com/lead-photo.jpg">'))
    expect(inside.html).toContain('<figure><img src="https://cdn.thehindu.com/lead-photo.jpg" alt="The Minister"><figcaption>The Minister at the symposium. | Photo Credit: Agency</figcaption></figure>')
    expect(inside.lead).toBeNull()
    // An article split across containers, with other stories between them (Politico Europe).
    const split = article(shell(`<div class="sidebar-grid__content article__content">${paragraphs(3)}</div><div class="related"><h2><a href="/x">Other headline</a></h2><p>Sep 29 4 mins read</p></div><div class="sidebar-grid__content article__content">${paragraphs(4, 4)}</div>`), 'https://www.politico.eu/article/fixture/')
    expect(split.html).toContain('Paragraph 1 ')
    expect(split.html).toContain('Paragraph 7 ')
    expect(split.html).not.toContain('Other headline')
  })

  it('does not take a template token, a sentence or a link for a byline', () => {
    const page = (author: string) => shell(`<article>${paragraphs(8)}</article>`, `<meta name="author" content="${author}">`)
    expect(article(page('list.metadata.agency')).byline).toBeNull()
    expect(article(page('&amp;')).byline).toBeNull()
    expect(article(page('https://www.thehindu.com/profile/author/x')).byline).toBeNull()
    expect(article(page('By  Asha  Rao | Updated 6 October')).byline).toBe('Asha Rao')
  })
})
