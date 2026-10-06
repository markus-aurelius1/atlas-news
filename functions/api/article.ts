/**
 * Reader gateway: one listed publisher's article page per request (?url=…), for the signed-in reader who opened
 * its headline. The address is checked against the reader policy before anything is fetched, so this is not a
 * proxy: an unlisted, restricted or malformed address makes no upstream request. An invocation makes one
 * upstream request (and follows at most three allowed redirects); it reads no cache and writes none, and the
 * response is `no-store`, so no article text is kept at the edge or by the browser.
 */
import { ARTICLE_ERROR_STATUS, fetchArticle, type ArticleFetchError, type ArticlePayload } from '../../src/current-affairs/reader/fetch-article.ts'

const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex' }
const refuse = (status: number, error: ArticleFetchError | 'method_not_allowed' | 'forbidden_origin', extra: Record<string, string> = {}) => new Response(JSON.stringify({ error }), { status, headers: { ...headers, ...extra } })

export async function onRequest({ request }: { request: Request }): Promise<Response> {
  if (request.method !== 'GET') return refuse(405, 'method_not_allowed', { Allow: 'GET' })
  // Only the app's own pages read articles: another site cannot spend this account's requests.
  const site = request.headers.get('Sec-Fetch-Site')
  if (site && site !== 'same-origin') return refuse(403, 'forbidden_origin')

  const result = await fetchArticle(new URL(request.url).searchParams.get('url'), (input, init) => fetch(input, init))
  if (!result.ok) return refuse(ARTICLE_ERROR_STATUS[result.error], result.error)
  const payload: ArticlePayload = { v: 1, url: result.url, html: result.html }
  return new Response(JSON.stringify(payload), { headers })
}
