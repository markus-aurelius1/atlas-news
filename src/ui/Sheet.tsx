/**
 * Sheet: the earlier name for "a dialog here, a bottom sheet on a phone". It is
 * now a thin wrapper that picks between the two surfaces in ui/surface, so the
 * call sites written against it keep working unchanged. New code should choose
 * the surface that fits the job: Dialog, BottomSheet (with detents), SidePanel,
 * Popover or Menu.
 */
import type { ReactNode } from 'react'
import { BottomSheet } from './surface/BottomSheet'
import { Dialog } from './surface/Dialog'
import { useIsWide } from './useMedia'

export { anyLayerOpen, isTopLayer, pushLayer, trapTab } from './surface/core'
export { SheetActions, SheetFooter } from './surface/frame'

export interface SheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  /** Actions pinned below the scrolling body (always visible). Use <SheetActions> for button rows. */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Extra element in the header, left of the close button. */
  headerAction?: ReactNode
  /** Replaces the standard title row (the sheet still handles dragging, focus and Escape). */
  header?: ReactNode
  bodyClassName?: string
  /** Render without padding/header chrome (for custom layouts). */
  bare?: boolean
  /** Accessible name when the title isn't plain text (or there is none). */
  label?: string
}

/** Bottom sheet on phones, centred dialog on larger screens. */
export function Sheet(props: SheetProps) {
  const wide = useIsWide()
  return wide ? <Dialog {...props} /> : <BottomSheet {...props} />
}
