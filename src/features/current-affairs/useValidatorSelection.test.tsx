// @vitest-environment happy-dom
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { evaluateProduction, validatorMode } from '@/current-affairs/validator-v3/adapter'
import { readSelection, retainSelection } from '@/current-affairs/validator-v3/history'
import { resetValidatorSelectionForTests, useValidatorSelection } from './useValidatorSelection'
import type { FeedResponse, RelevanceIndex } from '@/current-affairs/types'
vi.mock('@/current-affairs/validator-v3/adapter', () => ({ evaluateProduction: vi.fn(), validatorMode: vi.fn(() => 'v2') }))
vi.mock('@/current-affairs/validator-v3/history', () => ({ readSelection: vi.fn(), retainSelection: vi.fn() }))
const index: RelevanceIndex = { version: 2, signals: [], provenance: {} }
const feed: FeedResponse = { version: 1, fetchedAt: '2026-10-09T12:00:00.000Z', items: [], sources: [] }
const result = { output: { clock: feed.fetchedAt }, events: [], snapshot: { history: [], selected: [] } } as unknown as Awaited<ReturnType<typeof evaluateProduction>>
beforeEach(() => { resetValidatorSelectionForTests(); vi.mocked(validatorMode).mockReturnValue('v2'); vi.mocked(evaluateProduction).mockResolvedValue(result); vi.mocked(readSelection).mockResolvedValue({ history: [], selected: [] }); vi.mocked(retainSelection).mockResolvedValue() })
afterEach(() => { cleanup(); vi.clearAllMocks(); resetValidatorSelectionForTests() })
it('v2 performs no evaluation or selection storage operation', () => {
  renderHook(() => useValidatorSelection(feed, index))
  expect(evaluateProduction).not.toHaveBeenCalled(); expect(readSelection).not.toHaveBeenCalled(); expect(retainSelection).not.toHaveBeenCalled()
})
it('shadow has no additional storage reads/writes or article requests', async () => {
  vi.mocked(validatorMode).mockReturnValue('shadow')
  const hook = renderHook(() => useValidatorSelection(feed, index))
  await waitFor(() => expect(hook.result.current.result).toBe(result))
  expect(readSelection).not.toHaveBeenCalled(); expect(retainSelection).not.toHaveBeenCalled()
})
it('concurrent mounts deduplicate evaluation and writes; navigation reuses visible result', async () => {
  vi.mocked(validatorMode).mockReturnValue('v3')
  const first = renderHook(() => useValidatorSelection(feed, index)), second = renderHook(() => useValidatorSelection(feed, index))
  await waitFor(() => expect(second.result.current.result).toBe(result))
  expect(evaluateProduction).toHaveBeenCalledTimes(1); expect(retainSelection).toHaveBeenCalledTimes(1)
  first.unmount(); second.unmount()
  const third = renderHook(() => useValidatorSelection(feed, index))
  expect(third.result.current.result).toBe(result); expect(evaluateProduction).toHaveBeenCalledTimes(1)
})
it('evaluation uses the explicit feed-view clock so selected units cannot appear in its future', async () => {
  vi.mocked(validatorMode).mockReturnValue('v3')
  const clock = Date.parse(feed.fetchedAt), hook = renderHook(() => useValidatorSelection(feed, index, clock))
  await waitFor(() => expect(hook.result.current.result).toBe(result))
  expect(evaluateProduction).toHaveBeenCalledWith(feed, index, { history: [], selected: [] }, feed.fetchedAt)
})
it('background failure retains visible result and reports the failed storage gate', async () => {
  vi.mocked(validatorMode).mockReturnValue('v3')
  const hook = renderHook(({ data }) => useValidatorSelection(data, index), { initialProps: { data: feed } })
  await waitFor(() => expect(hook.result.current.result).toBe(result))
  vi.mocked(retainSelection).mockRejectedValueOnce(new Error('storage unavailable'))
  hook.rerender({ data: { ...feed, fetchedAt: '2026-10-09T14:00:00.000Z' } })
  await waitFor(() => expect(hook.result.current.error).toContain('unavailable'))
  expect(hook.result.current.result).toBe(result)
})
