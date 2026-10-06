/**
 * The reader's one upstream request: a listed publisher's article page, fetched once, on demand.
 *
 * Bounded on every side: the address is checked against the reader policy (as is every redirect, of which at
 * most three are followed), the request carries no cookies or credentials and identifies itself honestly, it
 * is given nine seconds in all, only an HTML response is read, and reading stops at three megabytes. What a
 * publisher refuses (401, 402, 403, 429, 451) is reported as refused, never retried another way. A page that
 * is cut short is an error, not an article. Nothing is stored: the caller sends the page on with `no-store`.
 */
import { articleTarget, type ArticleTargetError } from './policy.ts'

export const ARTICLE_TIMEOUT_MS = 9000
export const ARTICLE_MAX_BYTES = 3 * 1024 * 1024
/** After scripts, styles and embeds are removed. */
export const ARTICLE_MAX_CHARS = 1_500_000
export const ARTICLE_MAX_REDIRECTS = 3
export const ARTICLE_USER_AGENT = 'Mozilla/5.0 (compatible; TarsReader/1.0; personal on-demand reader view)'

export type ArticleFetchError = ArticleTargetError | 'upstream_blocked' | 'upstream_not_found' | 'upstream_unavailable' | 'upstream_timeout' | 'not_article' | 'too_large'
export type ArticleFetch = { ok: true; url: string; html: string } | { ok: false; error: ArticleFetchError }
export interface ArticlePayload { v: 1; url: string; html: string }

/** HTTP status for each outcome. Only the first four are decided without contacting a publisher. */
export const ARTICLE_ERROR_STATUS: Record<ArticleFetchError, number> = {
  invalid_url: 400,
  publisher_not_listed: 403,
  publisher_restricted: 451,
  upstream_blocked: 502,
  upstream_not_found: 502,
  upstream_unavailable: 502,
  upstream_timeout: 504,
  not_article: 502,
  too_large: 502,
}

const failed = (error: ArticleFetchError): ArticleFetch => ({ ok: false, error })

/** Elements the reader never shows. Their content is code or an embed, so the whole element goes. */
const REMOVED = ['script', 'style', 'svg', 'iframe', 'template', 'object', 'canvas', 'video', 'audio', 'select', 'textarea']

/**
 * Remove what the reader never uses before the page travels on: scripts (structured data is kept: it is inert
 * and carries the publisher's own access and date statements), styles, embeds and comments. Each kind is
 * removed in one forward pass, so a malformed page costs no more time than a well-formed one. This shrinks
 * the response; it is not the sanitizer. The client builds what it shows from an allowlist (reader/sanitize.ts).
 */
export function stripPage(html: string): string {
  let out = html
  for (const tag of REMOVED) out = stripElement(out, tag)
  return stripComments(out).replace(/<(?:link|embed)\b[^>]*>/gi, '')
}

function stripElement(text: string, tag: string): string {
  const open = new RegExp(`<${tag}(?=[\\s>/])[^>]*>`, 'gi'), close = new RegExp(`</${tag}\\s*>`, 'gi')
  const code = tag === 'script' || tag === 'style'
  let result = '', cursor = 0
  for (let match = open.exec(text); match; match = open.exec(text)) {
    close.lastIndex = open.lastIndex
    const selfClosed = !code && match[0].endsWith('/>')
    // Unclosed code runs to the end of the page, as a browser reads it; an unclosed embed loses only its tag,
    // so the text after it is never dropped.
    const stop = selfClosed ? open.lastIndex : close.exec(text) ? close.lastIndex : code ? text.length : open.lastIndex
    const keep = tag === 'script' && /\btype\s*=\s*["']?application\/ld\+json/i.test(match[0])
    result += text.slice(cursor, keep ? stop : match.index)
    cursor = stop
    open.lastIndex = stop
  }
  return result + text.slice(cursor)
}

function stripComments(text: string): string {
  let result = '', cursor = 0
  for (let from = text.indexOf('<!--'); from >= 0; from = text.indexOf('<!--', cursor)) {
    result += text.slice(cursor, from)
    const to = text.indexOf('-->', from + 4)
    if (to < 0) return result
    cursor = to + 3
  }
  return result + text.slice(cursor)
}

function decoderFor(contentType: string, head: Uint8Array): TextDecoder {
  const declared = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType)?.[1] ?? /<meta[^>]+charset\s*=\s*["']?([\w-]+)/i.exec(new TextDecoder('latin1').decode(head.subarray(0, 2048)))?.[1]
  try {
    return new TextDecoder(declared ?? 'utf-8')
  } catch {
    return new TextDecoder('utf-8')
  }
}

export async function fetchArticle(raw: string | null, fetcher: typeof fetch = fetch): Promise<ArticleFetch> {
  let target = articleTarget(raw)
  if (!target.ok) return failed(target.error)
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), ARTICLE_TIMEOUT_MS)
  try {
    for (let hop = 0; ; hop++) {
      const response = await fetcher(target.url.href, {
        signal: controller.signal,
        redirect: 'manual',
        credentials: 'omit',
        headers: { Accept: 'text/html,application/xhtml+xml;q=0.9', 'Accept-Language': 'en-IN,en;q=0.8', 'User-Agent': ARTICLE_USER_AGENT },
      })
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel().catch(() => {})
        const location = response.headers.get('Location')
        if (!location || hop >= ARTICLE_MAX_REDIRECTS) return failed('upstream_unavailable')
        // A redirect is followed only to another address the policy allows; a sign-in or consent host is not one.
        const next = articleTarget(location, target.url)
        if (!next.ok) return failed(next.error === 'publisher_restricted' ? 'publisher_restricted' : 'upstream_blocked')
        target = next
        continue
      }
      if ([401, 402, 403, 429, 451].includes(response.status)) { await response.body?.cancel().catch(() => {}); return failed('upstream_blocked') }
      if (response.status === 404 || response.status === 410) { await response.body?.cancel().catch(() => {}); return failed('upstream_not_found') }
      if (!response.ok || !response.body) { await response.body?.cancel().catch(() => {}); return failed('upstream_unavailable') }
      const contentType = response.headers.get('Content-Type') ?? ''
      if (!/^\s*(?:text\/html|application\/xhtml\+xml)\b/i.test(contentType)) { await response.body.cancel().catch(() => {}); return failed('not_article') }
      if (Number(response.headers.get('Content-Length')) > ARTICLE_MAX_BYTES) { await response.body.cancel().catch(() => {}); return failed('too_large') }

      const reader = response.body.getReader(), chunks: Uint8Array[] = []
      let bytes = 0
      try {
        while (true) {
          const chunk = await reader.read()
          if (chunk.done) break
          bytes += chunk.value.byteLength
          // Never hand on the first part of a page as if it were the page.
          if (bytes > ARTICLE_MAX_BYTES) return failed('too_large')
          chunks.push(chunk.value)
        }
      } finally {
        await reader.cancel().catch(() => {})
      }
      const body = new Uint8Array(bytes)
      let offset = 0
      for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength }
      const html = stripPage(decoderFor(contentType, body).decode(body))
      if (html.length > ARTICLE_MAX_CHARS) return failed('too_large')
      if (!html.trim()) return failed('not_article')
      return { ok: true, url: target.url.href, html }
    }
  } catch {
    return failed(controller.signal.aborted ? 'upstream_timeout' : 'upstream_unavailable')
  } finally {
    clearTimeout(timeout)
  }
}
