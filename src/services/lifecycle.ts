/**
 * One place to learn "the app may have been asleep – re-derive everything".
 * Covers tab visibility, window focus, bfcache restores, network recovery and
 * Capacitor's native resume events.
 */
import { App } from '@capacitor/app'
import { isNative } from '@/lib/platform'

type Listener = (reason: string) => void
const listeners = new Set<Listener>()
let installed = false

function emit(reason: string) {
  for (const l of listeners) {
    try {
      l(reason)
    } catch (err) {
      console.error('[lifecycle]', err)
    }
  }
}

function install() {
  if (installed || typeof window === 'undefined') return
  installed = true
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') emit('visible')
  })
  window.addEventListener('focus', () => emit('focus'))
  window.addEventListener('pageshow', () => emit('pageshow'))
  window.addEventListener('online', () => emit('online'))
  if (isNative) {
    void App.addListener('resume', () => emit('resume'))
    void App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) emit('active')
    })
  }
}

export function onWake(listener: Listener): () => void {
  install()
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const isHidden = () => typeof document !== 'undefined' && document.visibilityState === 'hidden'
