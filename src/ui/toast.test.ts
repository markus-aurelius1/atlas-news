import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { currentUndoable, holdToast, releaseToast, resetToasts, toast, UNDO_WINDOW_MS, undoLast, useToasts } from './toast'

const shown = () => useToasts.getState().toasts.map((t) => t.title)

beforeEach(() => {
  vi.useFakeTimers()
  resetToasts()
})
afterEach(() => {
  resetToasts()
  vi.useRealTimers()
})

describe('toasts', () => {
  it('leave on their own; ones with an action stay longer', () => {
    toast({ title: 'Saved' })
    toast({ title: 'Saved link removed', action: { label: 'Undo', run: () => {} } })
    vi.advanceTimersByTime(4300)
    expect(shown()).toEqual(['Saved link removed'])
    vi.advanceTimersByTime(2300)
    expect(shown()).toEqual([])
  })

  it('wait while held, and leave time to act afterwards', () => {
    const id = toast({ title: 'Saved' })
    vi.advanceTimersByTime(4000)
    holdToast(id)
    vi.advanceTimersByTime(60_000)
    expect(shown()).toEqual(['Saved'])
    releaseToast(id)
    vi.advanceTimersByTime(1400)
    expect(shown()).toEqual(['Saved'])
    vi.advanceTimersByTime(200)
    expect(shown()).toEqual([])
  })

  it('dismissing clears the countdown: no timer is left behind', () => {
    const id = toast({ title: 'Saved' })
    expect(vi.getTimerCount()).toBe(1)
    useToasts.getState().dismiss(id)
    expect(vi.getTimerCount()).toBe(0)
    // Holding or releasing something already gone does nothing.
    holdToast(id)
    releaseToast(id)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('shows at most three; the oldest makes room and takes its timer with it', () => {
    for (const title of ['One', 'Two', 'Three', 'Four']) toast({ title })
    expect(shown()).toEqual(['Two', 'Three', 'Four'])
    expect(vi.getTimerCount()).toBe(3)
  })
})

describe('undo', () => {
  it('runs once, from the toast or from the palette, whichever comes first', () => {
    const run = vi.fn()
    toast({ title: 'Goal deleted', action: { label: 'Undo', run } })
    const action = useToasts.getState().toasts[0].action!
    expect(currentUndoable()?.title).toBe('Goal deleted')
    action.run()
    action.run()
    expect(run).toHaveBeenCalledTimes(1)
    expect(currentUndoable()).toBeNull()
    expect(undoLast()).toBe(false)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('can still be undone after the toast has gone, for a while', () => {
    const run = vi.fn()
    toast({ title: 'Session deleted', action: { label: 'Undo', run } })
    vi.advanceTimersByTime(10_000)
    expect(shown()).toEqual([])
    expect(undoLast()).toBe(true)
    expect(run).toHaveBeenCalledTimes(1)

    toast({ title: 'Saved link removed', action: { label: 'Undo', run } })
    vi.advanceTimersByTime(UNDO_WINDOW_MS + 1)
    expect(currentUndoable()).toBeNull()
    expect(undoLast()).toBe(false)
  })

  it('an older toast still undoes its own action after a newer one arrives', () => {
    const first = vi.fn()
    const second = vi.fn()
    toast({ title: 'First deleted', action: { label: 'Undo', run: first } })
    toast({ title: 'Second deleted', action: { label: 'Undo', run: second } })
    expect(currentUndoable()?.title).toBe('Second deleted')
    useToasts.getState().toasts[0].action!.run()
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
    // The palette still offers the newer one, and using it removes that toast.
    expect(undoLast()).toBe(true)
    expect(second).toHaveBeenCalledTimes(1)
    expect(shown()).toEqual(['First deleted'])
  })

  it('other actions (Reload, View) are not remembered as undoable', () => {
    toast({ title: 'Update ready', action: { label: 'Reload', run: () => {} } })
    expect(currentUndoable()).toBeNull()
  })
})
