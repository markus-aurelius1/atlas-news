/**
 * The frame every workspace shares: a compact header that stays put (title on
 * the left, that screen's own actions on the right), an optional toolbar row
 * under it, and the content column. There is no hero – typography and
 * whitespace carry the page – and the header takes a hairline only once
 * content has scrolled under it.
 *
 * In the window the toolbar stays with the header; on a phone only the title
 * row stays, so the sticky chrome never takes more than one line of the screen.
 */
import { ArrowLeft, Search } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { haptics } from '@/services/haptics'
import { IconButton } from '@/ui/controls'
import { goBack } from './router'
import { useUi } from './ui-store'

const WIDTH = {
  sm: 'max-w-2xl',
  md: 'max-w-3xl',
  lg: 'max-w-4xl',
  xl: 'max-w-5xl',
  '2xl': 'max-w-6xl',
} as const

export type WorkspaceWidth = keyof typeof WIDTH
export const workspaceColumn = (width: WorkspaceWidth = 'md') => cn('mx-auto w-full px-4 sm:px-6 lg:px-8', WIDTH[width])
/**
 * The header and toolbar of every workspace share this one column, whatever
 * reading width the content beneath has chosen – so the title, the tabs and
 * the actions are in the same place on every screen and do not move as you
 * navigate.
 */
export const HEADER_COLUMN = 'mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8'

/** True once the element has scrolled out from under the top of its scroller (the page or the stage). */
function useScrolledPast() {
  const sentinel = useRef<HTMLDivElement>(null)
  const [past, setPast] = useState(false)
  useEffect(() => {
    const el = sentinel.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => setPast(!entry.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [sentinel, past] as const
}

/** Search and commands, for phones (the rail carries it from 768px up). */
export function CommandButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      aria-label="Ask Tars"
      onClick={() => {
        haptics.tap()
        useUi.getState().set({ paletteOpen: true })
      }}
      className={cn('press flex size-10 shrink-0 items-center justify-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink md:hidden', className)}
    >
      <Search className="size-5" />
    </button>
  )
}

export interface WorkspaceProps {
  title: ReactNode
  titleId?: string
  /** Quiet context beside the title (a date, a count). */
  meta?: ReactNode
  /** This screen's own actions, at the end of the header. */
  actions?: ReactNode
  /** A second header row: view tabs, range pickers, filters. */
  toolbar?: ReactNode
  /** Phones: show a way back for screens that are not on the tab bar. */
  back?: boolean
  width?: WorkspaceWidth
  children: ReactNode
  className?: string
}

export function Workspace({ title, titleId, meta, actions, toolbar, back, width = 'md', children, className }: WorkspaceProps) {
  const [sentinel, stuck] = useScrolledPast()
  const column = workspaceColumn(width)
  // From 768 px the header keeps one position across screens; on a phone it follows the content column (they are the same width there).
  const head = cn(HEADER_COLUMN, 'max-md:max-w-none')
  return (
    <div className={className}>
      <div ref={sentinel} className="h-px" aria-hidden="true" />
      <header className={cn('pt-safe sticky top-0 z-20 -mt-px bg-bg transition-shadow duration-200', stuck && (toolbar ? 'max-md:shadow-[0_1px_0_var(--line)]' : 'shadow-[0_1px_0_var(--line)]'))}>
        <div className={cn(head, 'flex h-14 items-center gap-2')}>
          {back && (
            // Back goes to the previous screen, or Atlas at a fresh launch.
            <IconButton label="Back" tip="none" className="-ml-2 md:hidden" onClick={() => goBack()}>
              <ArrowLeft className="size-5" />
            </IconButton>
          )}
          <div className="flex min-w-0 flex-1 items-baseline gap-3">
            <h1 id={titleId} className="t-title min-w-0 truncate">
              {title}
            </h1>
            {meta && <p className="t-meta hidden min-w-0 truncate sm:block">{meta}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {actions}
          </div>
        </div>
      </header>
      {toolbar && (
        <div className={cn('z-[19] bg-bg pb-2.5 transition-shadow duration-200 md:sticky md:top-14', stuck && 'md:shadow-[0_1px_0_var(--line)]')}>
          <div className={head}>{toolbar}</div>
        </div>
      )}
      <div className={column}>{children}</div>
    </div>
  )
}
