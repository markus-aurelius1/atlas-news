/**
 * The article's text, drawn from the sanitized markup as React elements. The markup is parsed into an inert
 * document and each node is rebuilt here from the same allowlist the sanitizer used, so no publisher markup is
 * ever inserted as HTML: an element this file does not name cannot reach the page.
 */
import { ArrowUpRight } from 'lucide-react'
import { createElement, memo, useMemo, useState, type ReactNode, type RefObject } from 'react'
import { READER_ELEMENTS } from '@/current-affairs/reader/sanitize'

const VOID = new Set(['br', 'hr'])
const SMALL_PICTURE = 520
/** Whitespace between these and their children is markup formatting, not text. */
const STRUCTURAL = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr', 'ul', 'ol', 'dl'])
const web = (value: string | null) => (value && /^https?:\/\//i.test(value) ? value : null)
const secure = (value: string | null) => (value && /^https:\/\//i.test(value) ? value : null)
const count = (value: string | null) => (value && /^\d{1,5}$/.test(value) ? Number(value) : undefined)

/** A publisher's picture: loaded lazily, without a referrer, and gone (with its caption) if it fails. */
export function ReaderFigure({ src, alt, width, height, caption, lead }: { src: string; alt: string; width?: number; height?: number; caption?: string; lead?: boolean }) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  // A small picture keeps its own size: stretched to the column it would only be blurred.
  const [small, setSmall] = useState(width !== undefined && width < SMALL_PICTURE)
  if (failed) return null
  return (
    <figure className="reader-figure" data-lead={lead || undefined} data-loaded={loaded || undefined} data-small={small || undefined}>
      <img src={src} alt={alt} width={width} height={height} loading={lead ? 'eager' : 'lazy'} decoding="async" referrerPolicy="no-referrer" onLoad={(e) => { setSmall(e.currentTarget.naturalWidth < SMALL_PICTURE); setLoaded(true) }} onError={() => setFailed(true)} />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}

function children(node: Node, structural: boolean): ReactNode[] {
  const out: ReactNode[] = []
  node.childNodes.forEach((child, index) => {
    const made = build(child, index, structural)
    if (made !== null) out.push(made)
  })
  return out
}

function build(node: Node, key: number, structural: boolean): ReactNode {
  if (node.nodeType === 3) return structural && !node.nodeValue?.trim() ? null : node.nodeValue
  if (node.nodeType !== 1) return null
  const el = node as Element
  const tag = el.tagName.toLowerCase()
  if (!READER_ELEMENTS.has(tag)) return children(el, structural)
  if (VOID.has(tag)) return createElement(tag, { key })
  if (tag === 'figure' || tag === 'img') {
    const img = tag === 'img' ? el : el.querySelector('img')
    const src = secure(img?.getAttribute('src') ?? null)
    if (!img || !src) return null
    return <ReaderFigure key={key} src={src} alt={img.getAttribute('alt') ?? ''} width={count(img.getAttribute('width'))} height={count(img.getAttribute('height'))} caption={tag === 'figure' ? el.querySelector('figcaption')?.textContent?.trim() || undefined : undefined} />
  }
  if (tag === 'a') {
    const href = web(el.getAttribute('href'))
    if (!href) return children(el, false)
    return (
      <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow">
        {children(el, false)}
      </a>
    )
  }
  const kind = el.getAttribute('data-reader')
  if (tag === 'p' && kind === 'embed') {
    const href = secure(el.querySelector('a')?.getAttribute('href') ?? null)
    if (!href) return null
    return (
      <p key={key} className="reader-embed">
        <span>{el.textContent?.trim().slice(0, 40) || 'Embedded content'}</span>
        <a href={href} target="_blank" rel="noopener noreferrer nofollow">
          View on original
          <ArrowUpRight aria-hidden="true" />
        </a>
      </p>
    )
  }
  if (tag === 'dl' && kind === 'stats') {
    // Each figure with its label (and note) is one cell of the grid.
    const cells: Array<{ label: string; value: Element | null; notes: string[] }> = []
    for (const part of Array.from(el.children)) {
      const name = part.tagName.toLowerCase()
      if (name === 'dt') cells.push({ label: part.textContent?.trim() ?? '', value: null, notes: [] })
      else if (name === 'dd' && cells.length) {
        const cell = cells[cells.length - 1]
        if (!cell.value) cell.value = part
        else cell.notes.push(part.textContent?.trim() ?? '')
      }
    }
    const shown = cells.filter((cell) => cell.value)
    if (!shown.length) return null
    return (
      <dl key={key} className="reader-stats" data-count={Math.min(shown.length, 4)}>
        {shown.map((cell, i) => (
          <div key={i} className="reader-stat">
            <dt>{cell.label}</dt>
            <dd className="reader-stat-value">{children(cell.value!, false)}</dd>
            {cell.notes.filter(Boolean).map((note, n) => (
              <dd key={n} className="reader-stat-note">
                {note}
              </dd>
            ))}
          </div>
        ))}
      </dl>
    )
  }
  if (tag === 'table')
    return (
      <div key={key} className="reader-table" tabIndex={0} role="group" aria-label="Table">
        <table>{children(el, true)}</table>
      </div>
    )
  const props: Record<string, unknown> = { key }
  if (tag === 'td' || tag === 'th') {
    props.colSpan = count(el.getAttribute('colspan'))
    props.rowSpan = count(el.getAttribute('rowspan'))
  } else if (tag === 'ol') props.start = count(el.getAttribute('start'))
  else if (tag === 'time') props.dateTime = el.getAttribute('datetime') ?? undefined
  return createElement(tag, props, ...children(el, STRUCTURAL.has(tag)))
}

export const ArticleBody = memo(function ArticleBody({ html, bodyRef }: { html: string; bodyRef?: RefObject<HTMLDivElement | null> }) {
  const content = useMemo(() => children(new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html').body, false), [html])
  return <div ref={bodyRef} className="reader-body">{content}</div>
})
