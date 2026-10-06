/** How the reader sets its text: kept on this device (it is a reading habit, not study data), shared across tabs. */
import { useSyncExternalStore } from 'react'
import { KEYS } from '@/lib/storage'

export type ReaderFace = 'serif' | 'sans'
export type ReaderWidth = 'narrow' | 'standard' | 'wide'
export type ReaderLeading = 'compact' | 'standard' | 'relaxed'
export interface ReaderPrefs {
  /** Index into READER_SCALE. */
  size: number
  face: ReaderFace
  width: ReaderWidth
  leading: ReaderLeading
}

/** Text sizes, as a multiple of the reader's base size. Each step is about 9% larger than the last. */
export const READER_SCALE = [0.84, 0.92, 1, 1.09, 1.19, 1.3, 1.42] as const
export const DEFAULT_READER_PREFS: ReaderPrefs = { size: 2, face: 'serif', width: 'standard', leading: 'standard' }

const one = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T => (allowed.includes(value as T) ? (value as T) : fallback)

export function parseReaderPrefs(raw: string | null): ReaderPrefs {
  if (!raw) return DEFAULT_READER_PREFS
  try {
    const value = JSON.parse(raw) as Partial<ReaderPrefs> | null
    if (!value || typeof value !== 'object') return DEFAULT_READER_PREFS
    const size = Number.isInteger(value.size) && value.size! >= 0 && value.size! < READER_SCALE.length ? value.size! : DEFAULT_READER_PREFS.size
    return { size, face: one(value.face, ['serif', 'sans'], 'serif'), width: one(value.width, ['narrow', 'standard', 'wide'], 'standard'), leading: one(value.leading, ['compact', 'standard', 'relaxed'], 'standard') }
  } catch {
    return DEFAULT_READER_PREFS
  }
}

let current: ReaderPrefs | null = null
const listeners = new Set<() => void>()

function read(): ReaderPrefs {
  if (current) return current
  try {
    current = parseReaderPrefs(localStorage.getItem(KEYS.reader))
  } catch {
    current = DEFAULT_READER_PREFS
  }
  return current
}

export function setReaderPrefs(patch: Partial<ReaderPrefs>) {
  current = parseReaderPrefs(JSON.stringify({ ...read(), ...patch }))
  try {
    localStorage.setItem(KEYS.reader, JSON.stringify(current))
  } catch {
    /* storage unavailable: the choice lasts for this page only */
  }
  listeners.forEach((l) => l())
}

let watching = false
const subscribe = (cb: () => void) => {
  if (!watching && typeof window !== 'undefined') {
    watching = true
    // Another tab changed how the reader is set.
    window.addEventListener('storage', (e) => {
      if (e.key !== KEYS.reader && e.key !== null) return
      current = null
      listeners.forEach((l) => l())
    })
  }
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export function useReaderPrefs(): ReaderPrefs {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_READER_PREFS)
}

/** For tests. */
export function resetReaderPrefs() {
  current = null
}
