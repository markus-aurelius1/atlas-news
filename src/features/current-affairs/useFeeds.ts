/** Cache-first News feed: navigation never implies a refresh; stale data stays visible during revalidation. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useOnline } from '@/lib/useOnline'
import { canonicalUrl } from '@/current-affairs/feed'
import type { FeedResponse, RelevanceIndex } from '@/current-affairs/types'

const endpoint = '/api/current-affairs'
const localCacheName = 'tars-news-feed-v2'
export const NEWS_REFRESH_TTL_MS = 2 * 60 * 60 * 1000
const AUTO_RETRY_MS = 15 * 60 * 1000

let memoryFeed: FeedResponse | null = null
let memoryIndex: RelevanceIndex | null = null
let indexPending: Promise<RelevanceIndex> | null = null
let refreshPending: Promise<{ data: FeedResponse; cached: boolean }> | null = null
let lastAttemptAt = 0

export function relativeAge(value: string, now: number) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(value)) / 60000))
  return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`
}

function validResponse(data: FeedResponse) {
  return data?.version === 1 && Number.isFinite(Date.parse(data.fetchedAt)) && Array.isArray(data.items) && Array.isArray(data.sources) && data.items.every(i => typeof i.title === 'string' && typeof i.description === 'string' && typeof i.publisher === 'string' && typeof i.section === 'string' && typeof i.sourceId === 'string' && typeof i.url === 'string' && !!canonicalUrl(i.url))
}

function validIndex(data: RelevanceIndex) {
  return data?.version === 1 && Array.isArray(data.signals)
}

export function feedRefreshDue(data: FeedResponse | null, now = Date.now()) {
  return !data || !Number.isFinite(Date.parse(data.fetchedAt)) || now - Date.parse(data.fetchedAt) >= NEWS_REFRESH_TTL_MS
}

async function loadIndex(): Promise<RelevanceIndex> {
  if (memoryIndex) return memoryIndex
  if (indexPending) return indexPending
  indexPending = fetch(`${import.meta.env.BASE_URL}current-affairs/v1/relevance-index.json`, { cache: 'force-cache' })
    .then(async response => {
      if (!response.ok) throw new Error('Relevance index unavailable')
      const next = await response.json() as RelevanceIndex
      if (!validIndex(next)) throw new Error('Invalid relevance index')
      memoryIndex = next
      return next
    })
    .finally(() => { indexPending = null })
  return indexPending
}

async function restoreFeed(): Promise<FeedResponse | null> {
  if (memoryFeed) return memoryFeed
  try {
    const cache = await globalThis.caches?.open(localCacheName)
    const saved = await cache?.match(endpoint) ?? await globalThis.caches?.match(endpoint)
    if (!saved) return null
    const next = await saved.json() as FeedResponse
    if (!validResponse(next)) return null
    memoryFeed = next
    return next
  } catch {
    return null
  }
}

async function persistFeed(data: FeedResponse) {
  memoryFeed = data
  try {
    const cache = await globalThis.caches?.open(localCacheName)
    await cache?.put(endpoint, new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json; charset=utf-8' } }))
  } catch {
    // Memory plus the service-worker cache still keep the current session usable.
  }
}

function requestFeed(force = false): Promise<{ data: FeedResponse; cached: boolean }> {
  if (refreshPending) return refreshPending
  lastAttemptAt = Date.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 18000)
  refreshPending = fetch(force ? `${endpoint}?refresh=1` : endpoint, { signal: controller.signal, cache: force ? 'reload' : 'no-cache' })
    .then(async response => {
      if (!response.ok) throw new Error('News unavailable')
      const next = await response.json() as FeedResponse
      if (!validResponse(next)) throw new Error('Invalid feed response')
      await persistFeed(next)
      return { data: next, cached: response.headers.get('X-Tars-News-Cache') === 'hit' }
    })
    .finally(() => {
      clearTimeout(timeout)
      refreshPending = null
    })
  return refreshPending
}

/** Test-only reset for module-level navigation cache. */
export function resetFeedCacheForTests() {
  memoryFeed = null
  memoryIndex = null
  indexPending = null
  refreshPending = null
  lastAttemptAt = 0
}

export function useFeeds() {
  const online = useOnline()
  const [data, setData] = useState<FeedResponse | null>(memoryFeed), [index, setIndex] = useState<RelevanceIndex | null>(memoryIndex)
  const [loading, setLoading] = useState(!memoryFeed), [refreshing, setRefreshing] = useState(false), [error, setError] = useState(''), [cached, setCached] = useState(!!memoryFeed)
  const [now, setNow] = useState(Date.now())
  const [revision, setRevision] = useState(0), [manualRevision, setManualRevision] = useState(0)
  const handledManual = useRef(0)
  const reload = useCallback(() => setManualRevision(r => r + 1), [])

  useEffect(() => {
    const tick = () => {
      const at = Date.now()
      setNow(at)
      if (!document.hidden && feedRefreshDue(memoryFeed, at) && at - lastAttemptAt >= AUTO_RETRY_MS) setRevision(r => r + 1)
    }
    const interval = setInterval(tick, 60000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const force = manualRevision > handledManual.current
    if (force) handledManual.current = manualRevision

    const run = async () => {
      setError('')
      try {
        const nextIndex = await loadIndex()
        if (cancelled) return
        setIndex(nextIndex)

        const saved = await restoreFeed()
        if (cancelled) return
        if (saved) {
          setData(saved)
          setCached(true)
          setLoading(false)
        }

        const due = feedRefreshDue(saved)
        if (!online || (!force && !due) || (!force && due && Date.now() - lastAttemptAt < AUTO_RETRY_MS)) {
          if (!saved) {
            setLoading(false)
            if (!online) setError('No cached articles available. Connect once to load News.')
          }
          return
        }

        if (!saved) setLoading(true)
        setRefreshing(true)
        const next = await requestFeed(force)
        if (cancelled) return
        setData(next.data)
        setCached(next.cached)
        setError('')
      } catch {
        if (cancelled) return
        const restored = memoryFeed ?? await restoreFeed()
        if (restored) {
          setData(restored)
          setCached(true)
          setError('Refresh unavailable – showing the last successful feed.')
        } else {
          setError('Couldn’t refresh Current Affairs. Try again when you’re online.')
          setCached(true)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setRefreshing(false)
          setNow(Date.now())
        }
      }
    }

    void run()
    return () => { cancelled = true }
  }, [online, revision, manualRevision])

  return { data, index, loading, refreshing, error, cached, now, online, reload }
}
