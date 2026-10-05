/** Local preview middleware; fixed refresh flag only, no arbitrary upstream URL, scheduler or server database. */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { collectFeeds, FEED_CACHE_CONTROL } from '../../src/current-affairs/gateway.ts'
import type { FeedResponse } from '../../src/current-affairs/types.ts'

let pending: Promise<FeedResponse> | null = null
const collectShared = () => {
  pending ??= collectFeeds().finally(() => { pending = null })
  return pending
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.writeHead(405); res.end(JSON.stringify({ error: 'Method not allowed' })); return }
  const force = new URL(req.url ?? '/', 'http://tars.local').searchParams.get('refresh') === '1'
  const data = await collectShared()
  const available = data.sources.some(s => s.status !== 'failed')
  res.setHeader('Cache-Control', force ? 'no-store' : available ? FEED_CACHE_CONTROL : 'no-store')
  res.setHeader('X-Tars-News-Cache', force ? 'bypass' : 'miss')
  res.writeHead(available ? 200 : 503)
  res.end(JSON.stringify(available ? data : { error: 'All publishers are unavailable', sources: data.sources }))
}
