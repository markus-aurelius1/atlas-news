/**
 * One article, fetched when it is opened. The reader asks the gateway for the publisher's page, extracts and
 * sanitizes it here (the extraction code is loaded on first use), and keeps the result in memory only: a few
 * articles for this visit, so stepping back and forth does not ask the publisher twice. Nothing is written to
 * storage, and nothing is fetched for an article that has not been opened.
 */
import { useCallback, useEffect, useState } from 'react'
import type { ReaderArticle } from '@/current-affairs/reader/extract'
import type { ArticlePayload } from '@/current-affairs/reader/fetch-article'
import { articleTarget } from '@/current-affairs/reader/policy'

export type UnavailableReason =
  /** The publisher is one Tars never fetches from (subscription journalism). */
  | 'publisher'
  /** The publisher marks this article as for subscribers, or the page shows its paywall. */
  | 'subscribers'
  /** The publisher refused the request. */
  | 'refused'
  | 'offline'
  | 'gone'
  /** The page holds no article the reader can lay out. */
  | 'unreadable'
  | 'slow'
  | 'session'
  | 'failed'

export type ArticleState = { status: 'loading' } | { status: 'ready'; article: ReaderArticle } | { status: 'unavailable'; reason: UnavailableReason }
export interface ArticleRequest { url: string; title: string; description: string; publishedAt: string | null }

const endpoint = '/api/article'
const REQUEST_TIMEOUT_MS = 20000
/** Articles held for this visit. Memory only. */
const MEMORY_LIMIT = 8
const memory = new Map<string, ArticleState>()

function remember(url: string, state: ArticleState) {
  memory.delete(url)
  memory.set(url, state)
  while (memory.size > MEMORY_LIMIT) memory.delete(memory.keys().next().value!)
}

const unavailable = (reason: UnavailableReason): ArticleState => ({ status: 'unavailable', reason })

const GATEWAY_REASON: Record<string, UnavailableReason> = {
  publisher_restricted: 'publisher',
  publisher_not_listed: 'failed',
  invalid_url: 'failed',
  upstream_blocked: 'refused',
  upstream_not_found: 'gone',
  upstream_timeout: 'slow',
  upstream_unavailable: 'failed',
  forbidden_origin: 'failed',
  method_not_allowed: 'failed',
  not_article: 'unreadable',
  too_large: 'unreadable',
}

/** Outcomes that will not change by asking again during this visit. */
const settled = (state: ArticleState) => state.status === 'ready' || (state.status === 'unavailable' && ['publisher', 'subscribers', 'unreadable', 'gone'].includes(state.reason))

export async function loadArticle(request: ArticleRequest, signal: AbortSignal): Promise<ArticleState> {
  const target = articleTarget(request.url)
  // Decided without a request: the gateway would say the same.
  if (!target.ok) return unavailable(target.error === 'publisher_restricted' ? 'publisher' : 'failed')
  let response: Response
  try {
    response = await fetch(`${endpoint}?url=${encodeURIComponent(request.url)}`, { signal, cache: 'no-store', credentials: 'same-origin', redirect: 'manual', headers: { Accept: 'application/json' } })
  } catch (error) {
    if (signal.aborted) throw error
    return unavailable(navigator.onLine ? 'failed' : 'offline')
  }
  // Access has stopped vouching for this browser: it answers for the gateway with a redirect to its login, or with its own 401 or 403.
  if (response.type === 'opaqueredirect' || response.status === 401) return unavailable('session')
  if (!response.ok) {
    const code = await response.json().then((body: { error?: string }) => body?.error ?? '', () => '')
    // A 403 the gateway did not write (it names every refusal of its own) is Access's.
    return unavailable(GATEWAY_REASON[code] ?? (response.status === 403 ? 'session' : 'failed'))
  }
  let page: ArticlePayload
  try {
    page = (await response.json()) as ArticlePayload
  } catch {
    return unavailable('failed')
  }
  // Only a page from the publisher that was asked for is laid out.
  if (page?.v !== 1 || typeof page.html !== 'string' || typeof page.url !== 'string' || !articleTarget(page.url).ok) return unavailable('failed')
  try {
    const { extractArticle } = await import('@/current-affairs/reader/extract')
    const extraction = extractArticle(page, request)
    if (extraction.kind === 'article') return { status: 'ready', article: extraction.article }
    return unavailable(extraction.kind === 'restricted' ? 'subscribers' : 'unreadable')
  } catch {
    // Whatever could not be prepared safely is not shown.
    return unavailable('unreadable')
  }
}

export function useArticle(request: ArticleRequest | null, online: boolean): { state: ArticleState; retry: () => void } {
  const url = request?.url ?? null
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<{ url: string; state: ArticleState } | null>(null)
  const retry = useCallback(() => {
    if (url) memory.delete(url)
    setAttempt((n) => n + 1)
  }, [url])

  useEffect(() => {
    if (!request) return
    const known = memory.get(request.url)
    if (known) {
      setResult({ url: request.url, state: known })
      return
    }
    if (!online) {
      setResult({ url: request.url, state: unavailable('offline') })
      return
    }
    setResult(null)
    const controller = new AbortController()
    let timedOut = false
    const timeout = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, REQUEST_TIMEOUT_MS)
    loadArticle(request, controller.signal)
      .then((state) => {
        if (controller.signal.aborted) return
        if (settled(state)) remember(request.url, state)
        setResult({ url: request.url, state })
      })
      .catch(() => {
        if (timedOut) setResult({ url: request.url, state: unavailable('slow') })
      })
      .finally(() => clearTimeout(timeout))
    return () => {
      clearTimeout(timeout)
      controller.abort()
    }
    // The request is identified by its address; its other fields never change for one address.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, online, attempt])

  return { state: result && result.url === url ? result.state : { status: 'loading' }, retry }
}

/** For tests. */
export function forgetArticles() {
  memory.clear()
}
