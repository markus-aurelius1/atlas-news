/**
 * Pressable: the one implementation of press, hover, focus, disabled, loading
 * and hit area. Every interactive control in src/ui is built on it, and screens
 * use those controls rather than a hand-styled <button>.
 *
 * - State is a single overlay (the "state layer") animated by opacity, so hover
 *   and press look the same everywhere and never repaint the control itself.
 * - A press sinks the control a little: `control` for buttons, chips and
 *   icons, `surface` for rows and cards, `none` for things that must not move.
 * - On a touch screen the hit area is at least 44 × 44 px whatever the visual
 *   size (a pseudo-element extends it; see .pressable in index.css).
 * - `haptic` names the feel of the action; it fires once per activation, on
 *   the click, never on touch-down.
 * - `loading` keeps the control in place but inert and marks it busy.
 *
 * The styles live in index.css (`.pressable`), so a control is still correct
 * before any script runs and under reduced motion (no sink, state layer only).
 */
import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type MouseEvent, type ReactNode, type Ref } from 'react'
import { cn } from '@/lib/cn'
import { haptics } from '@/services/haptics'

export type Haptic = 'tap' | 'press' | 'success' | 'warning' | 'none'
export type PressDepth = 'control' | 'surface' | 'none'

interface Own {
  /** How far it sinks when pressed. */
  press?: PressDepth
  /** The feel of the action, played once when it is activated. */
  haptic?: Haptic
  /** Busy: stays where it is, cannot be activated again, announced as busy. */
  loading?: boolean
  /** Chosen (a selected row, the current filter): shown with the selected state layer. */
  selected?: boolean
  /** Leave out the state layer – for a control that draws its own hover and press. */
  plain?: boolean
  children?: ReactNode
}

export type PressableProps = Own &
  (({ href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) | ({ href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'children' | 'href'>))

const feel = (h: Haptic) => {
  if (h !== 'none') haptics[h]()
}

export const Pressable = forwardRef<HTMLButtonElement | HTMLAnchorElement, PressableProps>(function Pressable(props, ref) {
  const { press = 'control', haptic = 'tap', loading, selected, plain, className, children, ...rest } = props
  const shared = {
    className: cn('pressable', className),
    'data-press': press === 'control' ? undefined : press,
    'data-selected': selected ? '' : undefined,
    'aria-busy': loading || undefined,
  }
  const layer = plain ? null : <span className="pressable-state" aria-hidden="true" />

  if (rest.href !== undefined) {
    const { onClick, ...a } = rest
    return (
      <a
        ref={ref as Ref<HTMLAnchorElement>}
        {...shared}
        {...a}
        onClick={(e: MouseEvent<HTMLAnchorElement>) => {
          if (loading) return e.preventDefault()
          feel(haptic)
          onClick?.(e)
        }}
      >
        {layer}
        {children}
      </a>
    )
  }

  const { onClick, type = 'button', disabled, ...b } = rest as Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>
  return (
    <button
      ref={ref as Ref<HTMLButtonElement>}
      type={type}
      {...shared}
      {...b}
      disabled={disabled || loading}
      onClick={(e) => {
        feel(haptic)
        onClick?.(e)
      }}
    >
      {layer}
      {children}
    </button>
  )
})
