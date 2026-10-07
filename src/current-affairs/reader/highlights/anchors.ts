import type { TextAnchor } from './model'

const BLOCK = new Set(['P', 'H2', 'H3', 'H4', 'LI', 'DT', 'DD', 'TD', 'TH', 'CAPTION', 'PRE', 'BLOCKQUOTE'])
const CONTEXT = 64
export const normalizeText = (text: string) => text.replace(/\s+/g, ' ').trim()
export interface TextIndex {
  text: string
  excluded: Element[]
  /** UTF-16 boundary points; whitespace runs and block separators map back to actual text nodes. */
  starts: Array<{ node: Text; offset: number }>
  ends: Array<{ node: Text; offset: number }>
}

/** One bounded linear pass per DOM revision. Figures and embed controls are not article prose. */
export function indexArticle(root: HTMLElement): TextIndex {
  let text = '', pending = false, previousBlock: Element | null = null
  const starts: TextIndex['starts'] = [], ends: TextIndex['ends'] = []
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT)
  for (let found = walker.nextNode(); found; found = walker.nextNode()) {
    if (found.nodeType === Node.ELEMENT_NODE) {
      if ((found as Element).tagName === 'BR') pending = text.length > 0
      continue
    }
    const node = found as Text, parent = node.parentElement
    if (!parent || parent.closest('figure, .reader-embed, [data-highlight-ui]')) continue
    let block: Element | null = parent
    while (block && block !== root && !BLOCK.has(block.tagName)) block = block.parentElement
    if (previousBlock && block !== previousBlock) pending = true
    for (let i = 0; i < node.data.length; i++) {
      if (/\s/.test(node.data[i])) { pending = text.length > 0; continue }
      if (pending && text.length) {
        text += ' '
        starts.push(ends[ends.length - 1])
        ends.push({ node, offset: i })
      }
      pending = false
      text += node.data[i]
      starts.push({ node, offset: i })
      ends.push({ node, offset: i + 1 })
    }
    if (node.data.trim()) previousBlock = block
  }
  return { text, starts, ends, excluded: [...root.querySelectorAll('figure, .reader-embed, [data-highlight-ui]')] }
}

export function makeAnchor(text: string, start: number, end: number): TextAnchor {
  return { version: 1, quote: text.slice(start, end), prefix: text.slice(Math.max(0, start - CONTEXT), start), suffix: text.slice(end, end + CONTEXT), start, end }
}
export interface Located { start: number; end: number }
const contextAt = (text: string, a: TextAnchor, start: number, end: number) =>
  (!a.prefix || text.slice(Math.max(0, start - a.prefix.length), start) === a.prefix) &&
  (!a.suffix || text.slice(end, end + a.suffix.length) === a.suffix)

/**
 * Offsets are a hint, never authority. Accept only exact quote + both available contexts.
 * Fallback accepts an exact quote with one unchanged sufficiently long context only if unique globally.
 * Ambiguity, missing quotes and changed context remain unresolved. No nearest-offset/fuzzy matching.
 */
export function resolveAnchor(text: string, anchor: TextAnchor): Located | null {
  const a = { ...anchor, quote: normalizeText(anchor.quote) }
  if (!a.quote) return null
  const candidates: Located[] = []
  let at = text.indexOf(a.quote)
  // Duplicate-heavy content is ambiguous rather than an unbounded search.
  while (at >= 0 && candidates.length <= 256) {
    candidates.push({ start: at, end: at + a.quote.length })
    at = text.indexOf(a.quote, at + 1)
  }
  if (candidates.length > 256) return null
  const exact = candidates.filter((c) => contextAt(text, a, c.start, c.end))
  if (exact.length === 1) {
    const c = exact[0]
    // Context uniqueness outranks offsets, even when an old offset still contains the quote.
    return c
  }
  if (exact.length > 1) return null
  // An exact unique quote with an unchanged adjacent context may move or lose context on one side.
  if (candidates.length !== 1) return null
  const c = candidates[0]
  const prefix = a.prefix.length >= 16 && text.slice(Math.max(0, c.start - a.prefix.length), c.start) === a.prefix
  const suffix = a.suffix.length >= 16 && text.slice(c.end, c.end + a.suffix.length) === a.suffix
  return prefix || suffix ? c : null
}

export function rangeAt(index: TextIndex, located: Located): Range | null {
  const start = index.starts[located.start], end = index.ends[located.end - 1]
  if (!start || !end || located.end <= located.start) return null
  const range = start.node.ownerDocument.createRange()
  range.setStart(start.node, start.offset)
  range.setEnd(end.node, end.offset)
  return range
}

/** Reject partial/outside ranges and any range crossing excluded non-prose, never silently truncate. */
export function previewSelection(root: HTMLElement, index: TextIndex, selection: Selection | null): (Located & { quote: string; range: Range }) | null {
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) return null
  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null
  for (const excluded of root.querySelectorAll('figure, .reader-embed, [data-highlight-ui]')) {
    if (range.intersectsNode(excluded)) return null
  }
  // Cached exclusions and ordered boundaries avoid traversing the article on selectionchange.
  const boundary = (points: TextIndex['starts'], before: (comparison: number) => boolean) => {
    let low = 0, high = points.length
    while (low < high) {
      const mid = (low + high) >>> 1, point = points[mid]
      if (before(range.comparePoint(point.node, point.offset))) low = mid + 1
      else high = mid
    }
    return low
  }
  let start = boundary(index.starts, (comparison) => comparison < 0)
  let end = boundary(index.ends, (comparison) => comparison <= 0)
  if (end <= start) return null
  while (index.text[start] === ' ' && start < end) start++
  while (index.text[end - 1] === ' ' && end > start) end--
  if (end <= start || end - start > 10000) return null
  const quote = selection.toString()
  if (!quote.trim() || quote.length > 10000) return null
  // Never persist an entire article body as an excerpt.
  if (start === 0 && end === index.text.length) return null
  return { quote, start, end, range: range.cloneRange() }
}

/** Anchor generation belongs to finalization, never the immediate preview path. */
export function captureSelection(root: HTMLElement, index: TextIndex, selection: Selection | null): { quote: string; anchor: TextAnchor } | null {
  const selected = previewSelection(root, index, selection)
  return selected ? { quote: selected.quote, anchor: makeAnchor(index.text, selected.start, selected.end) } : null
}
