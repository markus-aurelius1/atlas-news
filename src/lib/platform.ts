import { Capacitor } from '@capacitor/core'

/** True inside the Capacitor Android/iOS shell. */
export const isNative = Capacitor.isNativePlatform()
export const platform = Capacitor.getPlatform() as 'web' | 'android' | 'ios'

export const isStandalonePwa = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true)
