/** Device capability hints, used to keep effects light where they would cost frames or battery. */

import { prefersReducedMotion } from './motion'

let lowPower: boolean | undefined

/**
 * A conservative guess at a low-end device: little memory, few cores, or the
 * user asked for less motion or data. Decorative effects are reduced there;
 * nothing functional depends on it.
 */
export function lowPowerDevice(): boolean {
  if (lowPower !== undefined) return lowPower
  if (typeof navigator === 'undefined') return (lowPower = false)
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  lowPower =
    (nav.deviceMemory !== undefined && nav.deviceMemory <= 3) ||
    (nav.hardwareConcurrency !== undefined && nav.hardwareConcurrency <= 3) ||
    nav.connection?.saveData === true ||
    prefersReducedMotion()
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('low-power', lowPower)
  return lowPower
}
