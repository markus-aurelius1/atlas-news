import { useEffect, useState } from 'react'
import type { ReaderHighlight } from '@/current-affairs/reader/highlights/model'
import { highlights } from '@/current-affairs/reader/highlights/repository'

/** All personal excerpts, including articles absent from every News view. Never loads article text. */
export function useHighlightLibrary() {
  const [records, setRecords] = useState<ReaderHighlight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => highlights.observeAll((rows) => {
    setRecords(rows); setLoading(false); setError('')
  }, () => { setLoading(false); setError('Highlights could not be read from this device.') }), [])
  return { records, loading, error }
}
