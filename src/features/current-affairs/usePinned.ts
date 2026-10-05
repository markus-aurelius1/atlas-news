/** Saved articles pinned by sync, re-read whenever the pinned set changes. */
import { useEffect, useState } from 'react'
import type { ArchivedArticle } from '@/current-affairs/archive'
import { readPinnedArticles } from '@/sync/pinned'
import { PINNED_EVENT } from '@/sync/signal'
const NONE: ArchivedArticle[] = []
export function usePinned(): ArchivedArticle[] {
  const [pinned, setPinned] = useState<ArchivedArticle[]>(NONE)
  useEffect(() => {
    let active = true
    // Without the pins the list is simply what the feed and the archive give.
    const load = () => void readPinnedArticles().then((rows) => { if (active) setPinned(rows.length ? rows : NONE) }).catch(() => {})
    load()
    window.addEventListener(PINNED_EVENT, load)
    return () => { active = false; window.removeEventListener(PINNED_EVENT, load) }
  }, [])
  return pinned
}
