/** News navigation uses a shared fresh snapshot and only revalidates on TTL expiry or explicit refresh. */
// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { NEWS_REFRESH_TTL_MS, resetFeedCacheForTests, useFeeds } from './useFeeds'

vi.mock('@/lib/useOnline', () => ({ useOnline: () => true }))

const index = { version: 1, signals: [] }
const feed = (fetchedAt = new Date().toISOString()) => ({ version: 1 as const, fetchedAt, items: [], sources: [] })

beforeEach(() => resetFeedCacheForTests())
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); resetFeedCacheForTests() })

function installFetch(responses: Array<ReturnType<typeof feed> | Promise<ReturnType<typeof feed>>>) {
  const apiCalls: string[] = []
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('relevance-index.json')) return new Response(JSON.stringify(index), { status: 200 })
    if (url.startsWith('/api/current-affairs')) {
      apiCalls.push(url)
      const body = await responses[Math.min(apiCalls.length - 1, responses.length - 1)]
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
  expect(calls).toEqual(['/api/current-affairs'])
  first.unmount()

  const second = renderHook(useFeeds)
  await waitFor(() => expect(second.result.current.loading).toBe(false))
  expect(second.result.current.data).not.toBeNull()
  expect(calls).toEqual(['/api/current-affairs'])
})

it('forces a refresh only when the user requests it', async () => {
  const calls = installFetch([feed(), feed()])
  const hook = renderHook(useFeeds)
  await waitFor(() => expect(hook.result.current.loading).toBe(false))

  act(() => hook.result.current.reload())
  await waitFor(() => expect(calls).toHaveLength(2))
  await waitFor(() => expect(hook.result.current.refreshing).toBe(false))
  expect(calls[1]).toBe('/api/current-affairs?refresh=1')
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
  await waitFor(() => expect(calls).toHaveLength(2))
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
  expect(calls).toHaveLength(1)
})
