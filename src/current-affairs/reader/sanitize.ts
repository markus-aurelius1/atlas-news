/**
 * The reader's sanitizer. Nothing from a publisher's page is ever inserted as it is: a new tree is built from
 * an allowlist of elements, and each kept element receives only the few attributes named here, each checked.
 * Scripts, styles, forms, embeds, event handlers, classes, ids and inline styles have no way through, links
 * and images must resolve to an http(s) address, and whatever is not recognised is unwrapped to its text.
 *
 * It keeps what makes an article read as one (paragraphs, headings, quotations, lists, figures with their
 * captions, tables, preformatted text) and removes the furniture publishers thread through the text
 * ("Also read", advertisement markers, newsletter prompts).
 */

/** Kept as they are. Everything else is renamed (below), dropped with its content, or unwrapped. */
export const READER_ELEMENTS = new Set(['p', 'h2', 'h3', 'h4', 'blockquote', 'ul', 'ol', 'li', 'figure', 'figcaption', 'img', 'pre', 'code', 'hr', 'br', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'dl', 'dt', 'dd', 'a', 'em', 'strong', 'u', 's', 'sub', 'sup', 'mark', 'small', 'cite', 'q', 'abbr', 'time'])
const RENAMED: Record<string, string> = { h1: 'h2', h5: 'h4', h6: 'h4', b: 'strong', i: 'em', strike: 's', del: 's', ins: 'u', tt: 'code', kbd: 'code', samp: 'code' }
/** Removed with everything inside them. */
const DROPPED = new Set(['script', 'style', 'noscript', 'template', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'form', 'input', 'button', 'select', 'option', 'textarea', 'label', 'fieldset', 'svg', 'math', 'canvas', 'video', 'audio', 'source', 'track', 'map', 'area', 'nav', 'aside', 'footer', 'dialog', 'menu', 'link', 'meta', 'base', 'head', 'title'])
const BLOCKS = new Set(['p', 'h2', 'h3', 'h4', 'blockquote', 'ul', 'ol', 'figure', 'pre', 'hr', 'table', 'dl'])
/** Run within a line of text; every other element begins and ends a block. */
const PHRASING = new Set(['a', 'em', 'strong', 'u', 's', 'sub', 'sup', 'mark', 'small', 'cite', 'q', 'abbr', 'time', 'code'])
/** May hold blocks of their own; text placed directly inside the others stays inline. */
const FLOW = new Set(['blockquote', 'li', 'td', 'th', 'dd', 'figure'])

/** Publisher furniture: short lines that are an instruction to the visitor, not part of the article. */
const FURNITURE = /^(?:(?:also|must)\s+(?:read|see|watch)\b|read\s+(?:also|more|here)\b|don[’']t\s+miss\b|in\s+pics\b|watch\s*[:|]|advertisement\s*$|story\s+continues\s+below|follow\s+us\s+on\b|(?:subscribe|sign\s+up)\s+(?:to|for)\s+(?:our|the)\b|click\s+here\s+to\s+(?:join|follow|subscribe|read)\b|recommended\s+stories\b|related\s+(?:stories|articles|news)\b|you\s+may\s+(?:also\s+)?like\b|express\s+shorts\b|prefer\s+\S+\s*on\s+google\b|featured\s+video\b|topics\s+mentioned\s+in\s+this\s+article|share\s+your\s+thoughts\b|stay\s+updated\s+with\b|(?:first\s+)?published\s*(?:on\s*)?[-–:]|last\s+updated\s*[-–:])/i
const FURNITURE_MAX = 160

export const MAX_READER_NODES = 20000
const MAX_DEPTH = 80

export interface Sanitized {
  /** A serialised tree of READER_ELEMENTS only. */
  html: string
  text: string
  words: number
  /** Addresses of the images kept, in order. */
  images: string[]
  /** Characters of text before the first image, or -1 when there is none. */
  firstImageAt: number
  /** Share of the text that is link text: high for a list of other stories, low for an article. */
  linkDensity: number
}

export class ReaderLimitError extends Error {}

function resolve(value: string | null, base: string): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 2048) return null
  try {
    const url = new URL(trimmed, base)
    if (url.protocol === 'http:') url.protocol = 'https:'
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}

/** Links may also be plain http: they open in another tab, they are not loaded into the reader. */
function resolveLink(value: string | null, base: string): string | null {
  if (!value || value.trim().startsWith('#')) return null
  try {
    const url = new URL(value.trim(), base)
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password && url.href.length <= 2048 ? url.href : null
  } catch {
    return null
  }
}

const PLACEHOLDER = /(?:^data:|placeholder|blank\.(?:gif|png)|spacer\.|transparent\.|1x1|pixel\.(?:gif|png)|lazy-?load|loading\.(?:gif|svg)|grey\.(?:gif|png)|default\.(?:jpg|png))/i

function fromSrcset(value: string | null): string | null {
  if (!value) return null
  let best: { url: string; width: number } | null = null
  for (const part of value.split(/,\s+|,(?=https?:)/)) {
    const [url, size = ''] = part.trim().split(/\s+/)
    if (!url || url.startsWith('data:')) continue
    const width = size.endsWith('w') ? Number(size.slice(0, -1)) : size.endsWith('x') ? Number(size.slice(0, -1)) * 800 : 800
    // The largest candidate a reading column can use; beyond that it is only weight.
    if (!best || (width > best.width && width <= 1600) || (best.width > 1600 && width < best.width)) best = { url, width: Number.isFinite(width) ? width : 800 }
  }
  return best?.url ?? null
}

/** The picture an <img> stands for: its own address, or the one a lazy loader would have filled in. Never a placeholder. */
export function imageAddress(el: Element, base: string): string | null {
  const lazy = ['data-src', 'data-original', 'data-src-template', 'data-lazy-src', 'data-lazy', 'data-original-src', 'data-hi-res-src', 'data-full-src'].map((name) => el.getAttribute(name))
  const candidates = [el.getAttribute('src'), ...lazy, fromSrcset(el.getAttribute('data-srcset')), fromSrcset(el.getAttribute('srcset'))]
  if (el.parentElement?.tagName.toLowerCase() === 'picture') for (const source of Array.from(el.parentElement.querySelectorAll('source'))) candidates.push(fromSrcset(source.getAttribute('data-srcset')), fromSrcset(source.getAttribute('srcset')))
  for (const candidate of candidates) {
    if (!candidate || PLACEHOLDER.test(candidate)) continue
    const url = resolve(candidate, base)
    if (url) return url
  }
  return null
}

const dimension = (value: string | null) => (value && /^\d{1,5}$/.test(value.trim()) ? Number(value) : null)

function hidden(el: Element): boolean {
  if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') return true
  const style = el.getAttribute('style')
  return !!style && /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(style)
}

const squash = (text: string) => text.replace(/\s+/g, ' ').trim()

function furniture(el: Element): boolean {
  const text = squash(el.textContent ?? '')
  return text.length > 0 && text.length <= FURNITURE_MAX && FURNITURE.test(text)
}

/**
 * Build the reader's tree from `source` (Readability's article element). `base` is the article's address, for
 * relative links and images. `doc` is any HTML document to create the new elements in.
 */
export function sanitizeArticle(source: Element, base: string, doc: Document): Sanitized {
  let nodes = 0
  const images: string[] = []
  const root = doc.createElement('div')

  const image = (el: Element): Element | null => {
    const url = imageAddress(el, base)
    if (!url || images.includes(url)) return null
    const width = dimension(el.getAttribute('width')), height = dimension(el.getAttribute('height'))
    // Tracking pixels, icons and avatars are not illustrations.
    if ((width !== null && width < 100) || (height !== null && height < 60)) return null
    const img = doc.createElement('img')
    img.setAttribute('src', url)
    img.setAttribute('alt', squash(el.getAttribute('alt') ?? '').slice(0, 300))
    if (width && height) {
      img.setAttribute('width', String(width))
      img.setAttribute('height', String(height))
    }
    images.push(url)
    return img
  }

  const walk = (from: Node, into: Element, depth: number, pre: boolean) => {
    if (depth > MAX_DEPTH) return
    for (const child of Array.from(from.childNodes)) {
      if (++nodes > MAX_READER_NODES) throw new ReaderLimitError('Article is too large to prepare')
      if (child.nodeType === 3) {
        // Zero-width joiners and breaks that publishers thread through words are not part of the text.
        const text = (child.nodeValue ?? '').replace(/[​⁠﻿]/g, '')
        if (text) into.appendChild(doc.createTextNode(pre ? text : text.replace(/\s+/g, ' ')))
        continue
      }
      if (child.nodeType !== 1) continue
      const el = child as Element
      const raw = el.tagName.toLowerCase(), tag = RENAMED[raw] ?? raw
      if (DROPPED.has(raw) || hidden(el)) continue
      if (raw === 'picture') {
        const inner = el.querySelector('img')
        const img = inner && image(inner)
        if (img) into.appendChild(img)
        continue
      }
      if (tag === 'img') {
        const img = image(el)
        if (img) into.appendChild(img)
        continue
      }
      if (tag === 'br' || tag === 'hr') {
        into.appendChild(doc.createElement(tag))
        continue
      }
      if (!pre && raw !== 'figcaption' && raw !== 'blockquote' && !el.querySelector('img') && furniture(el)) continue
      if (!READER_ELEMENTS.has(tag)) {
        // Not an element the reader has: keep what it says. A block wrapper still separates its text from its neighbours'.
        const block = /^(?:div|section|article|main|header|center|address|details|summary|h\d)$/.test(raw)
        if (block) into.appendChild(doc.createTextNode(' '))
        walk(el, into, depth + 1, pre)
        if (block) into.appendChild(doc.createTextNode(' '))
        continue
      }
      const out = doc.createElement(tag)
      if (tag === 'a') {
        const href = resolveLink(el.getAttribute('href'), base)
        if (!href) {
          walk(el, into, depth + 1, pre)
          continue
        }
        out.setAttribute('href', href)
      } else if (tag === 'td' || tag === 'th') {
        for (const name of ['colspan', 'rowspan']) {
          const span = dimension(el.getAttribute(name))
          if (span && span > 1 && span <= 50) out.setAttribute(name, String(span))
        }
      } else if (tag === 'ol') {
        const start = el.getAttribute('start')
        if (start && /^-?\d{1,6}$/.test(start)) out.setAttribute('start', start)
      } else if (tag === 'time') {
        const datetime = el.getAttribute('datetime')
        if (datetime && /^[\dT:+.\-Z ]{4,40}$/.test(datetime)) out.setAttribute('datetime', datetime)
      }
      walk(el, out, depth + 1, pre || tag === 'pre')
      into.appendChild(out)
    }
  }
  walk(source, root, 0, false)
  tidy(root, doc)

  // The article as words: blocks are separate even where the markup puts no space between them.
  let spaced = ''
  const say = (node: Node) => {
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === 3) spaced += child.nodeValue ?? ''
      else if (child.nodeType === 1) {
        const inline = PHRASING.has((child as Element).tagName.toLowerCase())
        if (!inline) spaced += ' '
        say(child)
        if (!inline) spaced += ' '
      }
    }
  }
  say(root)
  const text = squash(spaced)
  const first = root.querySelector('img')
  let firstImageAt = -1
  if (first) {
    // Text that precedes the first image, to decide whether the article already opens with a picture.
    let before = ''
    const until = (node: Node): boolean => {
      for (const child of Array.from(node.childNodes)) {
        if (child === first) return true
        if (child.nodeType === 3) before += child.nodeValue ?? ''
        else if (until(child)) return true
      }
      return false
    }
    until(root)
    firstImageAt = squash(before).length
  }
  const linked = Array.from(root.querySelectorAll('a')).reduce((n, a) => n + squash(a.textContent ?? '').length, 0)
  return { html: root.innerHTML, text, words: text ? text.split(' ').length : 0, images, firstImageAt, linkDensity: text ? linked / text.length : 0 }
}

const isBlank = (el: Element) => !squash(el.textContent ?? '') && !el.querySelector('img, hr')

/** Give the cleaned tree an article's shape: loose text in paragraphs, pictures in figures, nothing empty. */
function tidy(root: Element, doc: Document) {
  // A paragraph that only holds pictures is a figure.
  for (const img of Array.from(root.querySelectorAll('img'))) {
    if (img.closest('figure')) continue
    const parent = img.parentElement!
    const figure = doc.createElement('figure')
    const lone = parent !== root && parent.tagName.toLowerCase() === 'p' && !squash(parent.textContent ?? '') && parent.querySelectorAll('img').length === 1
    if (lone) {
      parent.replaceWith(figure)
      figure.appendChild(img)
    } else if (parent === root || FLOW.has(parent.tagName.toLowerCase())) {
      img.replaceWith(figure)
      figure.appendChild(img)
    } else {
      // An image inside running text (or a link): lift it out in front of the block it interrupts.
      let block: Element = parent
      while (block.parentElement && block.parentElement !== root && !FLOW.has(block.parentElement.tagName.toLowerCase())) block = block.parentElement
      block.parentElement?.insertBefore(figure, block)
      figure.appendChild(img)
    }
  }
  // A figure is a picture and, at most, its caption.
  for (const figure of Array.from(root.querySelectorAll('figure'))) {
    const img = figure.querySelector('img')
    if (!img) {
      figure.remove()
      continue
    }
    const caption = squash(Array.from(figure.querySelectorAll('figcaption')).map((c) => c.textContent ?? '').join(' ')) || squash(Array.from(figure.childNodes).filter((n) => n.nodeType === 3).map((n) => n.nodeValue ?? '').join(' '))
    while (figure.firstChild) figure.removeChild(figure.firstChild)
    figure.appendChild(img)
    if (caption) {
      const figcaption = doc.createElement('figcaption')
      figcaption.textContent = caption.slice(0, 600)
      figure.appendChild(figcaption)
    }
  }
  wrapLooseText(root, doc)
  for (const el of Array.from(root.querySelectorAll('blockquote, li, td, th, dd'))) if (Array.from(el.children).some((c) => BLOCKS.has(c.tagName.toLowerCase()))) wrapLooseText(el, doc)
  // Empty wrappers, emptied links, and runs of line breaks left behind by removed furniture.
  for (let pass = 0; pass < 3; pass++) {
    for (const el of Array.from(root.querySelectorAll('p, h2, h3, h4, blockquote, li, ul, ol, a, em, strong, table, tr, thead, tbody, dl, dt, dd, pre, figcaption, small, cite, mark, u, s'))) if (isBlank(el)) el.remove()
  }
  const isBreak = (node: Node | null) => node?.nodeType === 1 && (node as Element).tagName.toLowerCase() === 'br'
  for (const br of Array.from(root.querySelectorAll('br'))) {
    const beside = (side: 'previousSibling' | 'nextSibling') => {
      let node = br[side]
      while (node && node.nodeType === 3 && !squash(node.nodeValue ?? '')) node = node[side]
      return node
    }
    const prev = beside('previousSibling'), next = beside('nextSibling')
    // A break at the edge of its block, or the third in a row, separates nothing.
    if (!prev || !next || (isBreak(prev) && isBreak(next))) br.remove()
  }
  for (const hr of Array.from(root.querySelectorAll('hr'))) {
    const next = hr.nextElementSibling
    if (!hr.previousElementSibling || !next || next.tagName.toLowerCase() === 'hr') hr.remove()
  }
}

/** Text and inline elements sitting directly in a block container become paragraphs. */
function wrapLooseText(container: Element, doc: Document) {
  let run: Element | null = null
  for (const node of Array.from(container.childNodes)) {
    const block = node.nodeType === 1 && BLOCKS.has((node as Element).tagName.toLowerCase())
    if (block) {
      run = null
      continue
    }
    if (!run) {
      if (node.nodeType === 3 && !squash(node.nodeValue ?? '')) {
        container.removeChild(node)
        continue
      }
      run = doc.createElement('p')
      container.insertBefore(run, node)
    }
    run.appendChild(node)
  }
}
