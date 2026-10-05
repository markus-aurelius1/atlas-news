/**
 * View state that outlives a screen.
 *
 * Leaving a workspace unmounts it, and with plain `useState` everything about
 * how it was being used is lost: the reading list is back on its first tab. `useRouteState` is a
 * `useState` whose value is kept for the session (in memory – a reload starts
 * fresh), so coming back finds the workspace as it was left.
 *
 * Keys are `<route>:<name>` (`current-affairs:filters`). Pressing the tab of the screen
 * you are already on calls `resetRoute(route)`: its transient state returns to
 * the defaults and the screen scrolls to the top.
 *
 * Scroll positions are kept here too (`rememberScroll` / `scrollFor`), by the
 * route host in App.tsx.
 */
import { useCallback, useRef, useSyncExternalStore } from 'react'

const values = new Map<string, unknown>()
const listeners = new Map<string, Set<() => void>>()
const scroll = new Map<string, number>()
const resetListeners = new Set<(route: string) => void>()

const notify = (key: string) => listeners.get(key)?.forEach((l) => l())

export function useRouteState<T>(key: string, initial: T | (() => T)): [T, (next: T | ((prev: T) => T)) => void] {
  // The default is worked out once per mount, so a reset returns to a stable value.
  const fallback = useRef<{ value: T } | null>(null)
  if (!fallback.current) fallback.current = { value: typeof initial === 'function' ? (initial as () => T)() : initial }
  const subscribe = useCallback(
    (cb: () => void) => {
      let set = listeners.get(key)
      if (!set) listeners.set(key, (set = new Set()))
      set.add(cb)
      return () => {
        set.delete(cb)
        if (!set.size) listeners.delete(key)
      }
    },
    [key],
  )
  const value = useSyncExternalStore(subscribe, () => (values.has(key) ? (values.get(key) as T) : fallback.current!.value))
  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = values.has(key) ? (values.get(key) as T) : fallback.current!.value
      const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
      if (Object.is(prev, resolved) && values.has(key)) return
      values.set(key, resolved)
      notify(key)
    },
    [key],
  )
  return [value, setValue]
}

/** Read a kept value outside React (tests, imperative code). */
export function peekRouteState<T>(key: string): T | undefined {
  return values.get(key) as T | undefined
}

/** Forget a route's kept state and scroll position; mounted screens fall back to their defaults at once. */
export function resetRoute(route: string) {
  const prefix = `${route}:`
  for (const key of [...values.keys()]) {
    if (!key.startsWith(prefix)) continue
    values.delete(key)
    notify(key)
  }
  scroll.delete(route)
  resetListeners.forEach((l) => l(route))
}

/** Called when a route is reset (the route host scrolls its stage to the top). */
export function onRouteReset(fn: (route: string) => void): () => void {
  resetListeners.add(fn)
  return () => resetListeners.delete(fn)
}

export function rememberScroll(route: string, top: number) {
  scroll.set(route, top)
}

export function scrollFor(route: string): number {
  return scroll.get(route) ?? 0
}

/** For tests. */
export function clearRouteState() {
  for (const key of [...values.keys()]) {
    values.delete(key)
    notify(key)
  }
  scroll.clear()
}
