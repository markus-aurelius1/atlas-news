/**
 * The shared core of every layered surface: dialogs, sheets, side panels,
 * popovers and menus.
 *
 * It owns the things that must be decided in one place:
 *
 *   the layer stack   only the top surface answers Escape, Tab and Back
 *   focus             moved in when a surface opens (no timer), trapped inside
 *                     a modal one, and handed back to where it was on close
 *   the background    a modal surface makes everything behind it inert and
 *                     stops the page scrolling; a non-modal one leaves it alone
 *   dismissal         Escape, a press outside, and Back (browser, Android)
 *
 * A surface calls `useSurface` with its panel element; the components in this
 * folder add the look and the motion.
 */
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { lockScroll } from '../scrollLock'

interface Layer {
  id: string
  modal: boolean
  panel: () => HTMLElement | null
  /** The element to make inert when another modal layer opens above this one. */
  container: () => HTMLElement | null
  close: () => void
  /** True when opening pushed a history entry that Back should consume. */
  history: boolean
}

const stack: Layer[] = []
/** Layers registered by code outside this folder (the command palette): they only take part in "who is on top". */
const plain: string[] = []

const order = (): string[] => [...stack.map((l) => l.id), ...plain]

/** Register a modal layer that manages itself (the command palette). Returns its removal. */
export function pushLayer(id: string): () => void {
  plain.push(id)
  syncInert()
  return () => {
    const i = plain.lastIndexOf(id)
    if (i >= 0) plain.splice(i, 1)
    syncInert()
  }
}
export const isTopLayer = (id: string) => {
  const all = order()
  return all[all.length - 1] === id
}
export const anyLayerOpen = () => stack.length + plain.length > 0
/** Is a modal surface open (the page behind it is inert)? */
export const anyModalOpen = () => stack.some((l) => l.modal) || plain.length > 0

/** Close the top surface, if there is one. Used by the Android back button. Returns whether something closed. */
export function closeTopSurface(): boolean {
  const top = stack[stack.length - 1]
  if (!top) return false
  top.close()
  return true
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]'

export function focusables(panel: HTMLElement): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement)
}

/** Keep Tab inside `panel`. */
export function trapTab(e: KeyboardEvent, panel: HTMLElement | null) {
  if (!panel) return
  const items = focusables(panel)
  if (!items.length) {
    e.preventDefault()
    panel.focus()
    return
  }
  const first = items[0]
  const last = items[items.length - 1]
  const active = document.activeElement as HTMLElement | null
  if (!panel.contains(active)) {
    e.preventDefault()
    first.focus()
  } else if (e.shiftKey && (active === first || active === panel)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

/**
 * Everything behind the top modal surface is inert: the app itself, and any
 * modal surface below the top one. Surfaces above the top modal (a popover
 * opened from a dialog) are left alone.
 */
function syncInert() {
  if (typeof document === 'undefined') return
  const root = document.getElementById('root')
  let topModal = -1
  stack.forEach((l, i) => {
    if (l.modal) topModal = i
  })
  const covered = topModal >= 0 || plain.length > 0
  if (root) root.inert = covered
  stack.forEach((l, i) => {
    const el = l.container()
    if (el) el.inert = plain.length > 0 || i < topModal
  })
}

// ── Back closes the top surface ──────────────────────────────────────────────
// Opening a modal surface adds a history entry (same URL). Back – the browser's,
// a swipe, the Android button – pops that entry and the surface closes; the
// route underneath is untouched. Closing it any other way removes the entry.
let ignorePop = 0
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (ignorePop > 0) {
      ignorePop--
      return
    }
    // Close every history-backed surface whose entry is no longer the current one or below it.
    const state = (history.state as { tarsSurface?: string[] } | null)?.tarsSurface ?? []
    for (let i = stack.length - 1; i >= 0; i--) {
      const l = stack[i]
      if (l.history && !state.includes(l.id)) {
        l.history = false
        l.close()
      }
    }
  })
}

function pushHistory(id: string) {
  const prior = (history.state as { tarsSurface?: string[] } | null)?.tarsSurface ?? []
  try {
    history.pushState({ ...(history.state as object | null), tarsSurface: [...prior, id] }, '')
    return true
  } catch {
    return false
  }
}

function popHistory(id: string) {
  const state = (history.state as { tarsSurface?: string[] } | null)?.tarsSurface
  // Only step back if the entry on top is still the one this surface pushed (a link inside it may have navigated on).
  if (state && state[state.length - 1] === id) {
    ignorePop++
    history.back()
  }
}

export interface SurfaceOptions {
  open: boolean
  onClose: () => void
  id: string
  panel: RefObject<HTMLElement | null>
  /** The element that holds the panel and its backdrop (made inert when covered). Defaults to the panel. */
  container?: RefObject<HTMLElement | null>
  /** Modal: traps focus, makes the background inert, locks page scroll, and joins Back. */
  modal?: boolean
  /** Close when a press lands outside the panel (and outside `anchor`). For popovers and menus. */
  dismissOnOutsidePress?: boolean
  /** The trigger of an anchored surface: presses on it don't count as outside. */
  anchor?: RefObject<HTMLElement | null>
  /** Move focus into the surface when it opens (default: modal surfaces and menus do, tooltips and non-modal panels don't). */
  focusOnOpen?: boolean
  /** Give focus back to where it was when the surface closes (default true). */
  restoreFocus?: boolean
  /** Join browser/Android Back (default: modal surfaces do). */
  history?: boolean
  /** Handle Escape (default true). */
  dismissOnEscape?: boolean
}

export function useSurface(opts: SurfaceOptions) {
  const { open, id, panel, modal = false } = opts
  const o = useRef(opts)
  o.current = opts
  /** What had focus before the surface opened. */
  const returnTo = useRef<HTMLElement | null>(null)

  // Before paint: register, so "top layer" is right for anything that renders in the same commit.
  useLayoutEffect(() => {
    if (!open) return
    const cur = o.current
    // Before anything is made inert: an inert ancestor blurs whatever had focus.
    returnTo.current = document.activeElement as HTMLElement | null
    const withHistory = (cur.history ?? modal) && typeof history !== 'undefined'
    const layer: Layer = {
      id,
      modal,
      panel: () => panel.current,
      container: () => (o.current.container ?? panel).current,
      close: () => o.current.onClose(),
      history: false,
    }
    stack.push(layer)
    if (withHistory) layer.history = pushHistory(id)
    const unlock = modal ? lockScroll() : undefined
    syncInert()

    if (cur.focusOnOpen ?? modal) {
      const el = panel.current
      const target = el?.querySelector<HTMLElement>('[data-autofocus]') ?? el
      target?.focus({ preventScroll: true })
    }

    const onKey = (e: KeyboardEvent) => {
      if (!isTopLayer(id)) return
      if (e.key === 'Escape' && (o.current.dismissOnEscape ?? true)) {
        e.stopPropagation()
        e.preventDefault()
        o.current.onClose()
      } else if (e.key === 'Tab' && modal) trapTab(e, panel.current)
    }
    const onDown = (e: PointerEvent) => {
      if (!o.current.dismissOnOutsidePress) return
      const t = e.target as Node
      if (panel.current?.contains(t) || o.current.anchor?.current?.contains(t)) return
      // A press inside a surface stacked above this one is not "outside".
      const above = stack.slice(stack.indexOf(layer) + 1)
      if (above.some((l) => l.panel()?.contains(t))) return
      o.current.onClose()
    }
    // Capture phase, so nothing underneath sees an Escape this surface handled.
    window.addEventListener('keydown', onKey, true)
    document.addEventListener('pointerdown', onDown, true)

    return () => {
      window.removeEventListener('keydown', onKey, true)
      document.removeEventListener('pointerdown', onDown, true)
      const i = stack.indexOf(layer)
      if (i >= 0) stack.splice(i, 1)
      unlock?.()
      syncInert()
      if (layer.history) {
        layer.history = false
        popHistory(id)
      }
    }
  }, [open, id, modal, panel])

  // Focus goes back where it was. This is a passive effect on purpose: React puts focus back on whatever
  // had it before a commit's DOM changes, so a focus() made during them (a layout cleanup) would be undone.
  useEffect(() => {
    if (!open) return
    return () => {
      const previous = returnTo.current
      returnTo.current = null
      if (!(o.current.restoreFocus ?? true) || !previous?.isConnected) return
      const active = document.activeElement
      if (!active || active === document.body || panel.current?.contains(active)) previous.focus?.({ preventScroll: true })
    }
  }, [open, panel])
}

/** The latest value of a callback, for effects that must not re-run when it changes. */
export function useLatest<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  })
  return ref
}
