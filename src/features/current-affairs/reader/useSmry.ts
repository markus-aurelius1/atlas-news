/** Today's count of articles opened at smry.ai, kept in step with other tabs, with sync, and with midnight. */
import { useCallback, useEffect, useState } from 'react'
import { SMRY_EVENT, SMRY_KEY, readSmry, recordSmry, smryCount } from '@/current-affairs/reader/elsewhere'
import { noteLocalChange } from '@/sync/signal'

const count = () => {
  try {
    return smryCount(readSmry(window.localStorage))
  } catch {
    return 0
  }
}

export function useSmry(): { count: number; opened: (articleUrl: string) => void } {
  const [today, setToday] = useState(count)
  useEffect(() => {
    const read = () => setToday(count())
    const stored = (e: StorageEvent) => { if (e.key === SMRY_KEY || e.key === null) read() }
    read()
    window.addEventListener('storage', stored)
    window.addEventListener(SMRY_EVENT, read)
    // A new local day starts the count again; looking at the app is when that matters.
    document.addEventListener('visibilitychange', read)
    const tick = setInterval(read, 60_000)
    return () => {
      window.removeEventListener('storage', stored)
      window.removeEventListener(SMRY_EVENT, read)
      document.removeEventListener('visibilitychange', read)
      clearInterval(tick)
    }
  }, [])
  const opened = useCallback((articleUrl: string) => {
    try {
      setToday(smryCount(recordSmry(window.localStorage, articleUrl)))
      noteLocalChange()
    } catch {
      // The link still opens; only the count could not be kept.
    }
  }, [])
  return { count: today, opened }
}
