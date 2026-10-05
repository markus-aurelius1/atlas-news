/**
 * What every dialog, sheet and side panel has inside it: a header that never
 * scrolls, a body that scrolls only when it must, and a footer for actions that
 * are always in view. Content that throws closes its surface instead of taking
 * the screen beneath with it.
 */
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { createContext, useContext, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { IconButton } from '../controls'
import { ErrorBoundary } from '../ErrorBoundary'
import { M } from '../motion'
import { toast } from '../toast'

/** The footer element of the enclosing surface, for <SheetFooter> rendered deep in its content. */
export const FooterSlot = createContext<HTMLElement | null>(null)

export interface FrameProps {
  title?: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  /** Actions pinned below the scrolling body (always visible). Use <SheetActions> for button rows. */
  footer?: ReactNode
  /** Extra element in the header, left of the close button. */
  headerAction?: ReactNode
  /** Replaces the standard title row. */
  header?: ReactNode
  bodyClassName?: string
  /** Render without padding or header chrome (for custom layouts). */
  bare?: boolean
}

interface InnerProps extends FrameProps {
  onClose: () => void
  titleId: string
  subtitleId: string
  footerEl: HTMLElement | null
  setFooterEl: (el: HTMLDivElement | null) => void
  /** Pressing the header starts a drag (bottom sheets). */
  onHeaderPointerDown?: (e: ReactPointerEvent) => void
  bodyRef?: Ref<HTMLDivElement>
  /** Whether the body may scroll (a sheet below its top detent moves instead). */
  scroll?: boolean
  /** Hide the close button (a non-modal sheet is closed by its host). */
  closable?: boolean
}

export function Frame({ title, subtitle, children, footer, headerAction, header, bodyClassName, bare, onClose, titleId, subtitleId, footerEl, setFooterEl, onHeaderPointerDown, bodyRef, scroll = true, closable = true }: InnerProps) {
  return (
    <>
      {header ? (
        <div className="shrink-0" onPointerDown={onHeaderPointerDown}>
          {header}
        </div>
      ) : (
        !bare &&
        (title || headerAction) && (
          <div className="flex shrink-0 items-start gap-3 px-5 pt-2 pb-3 sm:px-6 sm:pt-5" onPointerDown={onHeaderPointerDown}>
            <div className="min-w-0 flex-1">
              {title && (
                <h2 id={titleId} className="t-title text-balance">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p id={subtitleId} className="mt-1 text-sm leading-snug text-ink-2">
                  {subtitle}
                </p>
              )}
            </div>
            {headerAction}
            {closable && (
              <IconButton label="Close" size="sm" tip="none" onClick={onClose} className="-mr-1">
                <X className="size-4.5" />
              </IconButton>
            )}
          </div>
        )
      )}
      <div ref={bodyRef} data-sheet-body className={cn('scrollbar-thin min-h-0 flex-1 overflow-x-hidden overscroll-contain', scroll ? 'overflow-y-auto' : 'overflow-y-hidden', !bare && 'sheet-pad px-5 sm:px-6', bodyClassName)}>
        <ErrorBoundary
          fallback={() => null}
          onError={() => {
            onClose()
            toast({ title: 'That couldn’t open', body: 'Nothing was lost. Try it again.', tone: 'warning' })
          }}
        >
          <FooterSlot.Provider value={footerEl}>{children}</FooterSlot.Provider>
        </ErrorBoundary>
      </div>
      <div ref={setFooterEl} data-sheet-footer className="shrink-0 border-t border-line bg-surface px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] empty:hidden sm:px-6 sm:pb-4">
        {footer}
      </div>
    </>
  )
}

/** Render actions into the enclosing surface's pinned footer from anywhere inside it. */
export function SheetFooter({ children }: { children: ReactNode }) {
  const el = useContext(FooterSlot)
  return el ? createPortal(children, el) : null
}

/**
 * The standard action row for a footer: optional secondary actions at the
 * start, the main actions at the end. Wraps onto a second line on narrow
 * screens rather than ever needing to scroll sideways.
 */
export function SheetActions({ start, children, stack: stacked }: { start?: ReactNode; children: ReactNode; stack?: boolean }) {
  if (stacked) return <div className="flex flex-col gap-2">{children}</div>
  return (
    <div className="flex flex-wrap items-center gap-2">
      {start && <div className="flex shrink-0 items-center gap-1">{start}</div>}
      <div className="flex min-w-[min(100%,15rem)] flex-1 flex-wrap items-center justify-end gap-2 *:min-w-0 *:flex-1 sm:*:flex-none">{children}</div>
    </div>
  )
}

/**
 * Content that changes inside an open surface (a step, a different record):
 * the old content fades out as the new fades in, in place. Give each state a
 * different `id`.
 */
export function Swap({ id, children, className }: { id: string | number; children: ReactNode; className?: string }) {
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div key={id} className={className} {...M.swap}>
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
