/** Shared reactive settings and Atlas history; obsolete tables have no runtime subscriptions. */
import { liveQuery, type Subscription } from 'dexie'
import { useSyncExternalStore } from 'react'
import { db } from './db'
import { DEFAULT_SETTINGS } from './seed'
import type { ChallengeClaim, RecallAttempt, Settings } from './types'
const EMPTY: never[] = []
function sharedLiveQuery<T>(query: () => Promise<T>, initial: T) {
  let value = initial
  let sub: Subscription | null = null
  const listeners = new Set<() => void>()
  const subscribe = (cb: () => void) => {
    listeners.add(cb)
    if (!sub) {
      sub = liveQuery(query).subscribe({
        next: (v) => {
          value = v
          listeners.forEach((l) => l())
        },
        error: (e) => console.error('[live query]', e),
      })
    }
    return () => {
      listeners.delete(cb)
      if (!listeners.size) {
        sub?.unsubscribe()
        sub = null
      }
    }
  }
  return () => useSyncExternalStore(subscribe, () => value)
}


const useStoredSettings = sharedLiveQuery<Settings | undefined>(() => db.settings.get('settings'), undefined)
export function useSettings(): Settings {
  return useStoredSettings() ?? DEFAULT_SETTINGS
}

export async function updateSettings(patch: Partial<Omit<Settings, 'id'>>): Promise<void> {
  const cur = (await db.settings.get('settings')) ?? DEFAULT_SETTINGS
  await db.settings.put({ ...cur, ...patch, id: 'settings', updatedAt: Date.now() })
}


export const useClaims = sharedLiveQuery<ChallengeClaim[]>(() => db.claims.toArray(), EMPTY)
export const useRecalls = sharedLiveQuery<RecallAttempt[]>(() => db.recalls.orderBy('at').toArray(), EMPTY)
