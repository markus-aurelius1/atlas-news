/** Personal actions acknowledge only successful local writes; cross-tab storage events refresh the view. */
import { useCallback, useEffect, useState } from 'react'
import { CA_STATE_KEY, readPersonalState, writePersonalPatch, type PersonalEntry, type PersonalState } from '@/current-affairs/personal-state'
import type { NewsEvent } from '@/current-affairs/types'
import { noteLocalChange, PERSONAL_STATE_EVENT } from '@/sync/signal'
import { retainArticles } from '@/current-affairs/archive'
export function usePersonalState() {
  const [state, setState] = useState<PersonalState>({ version: 1, entries: {} }), [stateError, setError] = useState('')
  useEffect(() => {
    const load = () => {
      try { setState(readPersonalState(window.localStorage)); setError('') }
      catch { setError('Current Affairs state couldn’t be loaded. Stored data has been preserved; local saving is unavailable.') }
    }
    load()
    const change = (e: StorageEvent) => { if (e.key === CA_STATE_KEY || e.key === null) load() }
    window.addEventListener('storage', change)
    // Sync wrote marks made on another device.
    window.addEventListener(PERSONAL_STATE_EVENT, load)
    return () => { window.removeEventListener('storage', change); window.removeEventListener(PERSONAL_STATE_EVENT, load) }
  }, [])
  const patch = useCallback((event: NewsEvent, value: PersonalEntry) => {
    try {
      setState(writePersonalPatch(window.localStorage, event, value)); setError(''); noteLocalChange()
      // V3 intentionally does not bulk-retain accepted feed rows in the legacy
      // archive. An explicit personal Save still needs body-free metadata for
      // the existing article sync adapter and backup, including alternatives.
      if (value.savedAt) void retainArticles(event.members, value.savedAt).then(() => noteLocalChange()).catch(() => setError('Saved mark is preserved, but article metadata could not be retained for backup and sync.'))
      return true
    }
    catch { setError('Couldn’t save on this device. Your last saved state is preserved.'); return false }
  }, [])
  return { state, stateError, patch }
}
