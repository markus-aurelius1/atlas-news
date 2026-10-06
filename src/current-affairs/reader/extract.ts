/**
 * From a publisher's page to the reader's article: Mozilla Readability finds the article, the sanitizer
 * rebuilds it from an allowlist, and the result is judged before it is shown.
 *
 * The page is parsed into an inert document (nothing in it runs or loads). Three outcomes:
 *
 *   article      the text was extracted; `partial` marks one that looks cut short, which the reader labels
 *   restricted   the publisher says the article is for subscribers, or the page shows its paywall: no text is shown
 *   unreadable   no article could be found in the page (a video, a live page, a gallery, an interstitial)
 *
 * The headline, date and excerpt the reader shows come from the feed item that was opened, so what was pressed
 * is what opens; the page supplies the byline, the picture and the text.
 */
import { Readability } from '@mozilla/readability'
import { STATS_CLASS, normaliseInfographics } from './blocks.ts'
import { imageAddress, sanitizeArticle } from './sanitize.ts'

export interface ReaderArticle {
  /** Where the text came from, after redirects. */
  url: string
  byline: string | null
  publishedAt: string | null
  /** The opening picture, when the text does not start with one of its own. */
  lead: { src: string; alt: string; caption: string | null } | null
  /** Sanitized: elements of READER_ELEMENTS only. */
  html: string
  words: number
  minutes: number
  /** The text looks shorter than the article it comes from. */
  partial: boolean
}
export type Extraction = { kind: 'article'; article: ReaderArticle } | { kind: 'restricted' } | { kind: 'unreadable' }

/** Below this an extraction is not an article at all. */
export const MIN_ARTICLE_WORDS = 45
/** Below this it is shown, labelled as possibly incomplete. */
export const SHORT_ARTICLE_WORDS = 110
export const WORDS_PER_MINUTE = 230

const PAYWALL_TEXT = /(?:subscribe (?:now )?to (?:continue|keep) reading|subscribe to (?:read|unlock|access) (?:the |this )?(?:full|rest|story|article)|to (?:continue|keep) reading,? (?:please )?(?:subscribe|sign in|log in|register)|this (?:story|article|content) is (?:only )?(?:for|available to) (?:paid |premium |our )?(?:subscribers|members)|(?:premium|subscriber[- ]only) (?:story|article|content)|already a subscriber\?|unlock this (?:story|article)|you have (?:reached|exhausted) your (?:limit|free)|sign in to (?:continue|keep) reading|register to (?:continue|keep) reading|this post is for (?:paid|paying) subscribers)/i
const CUT_SHORT = /(?:…|\.\.\.|\[…\]|\bread more|\bcontinue reading|\bread the full (?:story|article))\s*$/i

type Json = Record<string, unknown>
const ARTICLE_TYPES = /(?:Article|Posting|Report|WebPage|CreativeWork|Review)$/

function structuredData(doc: Document): Json[] {
  const found: Json[] = []
  const collect = (value: unknown, depth: number) => {
    if (!value || typeof value !== 'object' || depth > 6 || found.length > 200) return
    if (Array.isArray(value)) {
      for (const item of value) collect(item, depth + 1)
      return
    }
    const node = value as Json
    found.push(node)
    if (node['@graph']) collect(node['@graph'], depth + 1)
    if (node.mainEntity) collect(node.mainEntity, depth + 1)
    if (node.hasPart) collect(node.hasPart, depth + 1)
  }
  for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    try {
      collect(JSON.parse(script.textContent ?? ''), 0)
    } catch {
      // A publisher's malformed block says nothing either way.
    }
  }
  return found
}

const typed = (node: Json, pattern: RegExp) => [node['@type']].flat().some((type) => typeof type === 'string' && pattern.test(type))
const no = (value: unknown) => value === false || (typeof value === 'string' && value.trim().toLowerCase() === 'false')
const meta = (doc: Document, ...names: string[]): string | null => {
  for (const name of names) {
    const content = doc.querySelector(`meta[property="${name}"], meta[name="${name}"]`)?.getAttribute('content')?.trim()
    if (content) return content
  }
  return null
}

/** The publisher's own statement that the article is not free to read. */
export function declaredRestricted(doc: Document, data: Json[] = structuredData(doc)): boolean {
  if (data.some((node) => no(node.isAccessibleForFree) && (typed(node, ARTICLE_TYPES) || typed(node, /WebPageElement$/)))) return true
  if (no(doc.querySelector('meta[itemprop="isAccessibleForFree"]')?.getAttribute('content'))) return true
  const tier = meta(doc, 'article:content_tier', 'content_tier')
  return !!tier && /^(?:locked|premium|paid|subscriber)/i.test(tier)
}

function cleanByline(value: string | null | undefined): string | null {
  if (!value) return null
  const text = value.replace(/\s+/g, ' ').replace(/^(?:written\s+)?by[:\s]+/i, '').replace(/\s*[|•·]\s*.*$/, '').trim()
  // A byline is a name or two, not a sentence, a link or a date line.
  if (!text || text.length > 90 || !/\p{L}{2}/u.test(text) || /https?:|@|\d{4}|updated|published|[{}<>]|\w\.\w+\.\w/i.test(text)) return null
  return text
}

function authors(data: Json[]): string | null {
  for (const node of data) {
    if (!typed(node, /(?:Article|Posting|Report)$/) || !node.author) continue
    const names = [node.author].flat().map((author) => (typeof author === 'string' ? author : typeof (author as Json)?.name === 'string' ? ((author as Json).name as string) : '')).map((name) => name.trim()).filter(Boolean)
    if (names.length) return [...new Set(names)].slice(0, 3).join(', ')
  }
  return null
}

function isoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const time = Date.parse(value)
  return Number.isFinite(time) && time > 0 ? new Date(time).toISOString() : null
}

const pathKey = (url: string) => {
  try {
    const name = new URL(url).pathname.split('/').filter(Boolean).pop() ?? ''
    return name.replace(/\.(?:jpe?g|png|webp|avif|gif)$/i, '').replace(/[-_]?\d{2,4}x\d{2,4}$/, '').toLowerCase()
  } catch {
    return ''
  }
}

function leadImage(doc: Document, base: string): string | null {
  const value = meta(doc, 'og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src')
  if (!value) return null
  try {
    const url = new URL(value, base)
    if (url.protocol === 'http:') url.protocol = 'https:'
    // A publisher's logo or default share card is not this article's picture.
    return url.protocol === 'https:' && !/(?:logo|default|placeholder|favicon|sprite|og[-_]?image[-_]?default|social[-_]?share)|(?:^|\/)og[-_]?image\.\w+$/i.test(url.pathname) ? url.href : null
  } catch {
    return null
  }
}

const squash = (text: string) => text.replace(/\s+/g, ' ').trim()

/** Blocks that sit inside article text on many sites and are never part of it. Matched against class and id. */
const NOISE = /(?:^|[\s_-])(?:also[-_]?read|read[-_]?also|related[-_]?(?:topics?|stor(?:y|ies)|articles?|news|posts?|links?)|newsletters?|social[-_]?share|share[-_]?(?:buttons?|bar|tools?|icons?)|(?:article|story|post)[-_]?tags|tags?[-_]?list|breadcrumbs?|trending|most[-_]?(?:read|popular)|featured[-_]?video|instory|taboola|outbrain|dfp[-_]?ad|ad[-_]?(?:slot|container|wrapper|unit)|advert(?:isement)?|print[-_]?hide|hide[-_]?print|no[-_]?print)(?:$|[\s_-])/i
/** A noise block is small; anything larger that happens to carry one of those names is left for Readability to judge. */
const NOISE_MAX_CHARS = 1500
const CAPTION = /(?:^|[\s_-])(?:caption|cap|img[-_]?desc|(?:image|photo|pic)[-_]?(?:desc|credit|caption|info))(?:$|[\s_-])/i
const HERO = /(?:^|[\s_-])(?:lead|hero|top[-_]?pic|featured|article[-_]?picture|main[-_]?(?:img|image|pic))/i
/** Publishers whose article text is split across several containers, which Readability would otherwise choose between. */
const CONTENT_HINTS: Record<string, string> = { 'politico.eu': '.article__content' }

const names = (el: Element) => `${el.getAttribute('class') ?? ''} ${el.getAttribute('id') ?? ''}`

/**
 * Repairs made to the page before Readability reads it: none of them adds anything, they only put the
 * publisher's own content where an article reader expects it.
 */
function prepare(doc: Document, url: string, lead: string | null): string | null {
  normaliseInfographics(doc)
  const host = new URL(url).hostname
  const hint = Object.entries(CONTENT_HINTS).find(([domain]) => host === domain || host.endsWith('.' + domain))?.[1]
  const parts = hint ? Array.from(doc.querySelectorAll(hint)) : []
  if (parts.length > 0) {
    // Only the article's own containers are left for Readability to read.
    const article = doc.createElement('article')
    for (const part of parts) article.appendChild(part)
    while (doc.body.firstChild) doc.body.removeChild(doc.body.firstChild)
    doc.body.appendChild(article)
  }
  for (const el of Array.from(doc.body.querySelectorAll('[class], [id]'))) {
    if (!el.isConnected) continue
    const name = names(el)
    if (NOISE.test(name) && (el.textContent ?? '').length < NOISE_MAX_CHARS) el.remove()
    // An empty element standing in for a line break (paragraphs written as one run of text).
    else if (/(?:^|\s)br(?:$|\s)/.test(name) && !el.firstChild) el.replaceWith(doc.createElement('br'), doc.createElement('br'))
  }
  // A caption beside its picture, written as a plain paragraph: make the pair a figure.
  for (const el of Array.from(doc.body.querySelectorAll('p[class], div[class], span[class]'))) {
    if (!el.isConnected || !CAPTION.test(names(el)) || el.closest('figure')) continue
    const text = squash(el.textContent ?? ''), holder = el.parentElement
    if (!text || text.length > 500 || !holder || holder === doc.body) continue
    const images = holder.querySelectorAll('img')
    if (images.length !== 1 || squash(holder.textContent ?? '').length - text.length > 20) continue
    const figure = doc.createElement('figure'), caption = doc.createElement('figcaption')
    caption.textContent = text
    // With its <picture>, whose sources may name the better versions.
    figure.append(images[0].closest('picture') ?? images[0], caption)
    while (holder.firstChild) holder.removeChild(holder.firstChild)
    holder.appendChild(figure)
  }
  if (!lead) return null
  // An opening picture that only a script would have filled in: the publisher names the same picture as og:image.
  const hero = Array.from(doc.body.querySelectorAll('img')).find((img) => !imageAddress(img, url) && [img, img.parentElement, img.parentElement?.parentElement, img.parentElement?.parentElement?.parentElement].some((el) => el && HERO.test(names(el))))
  if (hero) {
    for (const name of hero.getAttributeNames()) if (name !== 'alt') hero.removeAttribute(name)
    hero.setAttribute('src', lead)
  }
  // The caption the page gives that same picture, kept in case the picture itself is left out of the article text.
  const key = pathKey(lead)
  for (const figure of Array.from(doc.body.querySelectorAll('figure'))) {
    const img = figure.querySelector('img'), address = img && imageAddress(img, url)
    const caption = squash(figure.querySelector('figcaption')?.textContent ?? '')
    if (address && caption && caption.length <= 500 && (address === lead || (key && pathKey(address) === key))) return caption
  }
  return null
}

export function extractArticle(page: { url: string; html: string }, hint: { title: string; description?: string; publishedAt?: string | null }): Extraction {
  const doc = new DOMParser().parseFromString(page.html, 'text/html')
  // Relative links and images resolve against the article, not against Tars.
  for (const base of Array.from(doc.querySelectorAll('base'))) base.remove()
  const base = doc.createElement('base')
  base.setAttribute('href', page.url)
  doc.head.appendChild(base)

  const data = structuredData(doc)
  if (declaredRestricted(doc, data)) return { kind: 'restricted' }
  const lead = leadImage(doc, page.url)
  const leadAlt = meta(doc, 'og:image:alt', 'twitter:image:alt') ?? ''
  const byline = cleanByline(authors(data)) ?? cleanByline(meta(doc, 'author', 'article:author_name', 'parsely-author', 'dc.creator'))
  const published = isoDate(hint.publishedAt) ?? data.map((node) => isoDate(node.datePublished)).find(Boolean) ?? isoDate(meta(doc, 'article:published_time', 'datePublished'))

  const leadCaption = prepare(doc, page.url, lead)
  const parsed = new Readability(doc, { charThreshold: 250, maxElemsToParse: 30000, classesToPreserve: [STATS_CLASS] }).parse()
  if (!parsed?.content) return { kind: 'unreadable' }
  const content = new DOMParser().parseFromString(`<!doctype html><body>${parsed.content}</body>`, 'text/html')
  // The headline is shown from the feed, and so is its standfirst: copies of them at the top of the text are removed.
  const same = (a: string, b: string) => !!a && !!b && (a === b || (a.length > 24 && b.startsWith(a)) || (b.length > 24 && a.startsWith(b)))
  const key = (text: string | null | undefined) => squash(text ?? '').toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '')
  const title = key(hint.title), description = key(hint.description)
  const opening = key(content.body.querySelector('p')?.textContent)
  for (const heading of Array.from(content.body.querySelectorAll('h1, h2')).slice(0, 2)) {
    const text = key(heading.textContent)
    if (same(text, title) || same(text, description) || (text.length > 40 && opening.includes(text))) heading.remove()
  }
  for (const caption of Array.from(content.body.querySelectorAll('figcaption'))) if (same(key(caption.textContent), title)) caption.remove()
  const clean = sanitizeArticle(content.body, page.url, content)
  if (PAYWALL_TEXT.test(clean.text.slice(-700)) || (clean.words < 400 && PAYWALL_TEXT.test(clean.text))) return { kind: 'restricted' }
  // A page of links to other stories is not this story.
  if (clean.words < MIN_ARTICLE_WORDS || clean.linkDensity > 0.4) return { kind: 'unreadable' }

  const opensWithPicture = clean.firstImageAt >= 0 && clean.firstImageAt < 500
  const repeated = !!lead && clean.images.some((image) => image === lead || (pathKey(image) && pathKey(image) === pathKey(lead)))
  return {
    kind: 'article',
    article: {
      url: page.url,
      byline: byline ?? cleanByline(parsed.byline),
      publishedAt: published ?? isoDate(parsed.publishedTime),
      lead: lead && !opensWithPicture && !repeated ? { src: lead, alt: squash(leadAlt).slice(0, 300), caption: leadCaption && !same(key(leadCaption), title) ? leadCaption : null } : null,
      html: clean.html,
      words: clean.words,
      minutes: Math.max(1, Math.round(clean.words / WORDS_PER_MINUTE)),
      partial: clean.words < SHORT_ARTICLE_WORDS || CUT_SHORT.test(clean.text),
    },
  }
}
