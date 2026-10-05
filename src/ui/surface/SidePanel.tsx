/**
 * SidePanel: an object opened beside the list it came from.
 *
 * On wide layouts it enters from the trailing edge of the stage and stays
 * there, non-modal: the content beside it remains visible and interactive, and
 * choosing another row swaps the panel's content. Its width can be dragged and
 * is remembered. Escape closes it.
 *
 * On compact layouts there is no "beside": the same content is a bottom sheet.
 *
 * The stage reserves room for an open panel through `--side-panel-w` on <html>
 * (index.css pads the stage's scroller with it), so nothing is hidden under it.
 */
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { SPRING, T } from '../motion'
import { useMediaQuery } from '../useMedia'
import { BottomSheet } from './BottomSheet'
import { useSurface } from './core'
import { Frame, type FrameProps } from './frame'

export interface SidePanelProps extends FrameProps {
  open: boolean
  onClose: () => void
  /** Accessible name when the title isn't plain text. */
  label?: string
  /** Remembers the dragged width under this name. */
  name?: string
  /** Default, minimum and maximum width in px. */
  width?: number
  minWidth?: number
  maxWidth?: number
  /** From this viewport width the panel sits beside the content; below it, it is a bottom sheet. */
  from?: number
  /** The bottom sheet's size on compact layouts. */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const KEY = 'tars.panel.'
const readWidth = (name: string | undefined, fallback: number) => {
  if (!name) return fallback
  try {
    const v = Number(localStorage.getItem(KEY + name))
    return Number.isFinite(v) && v > 0 ? v : fallback
  } catch {
    return fallback
  }
}

export function SidePanel({ open, onClose, label, name, width = 420, minWidth = 340, maxWidth = 620, from = 1024, size = 'md', className, ...frame }: SidePanelProps) {
  const beside = useMediaQuery(`(min-width: ${from}px)`)
  if (!beside)
    return (
      <BottomSheet open={open} onClose={onClose} label={label} size={size} {...frame}>
        {frame.children}
      </BottomSheet>
    )
  return <Beside open={open} onClose={onClose} label={label} name={name} width={width} minWidth={minWidth} maxWidth={maxWidth} className={className} {...frame} />
}

function Beside({ open, onClose, label, name, width = 420, minWidth = 340, maxWidth = 620, className, ...frame }: SidePanelProps) {
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  const [footerEl, setFooterEl] = useState<HTMLDivElement | null>(null)
  const [w, setW] = useState(() => readWidth(name, width))
  const [host, setHost] = useState<HTMLElement | null>(null)
  useSurface({ open, onClose, id, panel, modal: false, focusOnOpen: false, history: false })

  // The panel lives inside the stage, so it is clipped by the stage's rounded corners and scrolls with nothing.
  useEffect(() => setHost(document.querySelector<HTMLElement>('.stage')), [])
  // Reserve its width in the stage while it is open.
  useEffect(() => {
    if (!open) return
    const root = document.documentElement
    root.style.setProperty('--side-panel-w', `${w}px`)
    root.dataset.panel = 'open'
    return () => {
      root.style.removeProperty('--side-panel-w')
      delete root.dataset.panel
    }
  }, [open, w])

  const resize = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    const startX = e.clientX
    const startW = w
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    const limit = Math.min(maxWidth, window.innerWidth * 0.6)
    let latest = startW
    const onMove = (ev: PointerEvent) => {
      latest = Math.round(Math.max(minWidth, Math.min(limit, startW + (startX - ev.clientX))))
      setW(latest)
    }
    const onUp = () => {
      target.removeEventListener('pointermove', onMove)
      target.removeEventListener('pointerup', onUp)
      target.removeEventListener('pointercancel', onUp)
      if (name) {
        try {
          localStorage.setItem(KEY + name, String(latest))
        } catch {
          /* storage unavailable */
        }
      }
    }
    target.addEventListener('pointermove', onMove)
    target.addEventListener('pointerup', onUp)
    target.addEventListener('pointercancel', onUp)
  }

  const { title, bare, header } = frame
  const plainTitle = typeof title === 'string' ? title : undefined
  if (!host) return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.aside
          ref={panel}
          role="complementary"
          aria-labelledby={!bare && !header && title ? `${id}-title` : undefined}
          aria-label={label ?? (bare || header ? plainTitle : undefined)}
          tabIndex={-1}
          data-side-panel
          className={cn('layer-floating elev-2 absolute inset-y-0 right-0 flex min-w-0 flex-col overflow-hidden rounded-l-panel bg-surface outline-none', className)}
          style={{ width: w }}
          initial={{ x: '100%', opacity: 0.6 }}
          animate={{ x: 0, opacity: 1, transition: SPRING.surface }}
          exit={{ x: '100%', opacity: 0.6, transition: T.exit }}
        >
          {/* Drag the leading edge to resize; the arrow keys do the same. */}
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize panel"
            aria-valuenow={w}
            aria-valuemin={minWidth}
            aria-valuemax={maxWidth}
            tabIndex={0}
            className="absolute inset-y-0 left-0 z-10 w-2 cursor-col-resize touch-none outline-none after:absolute after:inset-y-3 after:left-0.5 after:w-px after:bg-transparent after:transition-colors hover:after:bg-line-strong focus-visible:after:bg-accent"
            onPointerDown={resize}
            onKeyDown={(e) => {
              const step = e.key === 'ArrowLeft' ? 24 : e.key === 'ArrowRight' ? -24 : 0
              if (!step) return
              e.preventDefault()
              setW((cur) => Math.max(minWidth, Math.min(maxWidth, cur + step)))
            }}
          />
          <Frame {...frame} onClose={onClose} titleId={`${id}-title`} subtitleId={`${id}-subtitle`} footerEl={footerEl} setFooterEl={setFooterEl} />
        </motion.aside>
      )}
    </AnimatePresence>,
    host,
  )
}
