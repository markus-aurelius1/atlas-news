import { useEffect, useState } from 'react'
import type { FeedResponse, RelevanceIndex } from '@/current-affairs/types'
import { evaluateProduction, validatorMode } from '@/current-affairs/validator-v3/adapter'
import { readSelection, retainSelection } from '@/current-affairs/validator-v3/history'

type Result = Awaited<ReturnType<typeof evaluateProduction>>
let memory: { feed: FeedResponse; index: RelevanceIndex; result: Result } | null = null
let pending: { feed: FeedResponse; index: RelevanceIndex; promise: Promise<Result> } | null = null
let revision = 0
export function resetValidatorSelectionForTests() { memory = null; pending = null; revision++ }
export function useValidatorSelection(feed: FeedResponse | null, index: RelevanceIndex | null, clock?: number) {
  const mode = validatorMode(), [result, setResult] = useState<Result | null>(memory?.result ?? null), [error, setError] = useState('')
  useEffect(() => {
    if (mode === 'v2' || !feed || !index) return
    let active = true
    const run = async () => {
      try {
        if (memory?.feed === feed && memory.index === index) { setResult(memory.result); return }
        if (!pending || pending.feed !== feed || pending.index !== index) {
          const token = ++revision
          const promise = (async () => {
            const snapshot = mode === 'v3' ? await readSelection() : { history: [], selected: [] }
            const next = await evaluateProduction(feed, index, snapshot, new Date(clock ?? Date.now()).toISOString())
            if (mode === 'v3') await retainSelection(next.snapshot, Date.parse(next.output.clock))
            if (revision === token) memory = { feed, index, result: next }
            return next
          })()
          pending = { feed, index, promise }
          void promise.finally(() => { if (pending?.promise === promise) pending = null }).catch(() => {})
        }
        const next = await pending.promise
        if (active) { setResult(next); setError('') }
      } catch (failure) {
        console.error('Local reading selection failed:', failure instanceof Error ? failure.message : 'unavailable')
        if (active) setError('The local reading selection is unavailable. Retained reading and personal data are preserved.')
      }
    }
    void run()
    return () => { active = false }
  }, [feed, index, mode, clock])
  return { mode, result, error }
}
