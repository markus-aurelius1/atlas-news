/** News navigation uses a shared fresh snapshot and only revalidates on TTL expiry or explicit refresh. */
// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { FEED_SHARDS, FEED_REGISTRY_GENERATION } from '@/current-affairs/shards'
import { NEWS_REFRESH_TTL_MS, feedRefreshDue, resetFeedCacheForTests, useFeeds } from './useFeeds'

vi.mock('@/lib/useOnline', () => ({ useOnline: () => true }))

const index = { version: 2, signals: [] }
const SHARDS = FEED_SHARDS.length
const refreshUrls = (suffix = '') => FEED_SHARDS.map((_, shard) => `/api/current-affairs?shard=${shard}&generation=${FEED_REGISTRY_GENERATION}${suffix}`)
const feed = (fetchedAt = new Date().toISOString()) => ({ registryGeneration: FEED_REGISTRY_GENERATION, version: 1 as const, fetchedAt, items: [], sources: [] })

beforeEach(() => resetFeedCacheForTests())
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); resetFeedCacheForTests() })

function installFetch(responses: Array<ReturnType<typeof feed> | Promise<ReturnType<typeof feed>>>) {
  const apiCalls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('relevance-index.json')) return new Response(JSON.stringify(index), { status: 200 })
    if (url.startsWith('/api/current-affairs')) {
      apiCalls.push(url)
      const body = await responses[Math.min(Math.floor((apiCalls.length - 1) / SHARDS), responses.length - 1)]
      return new Response(JSON.stringify(body), { status: 200 })
    }
    throw new Error(`Unexpected fetch: ${url}`)
  }))
  return apiCalls
}

it('does not refetch a fresh feed when News unmounts and mounts again', async () => {
  const calls = installFetch([feed()])
  const first = renderHook(useFeeds)
  await waitFor(() => expect(first.result.current.loading).toBe(false))
  expect(calls).toEqual(refreshUrls())
  first.unmount()

  const second = renderHook(useFeeds)
  await waitFor(() => expect(second.result.current.loading).toBe(false))
  expect(second.result.current.data).not.toBeNull()
  expect(calls).toEqual(refreshUrls())
})

it('forces a refresh only when the user requests it', async () => {
  const calls = installFetch([feed(), feed()])
  const hook = renderHook(useFeeds)
  await waitFor(() => expect(hook.result.current.loading).toBe(false))

  act(() => hook.result.current.reload())
  await waitFor(() => expect(calls).toHaveLength(2 * SHARDS))
  await waitFor(() => expect(hook.result.current.refreshing).toBe(false))
  expect(calls.slice(SHARDS)).toEqual(refreshUrls('&refresh=1'))
})

it('keeps stale articles visible while refreshing in the background', async () => {
  let now = Date.now()
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  const old = feed(new Date(now).toISOString())
  const fresh = feed(new Date(now + NEWS_REFRESH_TTL_MS + 60000).toISOString())
  let release!: (value: ReturnType<typeof feed>) => void
  const pending = new Promise<ReturnType<typeof feed>>(resolve => { release = resolve })
  const calls = installFetch([old, pending])
  const first = renderHook(useFeeds)
  await waitFor(() => expect(first.result.current.loading).toBe(false))
  first.unmount()

  now += NEWS_REFRESH_TTL_MS + 60000
  const second = renderHook(useFeeds)
  await waitFor(() => expect(calls).toHaveLength(2 * SHARDS))
  expect(second.result.current.data?.fetchedAt).toBe(old.fetchedAt)
  expect(second.result.current.loading).toBe(false)
  expect(second.result.current.refreshing).toBe(true)

  act(() => release(fresh))
  await waitFor(() => expect(second.result.current.refreshing).toBe(false))
  expect(second.result.current.data?.fetchedAt).toBe(fresh.fetchedAt)
})

it('deduplicates concurrent first-load feed requests', async () => {
  const calls = installFetch([feed()])
  const first = renderHook(useFeeds)
  const second = renderHook(useFeeds)
  await waitFor(() => expect(first.result.current.loading).toBe(false))
  await waitFor(() => expect(second.result.current.loading).toBe(false))
  expect(calls).toHaveLength(SHARDS)
})

it('keeps a failed shard’s articles from the last snapshot and fails only when no shard answers', async () => {
  let now = Date.now()
  vi.spyOn(Date, 'now').mockImplementation(() => now)
  const [lost] = FEED_SHARDS[1], [live] = FEED_SHARDS[0]
  const article = (sourceId: string, n: number) => ({ title: `${sourceId} ${n}`, url: `https://example.org/${sourceId}/${n}`, publisher: 'P', sourceId, section: 'S', publishedAt: null, description: '' })
  let round = 0, down: number[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('relevance-index.json')) return new Response(JSON.stringify(index), { status: 200 })
    const shard = Number(new URL(url, 'https://tars.test').searchParams.get('shard'))
    if (down.includes(shard)) return new Response(JSON.stringify({ error: 'down' }), { status: 503 })
    const source = FEED_SHARDS[shard][0].id
    return new Response(JSON.stringify({ registryGeneration: FEED_REGISTRY_GENERATION, version: 1, fetchedAt: new Date(now).toISOString(), items: [article(source, round)], sources: [{ sourceId: source, status: 'ok', count: 1 }] }), { status: 200 })
  }))
  const hook = renderHook(useFeeds)
  await waitFor(() => expect(hook.result.current.loading).toBe(false))
  expect(hook.result.current.data?.items).toHaveLength(SHARDS)

  round = 1; down = [1]; now += 60000
  act(() => hook.result.current.reload())
  await waitFor(() => expect(hook.result.current.data?.items.some(i => i.title === `${live.id} 1`)).toBe(true))
  const titles = hook.result.current.data!.items.map(i => i.title)
  expect(titles).toContain(`${lost.id} 0`)
  expect(titles).toHaveLength(SHARDS)
  expect(hook.result.current.data!.sources.find(s => s.sourceId === lost.id)?.status).toBe('failed')
  expect(hook.result.current.error).toBe('')

  round = 2; down = FEED_SHARDS.map((_, shard) => shard); now += 60000
  act(() => hook.result.current.reload())
  await waitFor(() => expect(hook.result.current.error).toBe('Refresh unavailable – showing the last successful feed.'))
  expect(hook.result.current.data!.items.map(i => i.title)).toEqual(titles)
})

it('restores a fresh legacy cache without optional fields or generation and preserves the two-hour boundary',async()=>{
  const snapshot={version:1 as const,fetchedAt:new Date().toISOString(),items:[{title:'Legacy metadata',url:'https://indianexpress.com/article/legacy',description:'',publisher:'Indian Express',sourceId:'ie-explained',section:'Explained',publishedAt:null}],sources:[]}
  vi.stubGlobal('caches',{open:async()=>({match:async()=>new Response(JSON.stringify(snapshot))})})
  expect(feedRefreshDue(snapshot,Date.parse(snapshot.fetchedAt)+NEWS_REFRESH_TTL_MS-1)).toBe(false);expect(feedRefreshDue(snapshot,Date.parse(snapshot.fetchedAt)+NEWS_REFRESH_TTL_MS)).toBe(true)
  const calls=installFetch([feed()]), hook=renderHook(useFeeds)
  await waitFor(()=>expect(hook.result.current.loading).toBe(false));expect(hook.result.current.data?.items[0].title).toBe('Legacy metadata');expect(calls).toEqual([])
})
it('all wrong-generation shard responses keep the last usable cache during forced refresh',async()=>{
  const snapshot={version:1 as const,fetchedAt:new Date().toISOString(),items:[{title:'Retained',url:'https://indianexpress.com/article/retained',description:'',publisher:'Indian Express',sourceId:'ie-explained',section:'Explained',publishedAt:null}],sources:[]}
  vi.stubGlobal('caches',{open:async()=>({match:async()=>new Response(JSON.stringify(snapshot))})})
  const calls=installFetch([{...feed(),registryGeneration:'older-generation'}]), hook=renderHook(useFeeds)
  await waitFor(()=>expect(hook.result.current.loading).toBe(false));act(()=>hook.result.current.reload())
  await waitFor(()=>expect(hook.result.current.error).toBe('Refresh unavailable – showing the last successful feed.'))
  expect(calls).toHaveLength(SHARDS);expect(hook.result.current.data?.items[0].title).toBe('Retained')
})
