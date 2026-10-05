/**
 * Dialog: a modal panel in the middle of the window, for a decision or a short
 * form. It is sized to its content (up to a cap), never fills the screen, and
 * keeps its actions in view. Opening it traps focus, makes the page behind
 * inert and joins Back; closing it returns focus to where it was.
 *
 * On a phone the same content belongs in a BottomSheet: use <Sheet>, which
 * picks between the two.
 */
import { AnimatePresence, motion } from 'motion/react'
import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { M } from '../motion'
import { useSurface } from './core'
import { Frame, type FrameProps } from './frame'

export interface DialogProps extends FrameProps {
  open: boolean
  onClose: () => void
  size?: 'sm' | 'md' | 'lg'
  /** Accessible name when the title isn't plain text (or there is none). */
  label?: string
}

const WIDTH = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' } as const

export function Dialog({ open, onClose, size = 'md', label, ...frame }: DialogProps) {
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  const container = useRef<HTMLDivElement>(null)
  const [footerEl, setFooterEl] = useState<HTMLDivElement | null>(null)
  // Only a press that starts on the backdrop closes the dialog: the trailing click of the tap that opened it must not.
  const backdropPress = useRef(false)
  useSurface({ open, onClose, id, panel, container, modal: true })

  const { title, subtitle, bare, header } = frame
  const plainTitle = typeof title === 'string' ? title : undefined
  if (typeof document === 'undefined') return null
  return createPortal(
    <AnimatePresence>
      {open && (
        <div ref={container} className="layer-modal fixed inset-0 flex items-center justify-center p-4 sm:p-6" role="presentation">
          <motion.div
            className="surface-backdrop"
            {...M.backdrop}
            onPointerDown={() => (backdropPress.current = true)}
            onClick={() => {
              if (backdropPress.current) onClose()
              backdropPress.current = false
            }}
          />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={!bare && !header && title ? `${id}-title` : undefined}
            aria-label={label ?? (bare || header ? plainTitle : undefined)}
            aria-describedby={!bare && !header && subtitle ? `${id}-subtitle` : undefined}
            tabIndex={-1}
            className={cn('elev-3 relative flex max-h-[min(88dvh,900px)] w-full min-w-0 flex-col overflow-hidden rounded-panel bg-surface outline-none', WIDTH[size])}
            {...M.dialog}
          >
            <Frame {...frame} onClose={onClose} titleId={`${id}-title`} subtitleId={`${id}-subtitle`} footerEl={footerEl} setFooterEl={setFooterEl} />
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
