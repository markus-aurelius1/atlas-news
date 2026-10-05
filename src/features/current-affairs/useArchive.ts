/** Retains accepted RSS metadata on visits/refreshes and shares archive additions across tabs. */
import { useEffect, useState } from 'react'
import { readArchive, retainArticles, type ArchivedArticle } from '@/current-affairs/archive'
import type { ClassifiedItem } from '@/current-affairs/types'
const channelName = 'tars.current-affairs.archive.v1'
export function useArchive(items: ClassifiedItem[], fetchedAt?: string) {
  const [archived, setArchived] = useState<ArchivedArticle[]>([]), [archiveError, setArchiveError] = useState('')
  useEffect(() => {
    let active = true
    const load = async () => {
      try { const rows = await readArchive(); if (active) { setArchived(rows); setArchiveError('') } }
      catch { if (active) setArchiveError('The local archive is unavailable. Current feeds are still shown.') }
    }
    const channel = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel(channelName)
    if (channel) channel.onmessage = () => void load()
    void load()
    return () => { active = false; channel?.close() }
  }, [])
  useEffect(() => {
    if (!fetchedAt || !items.length) return
    let active = true
    void (async () => {
      try {
        await retainArticles(items.filter(i => i.relevance.accepted), Date.parse(fetchedAt))
        const rows = await readArchive()
        if (active) { setArchived(rows); setArchiveError('') }
        if (typeof BroadcastChannel !== 'undefined') { const channel = new BroadcastChannel(channelName); channel.postMessage('updated'); channel.close() }
      } catch { if (active) setArchiveError('Couldn’t retain this refresh in the local archive. Older archived articles are preserved.') }
    })()
    return () => { active = false }
  }, [items, fetchedAt])
  return { archived, archiveError }
}
