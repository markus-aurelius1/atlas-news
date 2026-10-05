/**
 * Buttons, chips and small layout helpers. Everything pressable here is built
 * on Pressable (state layer, press, hit area, haptics); the selection controls
 * and the field family live beside this file and are re-exported, so screens
 * import what they need from '@/ui/controls'.
 */
import { Check, Minus, Plus } from 'lucide-react'
import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useMotionPreference } from '@/lib/motion'
import { Pressable, type Haptic } from './Pressable'
import { Tooltip } from './surface/Tooltip'

export { Field, TextInput, TextArea, Select, SearchField, DateField, TimeField, Slider } from './fields'
export { Segmented, SegmentedControl, Tabs, TabPanel, Switch, SwitchRow, Toggle, Checkbox, type SegmentOption, type TabItem } from './selection'
export { ListRow, Group, Progress, Badge, Skeleton } from './list'
export { Pressable } from './Pressable'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  block?: boolean
  /** Work in progress: the icon becomes a busy indicator and the button can't be pressed again. */
  loading?: boolean
  /** Briefly show a tick in place of the icon (after a save, a copy…). Set it true when the action succeeds. */
  success?: boolean
  haptic?: Haptic
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ variant = 'secondary', size = 'md', icon, block, loading, success, className, children, ...rest }, ref) {
  const flash = useFlash(success)
  return (
    <Pressable ref={ref as never} loading={loading} data-variant={variant} data-size={size} className={cn('btn', block && 'w-full', flash && 'btn-success', className)} {...rest}>
      {loading ? <Spinner className="size-4" /> : flash ? <Check className="size-4" strokeWidth={2.6} /> : icon}
      {children}
    </Pressable>
  )
})

/** True for a moment after `on` turns true. */
function useFlash(on: boolean | undefined, ms = 1400) {
  const [flash, setFlash] = useState(false)
  const was = useRef(false)
  useEffect(() => {
    if (on && !was.current) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), ms)
      was.current = true
      return () => clearTimeout(t)
    }
    was.current = !!on
  }, [on, ms])
  return flash
}

/** A quiet indeterminate indicator (button loading states, slow reads). Under reduced motion it is three pulsing dots instead of a spinning ring. */
export function Spinner({ className }: { className?: string }) {
  const reduced = useMotionPreference() === 'reduced'
  if (reduced)
    return (
      <span className={cn('dots', className)} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    )
  return (
    <svg viewBox="0 0 24 24" className={cn('animate-spin', className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** The accessible name, also shown as a tooltip on hover and keyboard focus. */
  label: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'ghost' | 'secondary' | 'primary' | 'accent'
  active?: boolean
  /** A key hint shown after the label in the tooltip, e.g. "S". */
  shortcut?: string
  /** Where the tooltip sits. */
  tip?: 'top' | 'bottom' | 'left' | 'right' | 'none'
  haptic?: Haptic
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ label, size = 'md', variant = 'ghost', active, shortcut, tip = 'bottom', className, children, ...rest }, ref) {
  const button = (
    <Pressable ref={ref as never} aria-label={label} data-size={size} data-variant={variant} data-active={active ? '' : undefined} className={cn('icon-btn', className)} {...rest}>
      {children}
    </Pressable>
  )
  if (tip === 'none') return button
  return (
    <Tooltip label={label} shortcut={shortcut} side={tip}>
      {button}
    </Tooltip>
  )
})

export function Chip({ children, color, active, onClick, className }: { children: ReactNode; color?: string; active?: boolean; onClick?: () => void; className?: string }) {
  const content = (
    <>
      {color && <span className="size-2 shrink-0 rounded-full" style={{ background: color }} />}
      <span className="truncate">{children}</span>
    </>
  )
  if (!onClick)
    return (
      <span className={cn('chip', className)} data-active={active ? '' : undefined}>
        {content}
      </span>
    )
  return (
    <Pressable onClick={onClick} aria-pressed={active} data-active={active ? '' : undefined} className={cn('chip', className)}>
      {content}
    </Pressable>
  )
}

/**
 * A number with − and + either side. Holding a button repeats it, slowly at
 * first and then faster; typing a number works too.
 */
export function Stepper({ value, onChange, min = 0, max = 999, step = 1, suffix, label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string; label: string }) {
  const latest = useRef(value)
  latest.current = value
  const set = (v: number) => onChange(Math.max(min, Math.min(max, v)))
  const hold = useRef<ReturnType<typeof setTimeout>>(undefined)
  /** Set by a hold that repeated, so the click that ends it doesn't add one more. */
  const repeated = useRef(false)
  const stop = () => clearTimeout(hold.current)
  useEffect(() => stop, [])
  const start = (dir: 1 | -1) => {
    repeated.current = false
    let delay = 380
    const tick = () => {
      const next = latest.current + dir * step
      if (next < min || next > max) return
      repeated.current = true
      set(next)
      delay = Math.max(45, delay * 0.82)
      hold.current = setTimeout(tick, delay)
    }
    stop()
    hold.current = setTimeout(tick, delay)
  }
  const side = (dir: 1 | -1) => ({
    onPointerDown: () => start(dir),
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onClick: () => {
      if (!repeated.current) set(value + dir * step)
      repeated.current = false
    },
  })
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-surface p-1 shadow-[inset_0_0_0_1px_var(--line)]" role="group" aria-label={label}>
      <IconButton label={`Decrease ${label}`} size="sm" tip="none" disabled={value <= min} {...side(-1)}>
        <Minus className="size-4" />
      </IconButton>
      <input
        aria-label={label}
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ''))
          if (!Number.isNaN(n)) set(n)
        }}
        className="tabular w-10 bg-transparent text-center text-sm font-bold outline-none"
      />
      {suffix && <span className="-ml-1 pr-1 text-xs text-ink-3">{suffix}</span>}
      <IconButton label={`Increase ${label}`} size="sm" tip="none" disabled={value >= max} {...side(1)}>
        <Plus className="size-4" />
      </IconButton>
    </div>
  )
}

export function Card({ children, className, as: As = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'div' | 'article' }) {
  return <As className={cn('rounded-card bg-surface-2/50', className)}>{children}</As>
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-1.5 flex min-h-8 items-center justify-between gap-3 px-1', className)}>
      <h2 className="t-label">{children}</h2>
      {action}
    </div>
  )
}

export function Dot({ color, className }: { color?: string | null; className?: string }) {
  return <span className={cn('inline-block size-2.5 shrink-0 rounded-full', className)} style={{ background: color ?? 'var(--ink-3)' }} />
}
