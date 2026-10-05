import { useEffect, useRef } from 'react'
import { StatusBar, Style } from '@capacitor/status-bar'
import type { ThemePreference } from '@/data/types'
import { isNative } from '@/lib/platform'
import { KEYS, migrateLegacyKeys } from '@/lib/storage'
import { useMediaQuery } from '@/ui/useMedia'

export function useResolvedDark(pref: ThemePreference): boolean {
  const systemDark = useMediaQuery('(prefers-color-scheme: dark)')
  return pref === 'dark' || (pref === 'system' && systemDark)
}

/**
 * What sits behind the status bar / title bar: the stage on a phone, the canvas
 * around it in the window. Twins of --bg and --canvas in index.css (and of the
 * pre-paint script in index.html).
 */
export const CHROME_COLOR = {
  light: { stage: '#FAFAF7', canvas: '#FAFAF7' },
  dark: { stage: '#111215', canvas: '#111215' },
} as const

/** Apply the theme class, browser chrome colour and native status bar style. */
export function useApplyTheme(pref: ThemePreference, override?: 'dark' | null) {
  const dark = useResolvedDark(pref) || override === 'dark'
  const framed = useMediaQuery('(min-width: 768px)')
  const applied = useRef<boolean | null>(null)
  useEffect(() => {
    const root = document.documentElement
    // A deliberate switch cross-fades (see .theme-fade in index.css); the first paint does not.
    let fade: ReturnType<typeof setTimeout> | undefined
    if (applied.current !== null && applied.current !== dark) {
      root.classList.add('theme-fade')
      fade = setTimeout(() => root.classList.remove('theme-fade'), 320)
    }
    applied.current = dark
    root.classList.toggle('dark', dark)
    const palette = CHROME_COLOR[dark ? 'dark' : 'light']
    const color = framed ? palette.canvas : palette.stage
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
    try {
      migrateLegacyKeys()
      localStorage.setItem(KEYS.theme, pref)
    } catch {
      /* ignore */
    }
    if (isNative) {
      void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => {})
      void StatusBar.setBackgroundColor({ color }).catch(() => {})
    }
    return () => {
      if (fade !== undefined) {
        clearTimeout(fade)
        root.classList.remove('theme-fade')
      }
    }
  }, [dark, pref, framed])
  return dark
}
