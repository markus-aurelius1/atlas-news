/**
 * Popover: a panel anchored to a trigger. It is rendered in a portal (nothing
 * can clip it), placed beside its anchor with flipping and shifting, closes on
 * Escape or a press outside, and gives focus back to the trigger.
 *
 * On compact widths a popover with `sheet` becomes a bottom sheet instead: the
 * same content where a thumb can reach it.
 */
import { AnimatePresence, motion } from 'motion/react'
import { useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { T } from '../motion'
import { useIsWide } from '../useMedia'
import { BottomSheet } from './BottomSheet'
import { useSurface } from './core'
import { place, type Align, type Side } from './position'

export interface PopoverProps {
  open: boolean
  onClose: () => void
  anchor: RefObject<HTMLElement | null>
  children: ReactNode
  /** The accessible name. */
  label?: string
  side?: Side
  align?: Align
  /** At least this wide (and at least as wide as the anchor). */
  minWidth?: number
  /** Exactly this wide. */
  width?: number
  className?: string
  /** `dialog` (default) for a panel of controls, `menu` or `listbox` when the content is one. */
  role?: 'dialog' | 'menu' | 'listbox'
  /** Move focus into the popover when it opens (default true). */
  focusOnOpen?: boolean
  /** On compact widths, show the content as a bottom sheet with this title. */
  sheet?: { title?: ReactNode }
  /** Ref to the panel (menus use it for their own key handling). */
  panelRef?: RefObject<HTMLDivElement | null>
}

export function Popover(props: PopoverProps) {
  const wide = useIsWide()
  if (props.sheet && !wide)
    return (
      <BottomSheet open={props.open} onClose={props.onClose} title={props.sheet.title} label={props.label} detents={['auto']}>
        {props.children}
      </BottomSheet>
    )
  return <Anchored {...props} />
}

function Anchored({ open, onClose, anchor, children, label, side = 'bottom', align = 'start', minWidth = 220, width, className, role = 'dialog', focusOnOpen = true, panelRef }: PopoverProps) {
  const id = useId()
  const own = useRef<HTMLDivElement>(null)
  const panel = panelRef ?? own
  const [at, setAt] = useState<(CSSProperties & { side: Side }) | null>(null)

  useLayoutEffect(() => {
    if (!open) {
      setAt(null)
      return
    }
    const measure = () => {
      const a = anchor.current?.getBoundingClientRect()
      if (!a) return
      const vw = window.innerWidth
      const vh = window.innerHeight
      const w = Math.min(vw - 16, width ?? Math.max(minWidth, side === 'top' || side === 'bottom' ? a.width : 0))
      const natural = panel.current?.scrollHeight ?? 240
      const p = place(a, { width: w, height: Math.min(natural, 420) }, { width: vw, height: vh }, { side, align })
      const vertical = p.side === 'top' || p.side === 'bottom'
      const maxHeight = vertical ? Math.max(140, Math.min(480, p.available)) : Math.min(480, vh - 16)
      setAt({ left: p.left, top: vertical && p.side === 'top' ? undefined : p.top, bottom: vertical && p.side === 'top' ? vh - a.top + 6 : undefined, width: w, maxHeight, side: p.side })
    }
    measure()
    // Once more with the real height, now that the content has rendered.
    const frame = requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, anchor, minWidth, width, side, align, panel])

  const shown = open && !!at
  useSurface({ open: shown, onClose, id, panel, anchor, dismissOnOutsidePress: true, focusOnOpen, history: false })

  if (typeof document === 'undefined') return null
  const origin = at ? (at.side === 'top' ? 'bottom' : at.side === 'bottom' ? 'top' : at.side === 'left' ? 'right' : 'left') : 'top'
  return createPortal(
    <AnimatePresence>
      {open && at && (
        <motion.div
          ref={panel}
          role={role}
          aria-label={label}
          tabIndex={-1}
          initial={{ opacity: 0, y: at.side === 'top' ? 4 : at.side === 'bottom' ? -4 : 0, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1, transition: T.base }}
          exit={{ opacity: 0, transition: T.exit }}
          className={cn(// The panel scrolls as a whole; its children keep their own height rather than being squeezed.
            'scrollbar-thin layer-popover elev-2 fixed flex flex-col overflow-x-hidden overflow-y-auto overscroll-contain rounded-card bg-surface outline-none *:shrink-0', className)}
          style={{ left: at.left, top: at.top, bottom: at.bottom, width: at.width, maxHeight: at.maxHeight, transformOrigin: `${origin} ${align === 'end' ? 'right' : 'left'}` }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
