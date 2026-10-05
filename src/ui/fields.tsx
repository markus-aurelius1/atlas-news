/**
 * The field family: one frame for text, search, select, date, time and a
 * slider. All share a height per density, a radius, a focus ring and a disabled
 * look (.field / .field-frame in ui.css).
 *
 * DateField and TimeField wrap the native inputs, so the platform pickers still
 * open; Slider is the native range input restyled, so the keyboard and
 * assistive technology work without any code here.
 */
import { Search, X } from 'lucide-react'
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { haptics } from '@/services/haptics'

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput({ className, ...rest }, ref) {
  return <input ref={ref} className={cn('field', className)} {...rest} />
})

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea({ className, ...rest }, ref) {
  return <textarea ref={ref} className={cn('field', className)} {...rest} />
})

export function Select({ className, children, compact, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { compact?: boolean }) {
  return (
    <span className={cn('field-select-wrap', compact && 'inline-block w-auto')}>
      <select className={cn('field field-select', compact && 'font-semibold', className)} data-density={compact ? 'compact' : undefined} {...rest}>
        {children}
      </select>
    </span>
  )
}

export const DateField = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(function DateField({ className, ...rest }, ref) {
  return <input ref={ref} type="date" className={cn('field tabular', className)} {...rest} />
})

export const TimeField = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(function TimeField({ className, ...rest }, ref) {
  return <input ref={ref} type="time" className={cn('field tabular', className)} {...rest} />
})

export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: string
  onChange: (value: string) => void
  /** The accessible name (there is no visible label beside a search field). */
  label: string
  /** A key hint shown while the field is empty, e.g. "/". */
  shortcut?: string
  compact?: boolean
  /** Extra controls inside the frame, after the clear button. */
  trailing?: ReactNode
}

/** Search: a leading icon, a clear button once there is text, an optional key hint. */
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField({ value, onChange, label, shortcut, compact, trailing, className, disabled, ...rest }, ref) {
  return (
    <span className={cn('field-frame', className)} data-density={compact ? 'compact' : undefined} data-disabled={disabled ? '' : undefined}>
      <Search className="size-4 shrink-0 text-ink-3" aria-hidden="true" />
      <input ref={ref} type="search" aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className="[&::-webkit-search-cancel-button]:hidden" {...rest} />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          className="pressable -mr-1 flex size-7 shrink-0 items-center justify-center rounded-full text-ink-3 hover:text-ink"
          onClick={() => {
            haptics.tap()
            onChange('')
          }}
        >
          <X className="size-4" />
        </button>
      ) : (
        shortcut && <kbd className="kbd shrink-0">{shortcut}</kbd>
      )}
      {trailing}
    </span>
  )
})

export interface SliderProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange' | 'value'> {
  value: number
  onChange: (value: number) => void
  /** The accessible name. */
  label: string
  min?: number
  max?: number
  step?: number
  /** Shown beside the track, e.g. "65%". Also announced as the value. */
  valueLabel?: string
  /** Values the thumb gives a small tick at as it passes (a slider with natural stops). */
  detents?: number[]
}

export const Slider = forwardRef<HTMLInputElement, SliderProps>(function Slider({ value, onChange, label, min = 0, max = 1, step = 0.01, valueLabel, detents, className, style, ...rest }, ref) {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <span className={cn('flex min-w-0 items-center gap-3', className)}>
      <input
        ref={ref}
        type="range"
        className="slider"
        aria-label={label}
        aria-valuetext={valueLabel}
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--fill': `${fill}%`, ...style } as React.CSSProperties}
        onChange={(e) => {
          const next = Number(e.target.value)
          // A light tick when the thumb crosses a stop.
          if (detents?.some((d) => (value < d && next >= d) || (value > d && next <= d))) haptics.tap()
          onChange(next)
        }}
        {...rest}
      />
      {valueLabel !== undefined && <span className="t-num w-10 shrink-0 text-right text-[13px] text-ink-2">{valueLabel}</span>}
    </span>
  )
})

/** A label above a control, with an optional hint beneath. The label is wired to the control it wraps. */
export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  const id = useId()
  return (
    <label className={cn('block space-y-1.5', className)}>
      <span id={id} className="block t-label">
        {label}
      </span>
      {children}
      {hint && <span className="block text-xs text-ink-3">{hint}</span>}
    </label>
  )
}
