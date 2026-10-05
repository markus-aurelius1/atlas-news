import { cn } from '@/lib/cn'

/**
 * The Tars mark: four slabs – standing together
 * as a T. Drawn in currentColor so it takes the accent (or any) colour.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-6', className)} aria-hidden="true">
      <g fill="currentColor">
        <rect x="3.5" y="6" width="5.5" height="7" rx="1.6" opacity="0.72" />
        <rect x="10.2" y="6" width="5.5" height="20" rx="1.6" />
        <rect x="16.3" y="6" width="5.5" height="20" rx="1.6" />
        <rect x="23" y="6" width="5.5" height="7" rx="1.6" opacity="0.72" />
      </g>
    </svg>
  )
}

export function Wordmark({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className="size-[22px] shrink-0 text-accent" />
      {!compact && <span className="font-display text-[20px] leading-none font-medium tracking-tight">Tars</span>}
    </span>
  )
}
