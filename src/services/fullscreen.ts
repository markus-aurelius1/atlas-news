import { StatusBar } from '@capacitor/status-bar'
import { useSyncExternalStore } from 'react'
import { isNative } from '@/lib/platform'

/** Whether the Fullscreen API can be used here (iPhone Safari, for one, has none). */
export function fullscreenSupported(): boolean {
  return !isNative && typeof document !== 'undefined' && !!document.documentElement.requestFullscreen && document.fullscreenEnabled !== false
}

export function isFullscreen(): boolean {
  return typeof document !== 'undefined' && !!document.fullscreenElement
}

/** Enter full screen. Resolves to whether the document actually went full screen. */
export async function enterFullscreen(): Promise<boolean> {
  if (isNative) {
    await StatusBar.hide().catch(() => {})
    return true
  }
  const el = document.documentElement
  if (document.fullscreenElement) return true
  if (!el.requestFullscreen) return false
  try {
    await el.requestFullscreen({ navigationUI: 'hide' })
    return true
  } catch {
    return false
  }
}

export async function exitFullscreen(): Promise<void> {
  if (isNative) {
    await StatusBar.show().catch(() => {})
    return
  }
  if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen().catch(() => {})
}

/**
 * Call `fn` when the document leaves full screen – the Escape key, the
 * browser's own exit control or F11 all end up here. Returns an unsubscribe.
 */
export function onFullscreenExit(fn: () => void): () => void {
  if (typeof document === 'undefined') return () => {}
  const onChange = () => {
    if (!document.fullscreenElement) fn()
  }
  document.addEventListener('fullscreenchange', onChange)
  return () => document.removeEventListener('fullscreenchange', onChange)
}

function subscribe(cb: () => void) {
  document.addEventListener('fullscreenchange', cb)
  return () => document.removeEventListener('fullscreenchange', cb)
}

/** Live "is the document full screen" for UI that shows enter/exit affordances. */
export function useIsFullscreen(): boolean {
  return useSyncExternalStore(subscribe, isFullscreen, () => false)
}
