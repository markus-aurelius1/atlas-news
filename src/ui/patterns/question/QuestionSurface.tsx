/** Focused review beside the map; mobile uses the existing full-height sheet and focus lifecycle. */
import { AnimatePresence, motion } from 'motion/react'
import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useMediaQuery } from '@/ui/useMedia'
import { BottomSheet } from '@/ui/surface/BottomSheet'
import { useSurface } from '@/ui/surface/core'
import { Frame, type FrameProps } from '@/ui/surface/frame'
import { T } from '@/ui/motion'

interface QuestionSurfaceProps extends FrameProps { open: boolean; onClose: () => void; label: string }

export function QuestionSurface(props: QuestionSurfaceProps) {
  const desktop = useMediaQuery('(min-width: 900px)')
  return desktop ? <DesktopQuestion {...props} /> : <BottomSheet {...props} detents={[1]} size="lg" className="question-mobile" />
}

function DesktopQuestion({ open, onClose, label, ...frame }: QuestionSurfaceProps) {
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  const [footerEl, setFooterEl] = useState<HTMLDivElement | null>(null)
  useSurface({ open, onClose, id, panel, modal: true })
  return createPortal(<AnimatePresence>{open && <motion.div ref={panel} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} className="question-surface" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0, transition: T.base }} exit={{ opacity: 0, x: 16, transition: T.exit }}>
    <Frame {...frame} onClose={onClose} titleId={`${id}-title`} subtitleId={`${id}-subtitle`} footerEl={footerEl} setFooterEl={setFooterEl} />
  </motion.div>}</AnimatePresence>, document.body)
}
