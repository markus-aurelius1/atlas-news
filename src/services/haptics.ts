import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { isNative } from '@/lib/platform'

let enabled = true

export function setHapticsEnabled(value: boolean) {
  enabled = value
}

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* unsupported */
  }
}

export const haptics = {
  tap() {
    if (!enabled) return
    if (isNative) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => {})
    else vibrate(8)
  },
  press() {
    if (!enabled) return
    if (isNative) void Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {})
    else vibrate(14)
  },
  success() {
    if (!enabled) return
    if (isNative) void Haptics.notification({ type: NotificationType.Success }).catch(() => {})
    else vibrate([30, 60, 40])
  },
  warning() {
    if (!enabled) return
    if (isNative) void Haptics.notification({ type: NotificationType.Warning }).catch(() => {})
    else vibrate([50, 40, 50])
  },
  /** A longer, distinct pattern for "your phase ended". */
  phaseEnd() {
    if (!enabled) return
    if (isNative) void Haptics.vibrate({ duration: 400 }).catch(() => {})
    else vibrate([180, 90, 180, 90, 320])
  },
}
