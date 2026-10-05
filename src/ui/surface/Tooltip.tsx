/**
 * Tooltip: the name of a control, shown beside it.
 *
 * - Appears after 400 ms of hover; at once when the pointer moves on from a
 *   neighbour whose tooltip was just showing, so scanning a toolbar reads
 *   fluently.
 * - Appears on keyboard focus, never on touch (a finger covers what it would
 *   explain, and the long-press belongs to the platform).
 * - It is not the accessible name: the control carries its own `aria-label`.
 *   The tooltip is decoration for sighted pointer and keyboard users.
 *
 * It wraps exactly one element and adds no element of its own around it.
 */
import { AnimatePresence, motion } from 'motion/react'
import { cloneElement, isValidElement, useEffect, useRef, useState, type FocusEvent, type PointerEvent, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { T } from '../motion'
import { place, type Side } from './position'

const DELAY = 400
/** For this long after a tooltip hides, the next one shows without the delay. */
const WARM = 450
let lastHidden = 0

interface TriggerProps {
  onPointerEnter?: (e: PointerEvent<HTMLElement>) => void
  onPointerLeave?: (e: PointerEvent<HTMLElement>) => void
  onPointerDown?: (e: PointerEvent<HTMLElement>) => void
  onFocus?: (e: FocusEvent<HTMLElement>) => void
  onBlur?: (e: FocusEvent<HTMLElement>) => void
}

export function Tooltip({ label, shortcut, side = 'bottom', children, disabled }: { label: ReactNode; shortcut?: string; side?: Side; children: ReactElement<TriggerProps>; disabled?: boolean }) {
  const [at, setAt] = useState<{ left: number; top: number; side: Side } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const anchor = useRef<HTMLElement | null>(null)
  const tip = useRef<HTMLDivElement>(null)

  const show = (el: HTMLElement) => {
    anchor.current = el
    const r = el.getBoundingClientRect()
    // First guess from a typical size; corrected once the tooltip has measured itself.
    setAt(place(r, { width: 80, height: 28 }, { width: innerWidth, height: innerHeight }, { side, align: 'center' }))
  }
  const hide = () => {
    clearTimeout(timer.current)
    setAt((cur) => {
      if (cur) lastHidden = Date.now()
      return null
    })
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  // Measure, then sit exactly centred on the anchor.
  useEffect(() => {
    if (!at || !anchor.current || !tip.current) return
    const next = place(anchor.current.getBoundingClientRect(), { width: tip.current.offsetWidth, height: tip.current.offsetHeight }, { width: innerWidth, height: innerHeight }, { side, align: 'center' })
    if (Math.abs(next.left - at.left) > 0.5 || Math.abs(next.top - at.top) > 0.5 || next.side !== at.side) setAt(next)
  }, [at, side])
  // Anything that moves the page under the tooltip hides it.
  useEffect(() => {
    if (!at) return
    window.addEventListener('scroll', hide, true)
    window.addEventListener('keydown', hide, true)
    return () => {
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('keydown', hide, true)
    }
  }, [at])

  if (!isValidElement(children) || disabled) return children
  const own = children.props
  const trigger = cloneElement(children, {
    onPointerEnter: (e: PointerEvent<HTMLElement>) => {
      own.onPointerEnter?.(e)
      if (e.pointerType === 'touch') return
      const el = e.currentTarget
      clearTimeout(timer.current)
      if (Date.now() - lastHidden < WARM) show(el)
      else timer.current = setTimeout(() => show(el), DELAY)
    },
    onPointerLeave: (e: PointerEvent<HTMLElement>) => {
      own.onPointerLeave?.(e)
      hide()
    },
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      own.onPointerDown?.(e)
      hide()
    },
    onFocus: (e: FocusEvent<HTMLElement>) => {
      own.onFocus?.(e)
      // Keyboard focus only: a click also focuses, and must not leave a tooltip behind.
      if (e.currentTarget.matches(':focus-visible')) show(e.currentTarget)
    },
    onBlur: (e: FocusEvent<HTMLElement>) => {
      own.onBlur?.(e)
      hide()
    },
  })

  return (
    <>
      {trigger}
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {at && (
              <motion.div
                ref={tip}
                role="tooltip"
                className="tooltip layer-tooltip fixed"
                style={{ left: at.left, top: at.top }}
                initial={{ opacity: 0, y: at.side === 'top' ? 2 : at.side === 'bottom' ? -2 : 0, x: at.side === 'left' ? 2 : at.side === 'right' ? -2 : 0 }}
                animate={{ opacity: 1, x: 0, y: 0, transition: T.fast }}
                exit={{ opacity: 0, transition: T.instant }}
              >
                {label}
                {shortcut && <kbd>{shortcut}</kbd>}
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
}
