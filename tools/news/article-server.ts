/** Local preview middleware for the reader gateway, with the production contract: one listed publisher page per request, never an arbitrary address. */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { ARTICLE_ERROR_STATUS, fetchArticle, type ArticlePayload } from '../../src/current-affairs/reader/fetch-article.ts'

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.writeHead(405); res.end(JSON.stringify({ error: 'method_not_allowed' })); return }
  const site = req.headers['sec-fetch-site']
  if (site && site !== 'same-origin') { res.writeHead(403); res.end(JSON.stringify({ error: 'forbidden_origin' })); return }
  const result = await fetchArticle(new URL(req.url ?? '/', 'http://tars.local').searchParams.get('url'))
  if (!result.ok) { res.writeHead(ARTICLE_ERROR_STATUS[result.error]); res.end(JSON.stringify({ error: result.error })); return }
  const payload: ArticlePayload = { v: 1, url: result.url, html: result.html }
  res.writeHead(200)
  res.end(JSON.stringify(payload))
}
