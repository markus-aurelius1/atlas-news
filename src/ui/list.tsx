/**
 * Rows, groups, progress and the small things that sit in them.
 *
 *   ListRow   one row: leading, title, meta, trailing – and actions beside the
 *             main target without nesting one control inside another
 *   Group     a hairline container for related rows (settings, a month grid)
 *   Progress  bar, ring and segmented; transform-only, announced as a progressbar
 *   Badge     a status pill
 *   Skeleton  a placeholder in the shape of what is coming
 */
import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Pressable, type Haptic } from './Pressable'

export interface ListRowProps {
  /** An icon, a checkbox, a colour dot – before the text. */
  leading?: ReactNode
  title: ReactNode
  /** Quiet second line: dates, counts, sources. */
  meta?: ReactNode
  /** After the text, inside the main target: a value, a chevron. Not interactive. */
  trailing?: ReactNode
  /**
   * Controls beside the main target (a play button, a menu). They are siblings
   * of the row's own button, so no interactive element is nested in another.
   */
  actions?: ReactNode
  onClick?: () => void
  href?: string
  density?: 'compact' | 'regular' | 'comfortable'
  selected?: boolean
  disabled?: boolean
  /** Top-align leading and trailing with a multi-line title. */
  align?: 'center' | 'start'
  haptic?: Haptic
  /** The accessible name when the title isn't plain text. */
  label?: string
  className?: string
  /** `li` inside a list, `div` elsewhere. */
  as?: 'li' | 'div'
}

export function ListRow({ leading, title, meta, trailing, actions, onClick, href, density = 'regular', selected, disabled, align = 'center', haptic, label, className, as: As = 'div' }: ListRowProps) {
  const body = (
    <>
      {leading && <span className="flex shrink-0 items-center">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-snug font-semibold break-words">{title}</span>
        {meta && <span className="mt-0.5 block text-[12.5px] leading-snug font-medium text-ink-2">{meta}</span>}
      </span>
      {trailing && <span className="flex shrink-0 items-center gap-2 text-[13px] text-ink-2">{trailing}</span>}
    </>
  )
  const attrs = { 'data-density': density, 'data-align': align === 'start' ? 'start' : undefined }
  const interactive = !!onClick || href !== undefined
  const main = !interactive ? (
    <div className={cn('list-row', disabled && 'opacity-50', !actions && className)} {...attrs}>
      {body}
    </div>
  ) : href !== undefined ? (
    <Pressable href={href} press="surface" haptic={haptic} selected={selected} aria-label={label} aria-current={selected || undefined} className={cn('list-row', !actions && className)} {...attrs} onClick={onClick}>
      {body}
    </Pressable>
  ) : (
    <Pressable press="surface" haptic={haptic} selected={selected} disabled={disabled} aria-label={label} aria-current={selected || undefined} className={cn('list-row', !actions && className)} {...attrs} onClick={onClick}>
      {body}
    </Pressable>
  )
  if (!actions) return As === 'li' ? <li className="list-none">{main}</li> : main
  return (
    <As className={cn('list-row-shell', As === 'li' && 'list-none', className)}>
      {main}
      <span className="list-row-actions">{actions}</span>
    </As>
  )
}

/** Related rows in one hairline container. `flat` drops the raised fill (for a group sitting on a raised surface already). */
export function Group({ children, flat, className, label, as: As = 'div' }: { children: ReactNode; flat?: boolean; className?: string; label?: string; as?: 'div' | 'ul' | 'section' }) {
  return (
    <As className={cn('group', className)} data-flat={flat ? '' : undefined} aria-label={label} role={label && As === 'div' ? 'group' : undefined}>
      {children}
    </As>
  )
}

export interface ProgressProps {
  /** 0 to 1. */
  value: number
  /** What is progressing, e.g. "Daily goal". */
  label: string
  variant?: 'bar' | 'ring' | 'segments'
  /** Text for the value ("3 of 4", "65%"); defaults to a percentage. */
  valueText?: string
  color?: string
  /** Ring: diameter and stroke in px. */
  size?: number
  stroke?: number
  /** Segments: how many. */
  count?: number
  /** Bar: the thinner size. */
  thin?: boolean
  /** Ring: content in the middle. */
  children?: ReactNode
  className?: string
}

export function Progress({ value, label, variant = 'bar', valueText, color, size = 44, stroke = 4, count = 4, thin, children, className }: ProgressProps) {
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  const aria = { role: 'progressbar', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': Math.round(v * 100), 'aria-valuetext': valueText ?? `${Math.round(v * 100)}%` } as const
  const vars = { '--progress': color, '--value': v } as CSSProperties

  if (variant === 'ring') {
    const r = (size - stroke) / 2
    const c = 2 * Math.PI * r
    return (
      <div {...aria} className={cn('relative inline-flex shrink-0 items-center justify-center', className)} style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line-strong)" strokeWidth={stroke} />
          <circle className="progress-ring-arc" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color ?? 'var(--accent)'} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} />
        </svg>
        {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
      </div>
    )
  }
  if (variant === 'segments') {
    const on = Math.round(v * count)
    return (
      <div {...aria} className={cn('progress-segments', className)} style={vars}>
        {Array.from({ length: count }, (_, i) => (
          <span key={i} data-on={i < on ? '' : undefined} />
        ))}
      </div>
    )
  }
  return (
    <div {...aria} className={cn('progress', className)} data-size={thin ? 'sm' : undefined} style={vars}>
      <div className="progress-fill" />
    </div>
  )
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'accent' | 'correct' | 'incorrect' | 'warning' | 'info'; className?: string }) {
  return (
    <span className={cn('badge', className)} data-tone={tone === 'neutral' ? undefined : tone}>
      {children}
    </span>
  )
}

/** A placeholder block. Compose several into the shape of the content that is loading. */
export function Skeleton({ className, lines, style }: { className?: string; lines?: number; style?: CSSProperties }) {
  if (lines)
    return (
      <div className={cn('space-y-2.5', className)} aria-hidden="true" style={style}>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i} className="skeleton skeleton-line" style={{ width: `${[92, 78, 64, 85, 55][i % 5]}%` }} />
        ))}
      </div>
    )
  return <div className={cn('skeleton', className)} aria-hidden="true" style={style} />
}
