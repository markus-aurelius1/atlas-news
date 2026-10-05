/**
 * BottomSheet: a panel that rises from the bottom edge, for phones.
 *
 * - **Detents.** It rests at one of a few heights: a fraction of the screen
 *   (0.4), a pixel height (160), or 'auto' (the height of its content). Drag
 *   it between them from the grip or the header, or from the content once that
 *   is scrolled to its top; let go and it settles on the nearest one, taking
 *   the speed of the release into account. Dragged below the lowest it closes.
 * - **Modal or not.** Modal (the default): a backdrop, focus kept inside, the
 *   page behind inert, Back closes it. Non-modal: no backdrop and the page
 *   behind stays live – a place card over a map that can still be panned.
 * - Content changes animate: when an 'auto' sheet grows, it rises to its new
 *   height (a transform) rather than jumping.
 *
 * The body scrolls only at the top detent; below it, a drag moves the sheet.
 */
import { animate, AnimatePresence, motion, useMotionValue } from 'motion/react'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { prefersReducedMotion } from '@/lib/motion'
import { M, SPRING, T } from '../motion'
import { useSurface } from './core'
import { Frame, type FrameProps } from './frame'

/** A resting height: a share of the viewport (0–1], pixels (> 1), or the content's own height. */
export type Detent = number | 'auto'

export interface BottomSheetProps extends FrameProps {
  open: boolean
  onClose: () => void
  /** Resting heights, any order. Default: ['auto']. */
  detents?: Detent[]
  /** Index into `detents` to open at (default: the lowest). Controlled when `onDetentChange` is given. */
  detent?: number
  onDetentChange?: (index: number) => void
  /** Non-modal: no backdrop, the page behind stays interactive. */
  modal?: boolean
  /** Dragging below the lowest detent closes it (default: modal sheets yes, non-modal no). */
  dismissible?: boolean
  size?: 'sm' | 'md' | 'lg'
  label?: string
  className?: string
  /** Called with the height the sheet currently covers (px), so what is behind can keep clear of it. */
  onHeight?: (px: number) => void
  /** Escape closes it (default true; a non-modal sheet that is part of the screen may turn it off). */
  escape?: boolean
}

const WIDTH = { sm: 'sm:max-w-md', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' } as const
const AUTO: Detent[] = ['auto']

export function BottomSheet({ open, onClose, detents: detentsProp = AUTO, detent, onDetentChange, modal = true, dismissible = modal, size = 'md', label, className, onHeight, escape = true, ...frame }: BottomSheetProps) {
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  const container = useRef<HTMLDivElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const [footerEl, setFooterEl] = useState<HTMLDivElement | null>(null)
  const backdropPress = useRef(false)
  /** The sheet's translateY: 0 = fully risen (its tallest detent), larger = lower. */
  const y = useMotionValue(0)
  const [own, setOwn] = useState(detent ?? -1)
  const [heights, setHeights] = useState<number[]>([])
  const dragging = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useSurface({ open, onClose, id, panel, container, modal, focusOnOpen: modal, history: modal, dismissOnEscape: escape })

  // Callers usually pass a fresh array each render: compare by value, so measuring isn't redone for nothing.
  const detentKey = detentsProp.join('|')
  const detents = useMemo(() => detentsProp, [detentKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const hasAuto = detents.includes('auto')
  /** Measure every detent in px. The panel is as tall as the tallest; the others are reached by translating it down. */
  const measure = useCallback(() => {
    const el = panel.current
    if (!el) return
    const vh = window.visualViewport?.height ?? window.innerHeight
    const cap = vh - 20
    const natural = hasAuto ? Math.min(cap, naturalHeight(el)) : 0
    const next = detents.map((d) => Math.round(Math.min(cap, d === 'auto' ? natural : d <= 1 ? d * vh : d)))
    setHeights((prev) => (prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next))
  }, [detents, hasAuto])

  const tallest = heights.length ? Math.max(...heights) : 0
  const lowestIndex = heights.length ? heights.indexOf(Math.min(...heights)) : 0
  const requested = onDetentChange ? detent : own
  /** The detent it rests at: the requested one, else the lowest. */
  const at = !heights.length ? 0 : requested === undefined || requested < 0 ? lowestIndex : Math.min(heights.length - 1, requested)
  const rest = heights.length ? tallest - heights[at] : 0
  const atTop = heights.length > 0 && heights[at] === tallest

  useLayoutEffect(() => {
    if (!open) return
    const el = panel.current
    measure()
    if (!el || typeof ResizeObserver === 'undefined') return
    let last = el.offsetHeight
    const ro = new ResizeObserver(() => {
      const h = el.offsetHeight
      // An 'auto' sheet that grew: hold it where it was for this frame, then let it rise to its resting place.
      // (Always animated from here: the detent heights may not change – a capped sheet – so nothing else would.)
      if (hasAuto && !dragging.current && h > last + 2 && !prefersReducedMotion()) {
        y.set(y.get() + (h - last))
        void animate(y, restRef.current, SPRING.surface)
      }
      last = h
      measure()
    })
    ro.observe(el)
    const onResize = () => measure()
    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
    }
  }, [open, measure, hasAuto, y])

  // Opening: start below the edge (before the first paint) and rise to the detent.
  useLayoutEffect(() => {
    if (open) y.jump(panel.current?.offsetHeight || window.innerHeight)
  }, [open, y])

  const tallestRef = useRef(0)
  const heightRef = useRef(0)
  const restRef = useRef(0)
  tallestRef.current = tallest
  heightRef.current = heights[at] ?? 0
  restRef.current = rest

  // Follow the current detent.
  useEffect(() => {
    if (!open || !heights.length || dragging.current) return
    const controls = animate(y, rest, prefersReducedMotion() ? { duration: 0 } : SPRING.surface)
    onHeight?.(heights[at])
    return () => controls.stop()
  }, [open, rest, heights, at, y]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) onHeight?.(0)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (i: number) => {
    if (onDetentChange) onDetentChange(i)
    else setOwn(i)
    // Same detent as before: the effect above won't run, so settle here.
    if (i === at) void animate(y, tallest - heights[i], SPRING.surface)
  }

  // ── dragging ─────────────────────────────────────────────────────────────
  const drag = useRef<{ startY: number; startAt: number; lastY: number; lastT: number; v: number } | null>(null)
  const begin = (clientY: number) => {
    dragging.current = true
    drag.current = { startY: clientY, startAt: y.get(), lastY: clientY, lastT: performance.now(), v: 0 }
  }
  const move = (clientY: number) => {
    const d = drag.current
    if (!d) return
    const now = performance.now()
    const dt = Math.max(1, now - d.lastT)
    d.v = 0.7 * ((clientY - d.lastY) / dt) + 0.3 * d.v
    d.lastY = clientY
    d.lastT = now
    let next = d.startAt + (clientY - d.startY)
    // Above the tallest detent it resists.
    if (next < 0) next = -Math.pow(-next, 0.7)
    y.set(next)
  }
  const end = () => {
    const d = drag.current
    drag.current = null
    dragging.current = false
    if (!d || !heights.length) return
    // Where it would come to rest if it kept going for a moment.
    const projected = y.get() + d.v * 180
    const lowest = Math.min(...heights)
    if (dismissible && (projected > tallest - lowest * 0.55 || (d.v > 0.9 && y.get() > tallest - lowest + 12))) {
      onCloseRef.current()
      return
    }
    let best = 0
    heights.forEach((h, i) => {
      if (Math.abs(tallest - h - projected) < Math.abs(tallest - heights[best] - projected)) best = i
    })
    if (best === at) void animate(y, tallest - heights[best], { ...SPRING.surface, velocity: d.v * 1000 })
    else goTo(best)
  }

  const onGripDown = (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if ((e.target as HTMLElement).closest('button, a, input, select, textarea, [role="tab"]')) return
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture?.(e.pointerId)
    begin(e.clientY)
    const onMove = (ev: PointerEvent) => move(ev.clientY)
    const onUp = () => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      end()
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  // From the content: a downward drag while scrolled to the top (or any drag below the top detent) moves the sheet.
  // Touch events, because a touchmove can be cancelled to stop the native scroll once the sheet has taken the gesture.
  useEffect(() => {
    const el = body.current
    if (!open || !el) return
    let start: { y: number; scroll: number } | null = null
    let taken = false
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return
      start = { y: e.touches[0].clientY, scroll: el.scrollTop }
      taken = false
    }
    const onMove = (e: TouchEvent) => {
      if (!start || e.touches.length !== 1) return
      const cy = e.touches[0].clientY
      const dy = cy - start.y
      if (!taken) {
        if (Math.abs(dy) < 6) return
        const below = heightRef.current < tallestRef.current
        // Take it when the content can't scroll in that direction, or the sheet has further to rise.
        if ((dy > 0 && start.scroll <= 0 && el.scrollTop <= 0) || below) {
          taken = true
          begin(cy)
        } else {
          start = null
          return
        }
      }
      e.preventDefault()
      move(cy)
    }
    const onEnd = () => {
      if (taken) end()
      start = null
      taken = false
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
    }
  }) // eslint-disable-line react-hooks/exhaustive-deps -- handlers read the latest refs; re-binding each render is cheap and keeps them current

  const { title, subtitle, bare, header } = frame
  const plainTitle = typeof title === 'string' ? title : undefined
  if (typeof document === 'undefined') return null
  const fixedHeight = !hasAuto && tallest ? tallest : undefined
  return createPortal(
    <AnimatePresence>
      {open && (
        <div ref={container} className={cn('layer-modal fixed inset-0 flex items-end justify-center', !modal && 'pointer-events-none')} role="presentation">
          {modal && (
            <motion.div
              className="surface-backdrop"
              {...M.backdrop}
              onPointerDown={() => (backdropPress.current = true)}
              onClick={() => {
                if (backdropPress.current) onClose()
                backdropPress.current = false
              }}
            />
          )}
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal={modal ? 'true' : undefined}
            aria-labelledby={!bare && !header && title ? `${id}-title` : undefined}
            aria-label={label ?? (bare || header ? plainTitle : undefined)}
            aria-describedby={!bare && !header && subtitle ? `${id}-subtitle` : undefined}
            tabIndex={-1}
            data-detent={at}
            className={cn('elev-3 pointer-events-auto relative flex w-full min-w-0 flex-col overflow-hidden rounded-t-panel bg-surface outline-none', 'max-h-[calc(100dvh-max(20px,env(safe-area-inset-top)))]', WIDTH[size], className)}
            style={{ y, height: fixedHeight }}
            exit={{ y: typeof window === 'undefined' ? 900 : window.innerHeight, transition: T.exit }}
          >
            <div className="sheet-grip" onPointerDown={onGripDown} aria-hidden="true">
              <span />
            </div>
            <Frame {...frame} onClose={onClose} titleId={`${id}-title`} subtitleId={`${id}-subtitle`} footerEl={footerEl} setFooterEl={setFooterEl} onHeaderPointerDown={onGripDown} bodyRef={body} scroll={atTop} closable={modal || dismissible} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** The panel's height with nothing constraining it but its content (its children's own sizes). */
function naturalHeight(el: HTMLElement): number {
  let h = 0
  for (const child of el.children) {
    const c = child as HTMLElement
    // The body is the flexible part: count its content, not the space it was given.
    h += c.hasAttribute('data-sheet-body') ? c.scrollHeight : c.offsetHeight
  }
  return h
}
