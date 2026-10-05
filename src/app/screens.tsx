/** Lazy Atlas, News and settings screens, preloaded on navigation and in idle time. */
import type { ComponentType } from 'react'
import { lazyScreen, whenIdle, type Preloadable } from '@/lib/lazy'
import type { RouteName } from './router'

const LAZY: Partial<Record<RouteName, Preloadable<ComponentType<object>>>> = {
  atlas: lazyScreen(() => import('@/features/atlas/AtlasScreen')),
  settings: lazyScreen(() => import('@/features/settings/SettingsScreen')),
  'current-affairs': lazyScreen(() => import('@/features/current-affairs/NewsScreen')),
}


/** Ask for a screen's code now (a navigation item was pressed, focused or hovered). Safe to call repeatedly. */
export const SCREENS = LAZY as Record<RouteName, ComponentType<object>>

export function preloadRoute(name: RouteName) {
  LAZY[name]?.preload()
}

/** Preload the two product workspaces and shared preferences. */
const IDLE_ORDER: RouteName[] = ['atlas', 'current-affairs', 'settings']

/** After start-up, fetch every screen one at a time while the browser is idle. Returns a cancel function. */
export function preloadRoutesWhenIdle(): () => void {
  let cancel = () => {}
  let stopped = false
  const next = (i: number) => {
    if (stopped || i >= IDLE_ORDER.length) return
    cancel = whenIdle(() => {
      preloadRoute(IDLE_ORDER[i])
      next(i + 1)
    }, 1500)
  }
  next(0)
  return () => {
    stopped = true
    cancel()
  }
}
