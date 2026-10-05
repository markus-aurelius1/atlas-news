/**
 * The one place that knows whether motion is reduced.
 *
 * The answer combines the operating system's `prefers-reduced-motion` with the
 * person's own choice in Settings (System, Reduced, Full). The choice is kept in
 * localStorage as well as in the settings record, so index.html can write the
 * result to <html data-motion> before first paint and nothing animates by
 * mistake while the database is still opening. CSS reads the attribute
 * (`[data-motion='reduced']`), scripts call `motionPreference()` or
 * `prefersReducedMotion()`, and <MotionConfig> (App.tsx) is given the same value.
 */
import { useSyncExternalStore } from 'react'

export type MotionChoice = 'system' | 'reduced' | 'full'
export type MotionLevel = 'reduced' | 'full'

/** Twin of the inline script in index.html. */
const KEY = 'tars.motion'
const listeners = new Set<() => void>()

function systemReduced(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function motionChoice(): MotionChoice {
  try {
    const v = typeof localStorage === 'undefined' ? null : localStorage.getItem(KEY)
    return v === 'reduced' || v === 'full' ? v : 'system'
  } catch {
    return 'system'
  }
}

/** Reduced or full, after applying the person's choice to what the system asks for. */
export function motionPreference(): MotionLevel {
  const choice = motionChoice()
  return choice === 'system' ? (systemReduced() ? 'reduced' : 'full') : choice
}

export const prefersReducedMotion = (): boolean => motionPreference() === 'reduced'

function apply() {
  if (typeof document !== 'undefined') document.documentElement.dataset.motion = motionPreference()
  listeners.forEach((l) => l())
}

/** Settings › Appearance › Motion. */
export function setMotionChoice(choice: MotionChoice) {
  try {
    if (choice === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, choice)
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
  apply()
}

let watching = false
function watch() {
  if (watching || typeof matchMedia === 'undefined') return
  watching = true
  matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', apply)
  // Another tab changed the choice.
  window.addEventListener('storage', (e) => e.key === KEY && apply())
  apply()
}

const subscribe = (cb: () => void) => {
  watch()
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** The current level, re-rendering when the system setting or the person's choice changes. */
export function useMotionPreference(): MotionLevel {
  return useSyncExternalStore(subscribe, motionPreference, () => 'full' as MotionLevel)
}
