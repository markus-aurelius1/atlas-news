/**
 * Toasts: brief confirmations, most of them with a way back.
 *
 * A toast leaves on its own after a few seconds. The countdown stops while the
 * pointer or keyboard focus is on it (`hold` / `release`) and is cleared when
 * the toast is dismissed, so no timer outlives its toast.
 *
 * The last action that offered Undo is remembered for a while after its toast
 * has gone (`useUndoable`, `undoLast`), so the command palette can still take
 * it back.
 */
import { create } from 'zustand'
import { uid } from '@/lib/id'

export type ToastTone = 'default' | 'success' | 'warning' | 'celebrate'

export interface Toast {
  id: string
  title: string
  body?: string
  tone: ToastTone
  duration: number
  action?: { label: string; run: () => void }
}

/** The most recent action that can still be undone. */
export interface Undoable {
  title: string
  run: () => void
  at: number
}

interface ToastStore {
  toasts: Toast[]
  undoable: Undoable | null
  push: (t: Omit<Toast, 'id' | 'tone' | 'duration'> & Partial<Pick<Toast, 'tone' | 'duration'>>) => string
  dismiss: (id: string) => void
}

/** How long after the toast an action can still be undone from the palette. */
export const UNDO_WINDOW_MS = 120_000

interface Countdown {
  timer: ReturnType<typeof setTimeout> | undefined
  /** Milliseconds left when the countdown was last started or stopped. */
  left: number
  since: number
}
const countdowns = new Map<string, Countdown>()

const start = (id: string) => {
  const c = countdowns.get(id)
  if (!c || c.timer !== undefined || c.left <= 0) return
  c.since = Date.now()
  c.timer = setTimeout(() => useToasts.getState().dismiss(id), c.left)
}

/** Stop a toast's countdown while it is being read or reached for. */
export function holdToast(id: string) {
  const c = countdowns.get(id)
  if (!c || c.timer === undefined) return
  clearTimeout(c.timer)
  c.timer = undefined
  // Always leave time to act after the pointer moves away again.
  c.left = Math.max(1500, c.left - (Date.now() - c.since))
}

export function releaseToast(id: string) {
  start(id)
}

export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  undoable: null,
  push: (t) => {
    const id = uid()
    // Toasts that offer an action (Undo, Reload…) stay a little longer.
    const item: Toast = { tone: 'default', duration: t.action ? 6500 : 4200, ...t, id }
    const run = item.action?.run
    // An Undo can be used once, from the toast or from the palette, whichever comes first.
    let used = false
    const undoable: Undoable | null =
      item.action?.label === 'Undo' && run
        ? {
            title: item.title,
            at: Date.now(),
            run: () => {
              if (used) return
              used = true
              if (get().undoable === undoable) set({ undoable: null })
              run()
            },
          }
        : null
    if (undoable) item.action = { label: 'Undo', run: undoable.run }
    // At most three at once; the oldest makes room, and its countdown goes with it.
    for (const old of get().toasts.slice(0, -2)) get().dismiss(old.id)
    set((s) => ({ toasts: [...s.toasts, item], undoable: undoable ?? s.undoable }))
    if (item.duration > 0) {
      countdowns.set(id, { timer: undefined, left: item.duration, since: 0 })
      start(id)
    }
    return id
  },
  dismiss: (id) => {
    const c = countdowns.get(id)
    if (c) {
      clearTimeout(c.timer)
      countdowns.delete(id)
    }
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

export const toast = (t: Parameters<ToastStore['push']>[0]) => useToasts.getState().push(t)

/** The action that can still be undone, or null (none, used, or too long ago). */
export function currentUndoable(now = Date.now()): Undoable | null {
  const u = useToasts.getState().undoable
  return u && now - u.at <= UNDO_WINDOW_MS ? u : null
}

/** Undo the last undoable action. Returns whether there was one. */
export function undoLast(): boolean {
  const u = currentUndoable()
  if (!u) return false
  u.run()
  // Its toast, if still showing, has nothing left to offer.
  for (const t of useToasts.getState().toasts) if (t.action?.run === u.run) useToasts.getState().dismiss(t.id)
  return true
}

/** For tests. */
export function resetToasts() {
  for (const t of useToasts.getState().toasts) useToasts.getState().dismiss(t.id)
  useToasts.setState({ undoable: null })
}
