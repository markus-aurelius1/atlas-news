/** Local preview middleware with the production contract: one registry shard per request, a fixed refresh flag, no arbitrary upstream URL. */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { collectFeeds, FEED_CACHE_CONTROL } from '../../src/current-affairs/gateway.ts'
import { FEED_SHARDS, shardIndex, requestLayout, registryGeneration } from '../../src/current-affairs/shards.ts'
import type { FeedResponse } from '../../src/current-affairs/types.ts'

const pending = new Map<string, Promise<FeedResponse>>()
function collectShared(shard: number, layout = FEED_SHARDS): Promise<FeedResponse> {
  const generation = registryGeneration(layout), key = generation + ':' + shard
  let job = pending.get(key)
  if (!job) {
    job = collectFeeds((input, init) => fetch(input, { ...init, redirect: 'manual' }), layout[shard]).then(data => ({ ...data, registryGeneration: generation })).finally(() => { pending.delete(key) })
    pending.set(key, job)
  }
  return job
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); res.writeHead(405); res.end(JSON.stringify({ error: 'Method not allowed' })); return }
  const params = new URL(req.url ?? '/', 'http://tars.local').searchParams, layout = requestLayout(params)
  if (!layout) { res.setHeader('Cache-Control','no-store'); res.writeHead(409); res.end(JSON.stringify({ error: 'Unsupported feed generation' })); return }
  const shard = shardIndex(params, layout.length)
  if (shard === null) { res.setHeader('Cache-Control', 'no-store'); res.writeHead(400); res.end(JSON.stringify({ error: 'A shard number is required', shards: FEED_SHARDS.length })); return }
  const force = params.get('refresh') === '1'
  const data = await collectShared(shard, layout)
  const available = data.sources.some(s => s.status !== 'failed')
  res.setHeader('Cache-Control', force ? 'no-store' : available ? FEED_CACHE_CONTROL : 'no-store')
  res.setHeader('X-Tars-News-Cache', force ? 'bypass' : 'miss')
  res.writeHead(available ? 200 : 503)
  res.end(JSON.stringify(available ? data : { error: 'All publishers in this shard are unavailable', sources: data.sources }))
}
