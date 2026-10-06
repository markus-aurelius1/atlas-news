/**
 * Where to read an article Tars cannot show. Tars itself never works around a paywall or a publisher's
 * refusal: its own gateway asks once, plainly, and stops. What it offers instead, at the owner's direction,
 * are links out: the publisher's own page, and smry.ai, a third-party reading service the reader may choose to
 * open. Each opens in another tab; Tars fetches nothing from it and nothing of its is shown inside Tars.
 *
 * smry.ai allows a number of articles a day, so Tars counts the different articles opened there on each local
 * calendar day and shows the count beside the link. The count is information only: the link never locks.
 * It is kept in localStorage and synced (collection `reader`, one row per day), so the number is the same on
 * every device signed in to the account.
 */
export const SMRY_DAILY = 20
export const SMRY_KEY = 'tars.reader.smry.v1'
/** Sync and other tabs changed the count; open views read it again. */
export const SMRY_EVENT = 'tars:reader-smry'
/** A day's list is bounded however the link is used. */
export const SMRY_MAX_URLS = 100
const MAX_URL = 600

export const smryUrl = (articleUrl: string) => `https://smry.ai/${articleUrl}`

export interface SmryState { version: 1; days: Record<string, string[]> }
export interface SmryStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }

const DAY = /^\d{4}-\d{2}-\d{2}$/
const pad = (n: number) => String(n).padStart(2, '0')

/** The device's own calendar day: the count starts again at local midnight. */
export function localDay(now: number | Date = Date.now()): string {
  const date = new Date(now)
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
export function shiftLocalDay(day: string, by: number): string {
  const [y, m, d] = day.split('-').map(Number)
  return localDay(new Date(y, m - 1, d + by, 12))
}

export const cleanUrls = (value: unknown): string[] => [...new Set((Array.isArray(value) ? value : []).filter((url): url is string => typeof url === 'string' && /^https?:\/\//.test(url) && url.length <= MAX_URL))].sort().slice(0, SMRY_MAX_URLS)

export function parseSmry(raw: string | null): SmryState {
  const days: Record<string, string[]> = {}
  try {
    const value = raw === null ? null : (JSON.parse(raw) as Partial<SmryState> | null)
    if (value?.version === 1 && value.days && typeof value.days === 'object') for (const [day, urls] of Object.entries(value.days)) if (DAY.test(day) && cleanUrls(urls).length) days[day] = cleanUrls(urls)
  } catch {
    // An unreadable count starts again; nothing else depends on it.
  }
  return { version: 1, days }
}

/** Yesterday is kept beside today so that devices either side of midnight (or of a time zone) still agree; older days are dropped. */
export function recentDays(state: SmryState, today: string): SmryState {
  const keep = new Set([today, shiftLocalDay(today, -1), shiftLocalDay(today, 1)])
  return { version: 1, days: Object.fromEntries(Object.entries(state.days).filter(([day]) => keep.has(day))) }
}

export function readSmry(storage: SmryStorage): SmryState {
  try {
    return parseSmry(storage.getItem(SMRY_KEY))
  } catch {
    return { version: 1, days: {} }
  }
}

export const smryCount = (state: SmryState, now: number | Date = Date.now()): number => state.days[localDay(now)]?.length ?? 0

/** Note that an article was opened at smry.ai today. The same article counts once however often it is opened. */
export function recordSmry(storage: SmryStorage, articleUrl: string, now: number | Date = Date.now()): SmryState {
  const today = localDay(now), state = recentDays(readSmry(storage), today)
  const next: SmryState = { version: 1, days: { ...state.days, [today]: cleanUrls([...(state.days[today] ?? []), articleUrl]) } }
  storage.setItem(SMRY_KEY, JSON.stringify(next))
  return next
}
