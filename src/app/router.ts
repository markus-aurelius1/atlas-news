/** Tiny hash router – deep links work in the PWA, in Capacitor and from native links. */
import { createContext, useContext, useSyncExternalStore } from 'react'

export type RouteName = 'atlas' | 'current-affairs' | 'settings'
export const ROUTES: RouteName[] = ['atlas', 'current-affairs', 'settings']

export interface Route {
  name: RouteName
  params: URLSearchParams
  raw: string
}

function parse(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '')
  const [path, query = ''] = clean.split('?')
  // Removed surfaces and empty/unknown links land on Atlas without executing legacy parameters.
  const known = (ROUTES as string[]).includes(path)
  const name = known ? path as RouteName : 'atlas'
  return { name, params: new URLSearchParams(known ? query : ''), raw: known ? hash : '#/atlas' }
}

let current = parse(typeof location !== 'undefined' ? location.hash : '')
if (typeof location !== 'undefined' && location.hash !== current.raw) history.replaceState(null, '', current.raw)
/**
 * The places visited inside the app since it opened, oldest first. The browser's
 * own history may reach back to another site (or to nothing, in an installed
 * app); this says whether "Back" has somewhere of ours to go.
 */
const trail: string[] = [current.raw]
function walked(hash: string) {
  // Arriving at the entry before the current one is a step back; anything else is a step forward.
  if (trail.length > 1 && trail[trail.length - 2] === hash) trail.pop()
  else if (trail[trail.length - 1] !== hash) trail.push(hash)
  if (trail.length > 60) trail.shift()
}
export function canGoBack(): boolean {
  return trail.length > 1
}
/** Back to the previous screen visited in the app; with none (a deep link, a fresh launch), to `fallback`. */
export function goBack(fallback = '#/atlas') {
  if (canGoBack()) history.back()
  else navigate(fallback, { replace: true })
}
const listeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    current = parse(location.hash)
    if (location.hash !== current.raw) history.replaceState(null, '', current.raw)
    walked(current.raw)
    listeners.forEach((l) => l())
  })
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const hash = parse(to.startsWith('#') ? to : `#/${to.replace(/^\//, '')}`).raw
  if (hash === location.hash) return
  if (opts.replace) {
    history.replaceState(null, '', hash)
    current = parse(hash)
    trail[trail.length - 1] = current.raw
    listeners.forEach((l) => l())
  } else location.hash = hash
}

/** Drop one-shot params (like ?place=…) after handling them. */
export function consumeParams(...keys: string[]) {
  const r = current
  let changed = false
  for (const k of keys) {
    if (r.params.has(k)) {
      r.params.delete(k)
      changed = true
    }
  }
  if (changed) {
    const q = r.params.toString()
    navigate(`#/${r.name}${q ? `?${q}` : ''}`, { replace: true })
  }
}

/**
 * The route a screen was put on the stage for. The stage shows a *deferred*
 * route (App.tsx): while the next screen is being prepared the current one is
 * still up, and it must go on seeing its own address – not the next screen's,
 * which it would otherwise re-render for just before being replaced. The Atlas, kept
 * behind the other screens, is pinned to the last address that was its own.
 */
export const RouteContext = createContext<Route | null>(null)

const subscribe = (cb: () => void) => {
  listeners.add(cb)
  return () => listeners.delete(cb)
}
const never = () => () => {}

/** The route: the one pinned for this screen by the stage, or the live one (the shell, overlays). */
export function useRoute(): Route {
  const pinned = useContext(RouteContext)
  return useSyncExternalStore(pinned ? never : subscribe, () => pinned ?? current)
}

/** Imperative actions can run before the browser dispatches hashchange. */
export function currentRoute(): Route {
  return typeof location !== 'undefined' && location.hash !== current.raw ? parse(location.hash) : current
}
