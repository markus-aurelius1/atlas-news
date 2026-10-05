/**
 * Lazy screens that survive a failed chunk request. After a deploy an open tab
 * still holds the old index and asks for files that no longer exist; offline, a
 * chunk the service worker hasn't cached can't be fetched at all. The first
 * failure reloads the page once (the new index names the new chunks); if it
 * fails again the error reaches the screen's error boundary, which offers a
 * reload instead of looping.
 *
 * Every lazy component also has `preload()`: the app asks for the code during
 * idle time and when a navigation item is pressed or focused, so that by the
 * time a screen is opened its code is already here. A preload that fails does
 * nothing at all (no reload, no error): the real request will try again.
 */
import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

const RELOADED = 'tars.chunk-reload'

/** Errors browsers raise when a dynamic import can't be fetched or parsed. */
export function isChunkError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error)
  return /dynamically imported module|Importing a module script failed|ChunkLoadError|Failed to fetch|Unable to preload CSS/i.test(message)
}

/** Reload once per failure; false when this page load already is that reload. */
export function reloadOnceForChunk(storage: Pick<Storage, 'getItem' | 'setItem'> | undefined = safeSession(), reload: () => void = () => location.reload()): boolean {
  if (!storage) return false
  try {
    if (storage.getItem(RELOADED)) return false
    storage.setItem(RELOADED, String(Date.now()))
  } catch {
    return false
  }
  reload()
  return true
}

function clearReloadMark() {
  try {
    safeSession()?.removeItem(RELOADED)
  } catch {
    /* storage unavailable */
  }
}

function safeSession(): Storage | undefined {
  try {
    return typeof sessionStorage === 'undefined' ? undefined : sessionStorage
  } catch {
    return undefined
  }
}

export type Preloadable<T extends ComponentType<object>> = LazyExoticComponent<T> & { preload: () => void }

/**
 * `load` with its result remembered, so a preload and the render that follows
 * share one request. A failed request is forgotten, so the next call tries again.
 */
export function once<M>(load: () => Promise<M>): () => Promise<M> {
  let pending: Promise<M> | null = null
  return () => {
    if (!pending) {
      pending = load()
      pending.catch(() => (pending = null))
    }
    return pending
  }
}

export function lazyScreen<T extends ComponentType<object>>(load: () => Promise<{ default: T }>): Preloadable<T> {
  const request = once(load)
  const Screen = lazy(() =>
    request().then(
      (module) => {
        clearReloadMark()
        return module
      },
      (error: unknown) => {
        // The page is reloading: never settle, so no error flashes first.
        if (isChunkError(error) && reloadOnceForChunk()) return new Promise<{ default: T }>(() => {})
        throw error
      },
    ),
  ) as Preloadable<T>
  Screen.preload = () => void request().catch(() => {})
  return Screen
}

/** Run `task` when the browser has nothing better to do (or after `timeout` ms at the latest). Returns a cancel function. */
export function whenIdle(task: () => void, timeout = 2000): () => void {
  if (typeof window === 'undefined') return () => {}
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(task, { timeout })
    return () => window.cancelIdleCallback(id)
  }
  const id = setTimeout(task, Math.min(timeout, 600))
  return () => clearTimeout(id)
}
