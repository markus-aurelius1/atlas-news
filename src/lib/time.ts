/** Local date keys for recall schedules; no external date library. */
export type DayKey = string
export type WeekStart = 0 | 1
const pad = (n: number) => String(n).padStart(2, '0')
export function dayKey(input: Date | number = Date.now()): DayKey {
  const d = typeof input === 'number' ? new Date(input) : input
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function parseDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function todayKey(): DayKey {
  return dayKey(new Date())
}

export function addDaysKey(key: DayKey, days: number): DayKey {
  const d = parseDayKey(key)
  d.setDate(d.getDate() + days)
  return dayKey(d)
}

/** Whole days between two keys (b - a). DST-safe because it rounds. */
export function diffDays(a: DayKey, b: DayKey): number {
  return Math.round((parseDayKey(b).getTime() - parseDayKey(a).getTime()) / 86400000)
}

export function weekdayOf(key: DayKey): number {
  return parseDayKey(key).getDay()
}

export function startOfWeekKey(key: DayKey, weekStartsOn: WeekStart): DayKey {
  const wd = weekdayOf(key)
  const offset = (wd - weekStartsOn + 7) % 7
  return addDaysKey(key, -offset)
}

/** Local midnight timestamp of a day key. */
export function dayStartMs(key: DayKey): number {
  return parseDayKey(key).getTime()
}

export function dayEndMs(key: DayKey): number {
  return dayStartMs(addDaysKey(key, 1))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Friendly relative label: Today, Tomorrow, Yesterday, Mon 14, Mar 3, Mar 3 2025 */
export function relativeDayLabel(key: DayKey, today: DayKey = todayKey()): string {
  const diff = diffDays(today, key)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  const d = parseDayKey(key)
  if (diff > 1 && diff < 7) return WEEKDAYS_LONG[d.getDay()]
  const sameYear = key.slice(0, 4) === today.slice(0, 4)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}${sameYear ? '' : ` ${d.getFullYear()}`}`
}

