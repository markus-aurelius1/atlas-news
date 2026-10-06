/**
 * The article's text, drawn from the sanitized markup as React elements. The markup is parsed into an inert
 * document and each node is rebuilt here from the same allowlist the sanitizer used, so no publisher markup is
 * ever inserted as HTML: an element this file does not name cannot reach the page.
 */
import { createElement, memo, useMemo, useState, type ReactNode } from 'react'
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

export const ArticleBody = memo(function ArticleBody({ html }: { html: string }) {
  const content = useMemo(() => children(new DOMParser().parseFromString(`<!doctype html><body>${html}</body>`, 'text/html').body, false), [html])
  return <div className="reader-body">{content}</div>
})
