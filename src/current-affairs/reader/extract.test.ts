/** Extraction and sanitizing, on pages written for the purpose (shaped like the publishers' own, with none of their text). */
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { MIN_ARTICLE_WORDS, SHORT_ARTICLE_WORDS, extractArticle } from './extract.ts'
import { READER_ELEMENTS, embedSource, imageChoice, sanitizeArticle } from './sanitize.ts'

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
    expect(a.lead).toEqual({ src: 'https://cdn.thehindu.com/lead.jpg', alt: '', caption: null })
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

describe('pictures', () => {
  const pick = (html: string) => { const doc = parse(html); return imageChoice(doc.body.querySelector('img')!, url) }

  it('prefers the best version a page names over a small src', () => {
    // Hindustan Times: a 400 px src, a 960 px version on the <picture> source.
    expect(pick('<picture><source media="(min-width:768px)" srcset="https://www.hindustantimes.com/ht-img/img/2026/10/06/960x540/photo.jpg"><img src="https://www.hindustantimes.com/ht-img/img/2026/10/06/400x225/photo.jpg" width="360" height="202"></picture>')).toEqual({ url: 'https://www.hindustantimes.com/ht-img/img/2026/10/06/960x540/photo.jpg', fromSrc: false })
    // Width descriptors: the widest the column can use, not the largest there is.
    expect(pick('<img src="https://cdn.example.org/a-320.jpg" srcset="https://cdn.example.org/a-320.jpg 320w, https://cdn.example.org/a-1280.jpg 1280w, https://cdn.example.org/a-4000.jpg 4000w">')?.url).toBe('https://cdn.example.org/a-1280.jpg')
    // A lazy loader's address beats a small src; a placeholder is never chosen.
    expect(pick('<img src="https://cdn.example.org/thumb.jpg?w=200" data-src="https://cdn.example.org/full.jpg">')?.url).toBe('https://cdn.example.org/full.jpg')
    expect(pick('<img src="data:image/gif;base64,R0lG" data-srcset="https://cdn.example.org/b.jpg 800w">')?.url).toBe('https://cdn.example.org/b.jpg')
    // The src itself when it is the good one, and nothing when there is nothing.
    expect(pick('<img src="https://cdn.example.org/photo.jpg?w=1024" srcset="https://cdn.example.org/photo.jpg?w=320 320w">')).toEqual({ url: 'https://cdn.example.org/photo.jpg?w=1024', fromSrc: true })
    expect(pick('<img src="/theme/1x1_spacer.png" data-original="/theme/1x1_spacer.png">')).toBeNull()
  })

  it('does not carry the small picture’s size over to the version chosen instead', () => {
    const out = clean('<figure><picture><source srcset="https://cdn.example.org/960x540/a.jpg"><img src="https://cdn.example.org/400x225/a.jpg" width="360" height="202" alt="A"></picture><figcaption>Caption.</figcaption></figure>')
    expect(out.html).toBe('<figure><img src="https://cdn.example.org/960x540/a.jpg" alt="A"><figcaption>Caption.</figcaption></figure>')
  })

  it('keeps the caption of an opening picture that the article text leaves out', () => {
    // Indian Express: the opening picture and its caption sit in spans above the text; og:image names the same picture.
    const a = article(shell(`<span class="custom-caption"><img src="https://images.indianexpress.com/2026/10/coast.jpg?w=1024" alt="coast" width="650" height="366"><span class="ie-custom-caption">The coastline at dusk. (File)</span></span><div class="story-content">${paragraphs(9)}</div>`, '<meta property="og:image" content="https://images.indianexpress.com/2026/10/coast.jpg">'), 'https://indianexpress.com/article/explained/fixture-1/')
    if (a.lead) expect(a.lead).toEqual({ src: 'https://images.indianexpress.com/2026/10/coast.jpg', alt: '', caption: 'The coastline at dusk. (File)' })
    else expect(a.html).toContain('<figcaption>The coastline at dusk. (File)</figcaption>')
    expect(a.html.match(/The coastline at dusk/g) ?? []).toHaveLength(a.lead ? 0 : 1)
  })
})

describe('embeds', () => {
  it('points to a video, chart or post that was embedded, and to nothing else', () => {
    expect(embedSource('https://www.youtube.com/embed/abc')).toEqual({ url: 'https://www.youtube.com/embed/abc', label: 'Video on YouTube' })
    expect(embedSource('//datawrapper.dwcdn.net/x1/2/')?.label).toBe('Interactive chart')
    for (const bad of ['https://googleads.g.doubleclick.net/pagead/ads', 'https://youtube.com.evil.example/embed/x', 'http://www.youtube.com/embed/abc', 'javascript:alert(1)', 'https://user:pw@www.youtube.com/embed/x', '', null]) expect(embedSource(bad), String(bad)).toBeNull()
    const out = clean(`<p>${sentence(1)}</p><p data-tars-embed=""><a href="https://www.youtube.com/embed/abc">Embedded content</a></p><p data-tars-embed=""><a href="https://ads.example/frame">Embedded content</a></p><p data-tars-embed=""><a href="javascript:alert(1)">Embedded content</a></p><p>${sentence(2)}</p>`)
    expect(out.html).toContain('<p data-reader="embed"><a href="https://www.youtube.com/embed/abc">Video on YouTube</a></p>')
    expect(out.html.match(/data-reader="embed"/g)).toHaveLength(1)
    expect(out.html).not.toMatch(/ads\.example|javascript|Embedded content/)
  })

  it('survives extraction where the frame stood in the article', () => {
    const a = article(shell(`<article>${paragraphs(4)}<p data-tars-embed=""><a href="https://flo.uri.sh/visualisation/123/embed">Embedded content</a></p>${paragraphs(4, 5)}</article>`))
    expect(a.html).toContain('<p data-reader="embed"><a href="https://flo.uri.sh/visualisation/123/embed">Interactive chart</a></p>')
  })
})

/**
 * The Indian Express "infographic" block (article 10907921, October 2026), with its own class names and shape
 * and placeholder wording: tabbed panels of narrative cards, a stat grid, icon lists and comparison cards.
 * Read naively it became loose lines ("11,098", "km", "Length of India's coastline").
 */
const INFOGRAPHIC = `
<div class="infographic-blueeconomy">
  <input id="t1" class="infographic-blueeconomy__tab-input" checked="checked" name="tabs" type="radio" /><input id="t2" class="infographic-blueeconomy__tab-input" name="tabs" type="radio" />
  <input id="t3" class="infographic-blueeconomy__tab-input" name="tabs" type="radio" />
  <div class="infogenie_001_start"> </div>
  <h3>The coast in figures: scale, money and lessons</h3>
  <div class="infographic-blueeconomy__deck">A long coastline carries most trade and many livelihoods. Paying for its growth is the open question.</div>
  <div class="infographic-blueeconomy__tab-strip" role="tablist"><label class="infographic-blueeconomy__tab-label" role="tab" for="t1">By the numbers</label> <label class="infographic-blueeconomy__tab-label" role="tab" for="t2">Who funds what</label> <label class="infographic-blueeconomy__tab-label" role="tab" for="t3">Lessons</label></div>
  <div class="infographic-blueeconomy__panels">
    <div class="infographic-blueeconomy__panel infographic-blueeconomy__panel--1" role="tabpanel">
      <div class="infographic-blueeconomy__narrative-card"> <div class="infographic-blueeconomy__eyebrow">Scale</div> <div class="infographic-blueeconomy__card-title">More than ports and ships</div> <div class="infographic-blueeconomy__card-body">The sector covers fishing, energy and research as well as trade.</div> </div>
      <div class="infographic-blueeconomy__stat-grid">
        <div class="infographic-blueeconomy__stat-cell"> <div class="infographic-blueeconomy__stat-number">11,098</div> <div class="infographic-blueeconomy__stat-unit">km</div> <div class="infographic-blueeconomy__stat-label">Length of the coastline</div> </div>
        <div class="infographic-blueeconomy__stat-cell infographic-blueeconomy__stat-cell--hero"> <div class="infographic-blueeconomy__stat-number">~95%</div> <div class="infographic-blueeconomy__stat-unit">of trade</div> <div class="infographic-blueeconomy__stat-label">Share of trade by volume carried by sea</div> </div>
        <div class="infographic-blueeconomy__stat-cell"> <div class="infographic-blueeconomy__stat-number">~30 mn</div> <div class="infographic-blueeconomy__stat-unit">livelihoods</div> <div class="infographic-blueeconomy__stat-label">Supported by fisheries</div> </div>
      </div>
    </div>
    <div class="infographic-blueeconomy__panel infographic-blueeconomy__panel--2" role="tabpanel">
      <div class="infographic-blueeconomy__icon-list">
        <div class="infographic-blueeconomy__icon-item"> <div class="infographic-blueeconomy__icon-badge">1</div> <div class="infographic-blueeconomy__icon-content"> <div class="infographic-blueeconomy__icon-title">Ports</div> <div class="infographic-blueeconomy__icon-desc">Large investments repaid over decades.</div> </div> </div>
        <div class="infographic-blueeconomy__icon-item"> <div class="infographic-blueeconomy__icon-badge">2</div> <div class="infographic-blueeconomy__icon-content"> <div class="infographic-blueeconomy__icon-title">Fishing enterprises</div> <div class="infographic-blueeconomy__icon-desc">Smaller loans and insurance.</div> </div> </div>
      </div>
    </div>
    <div class="infographic-blueeconomy__panel infographic-blueeconomy__panel--3" role="tabpanel">
      <div class="infographic-blueeconomy__compare-grid">
        <div class="infographic-blueeconomy__compare-card infographic-blueeconomy__compare-card--a"> <div class="infographic-blueeconomy__compare-label">Seychelles, 2018</div> <div class="infographic-blueeconomy__compare-value">USD 15 mn</div> <div class="infographic-blueeconomy__compare-text">The first sovereign bond of its kind, backed by a guarantee.</div> </div>
        <div class="infographic-blueeconomy__compare-card infographic-blueeconomy__compare-card--b"> <div class="infographic-blueeconomy__compare-label">Belize</div> <div class="infographic-blueeconomy__compare-value">USD 364 mn</div> <div class="infographic-blueeconomy__compare-text">A debt conversion that paid for conservation.</div> </div>
      </div>
      <div class="infographic-blueeconomy__tags"> <div class="infographic-blueeconomy__tags-list"><span class="infographic-blueeconomy__tag">Coast</span> <span class="infographic-blueeconomy__tag">Bonds</span></div> </div>
    </div>
  </div>
</div>`

describe('publisher infographics', () => {
  const a = () => article(shell(`<article>${paragraphs(4)}${INFOGRAPHIC}${paragraphs(4, 5)}</article>`), 'https://indianexpress.com/article/upsc-current-affairs/fixture-10907921/')

  it('turns a stat grid into one semantic list of figures, never loose lines', () => {
    const html = a().html
    expect(html).toContain('<dl data-reader="stats"><dt>Length of the coastline</dt><dd><strong>11,098</strong> km</dd><dt>Share of trade by volume carried by sea</dt><dd><strong>~95%</strong> of trade</dd><dt>Supported by fisheries</dt><dd><strong>~30 mn</strong> livelihoods</dd></dl>')
    // The regression itself: the number, its unit and its label are never separate paragraphs or run together as prose.
    expect(html).not.toMatch(/<p>\s*11,098\s*<\/p>|<p>\s*km\s*<\/p>|<p>\s*Length of the coastline\s*<\/p>/)
    expect(html).not.toMatch(/11,098\s*km\s*Length of the coastline/)
    for (const tag of tags(html)) expect(READER_ELEMENTS.has(tag), tag).toBe(true)
    expect(html).not.toMatch(/class=|infographic|tab-input|<input/)
  })

  it('keeps comparison cards as figures with their notes, and point lists as lists', () => {
    const html = a().html
    expect(html).toContain('<dl data-reader="stats"><dt>Seychelles, 2018</dt><dd><strong>USD 15 mn</strong></dd><dd>The first sovereign bond of its kind, backed by a guarantee.</dd><dt>Belize</dt><dd><strong>USD 364 mn</strong></dd><dd>A debt conversion that paid for conservation.</dd></dl>')
    expect(html).toContain('<ol><li><strong>Ports.</strong> Large investments repaid over decades.</li><li><strong>Fishing enterprises.</strong> Smaller loans and insurance.</li></ol>')
    expect(html).toContain('<h4>Scale</h4><p><strong>More than ports and ships.</strong> The sector covers fishing, energy and research as well as trade.</p>')
  })

  it('shows every tab’s panel under its name, and drops the tab strip and the keyword chips', () => {
    const html = a().html
    for (const name of ['By the numbers', 'Who funds what', 'Lessons']) expect(html).toContain(`<h3>${name}</h3>`)
    expect(html.indexOf('<h3>By the numbers</h3>')).toBeLessThan(html.indexOf('11,098'))
    expect(html.indexOf('<h3>Lessons</h3>')).toBeLessThan(html.indexOf('Seychelles'))
    expect(html).not.toMatch(/By the numbers\s+Who funds what/)
    expect(html).not.toMatch(/>Coast<|Bonds/)
    expect(html).toContain('The coast in figures: scale, money and lessons')
  })

  it('leaves ordinary markup that only resembles those shapes alone', () => {
    const plain = clean('<div class="stat-cell"><div class="stat-number">A sentence with 3 words more than a figure allows here</div><div class="stat-label">Label</div></div><dl><dt>Term</dt><dd>Meaning</dd></dl>')
    expect(plain.html).not.toContain('data-reader')
    const page = article(shell(`<article>${paragraphs(5)}<div class="price-value">Rs 40</div><div class="card-title">A heading on its own</div>${paragraphs(4, 6)}</article>`))
    expect(page.html).not.toContain('data-reader')
    expect(page.html).toContain('A heading on its own')
  })
})
