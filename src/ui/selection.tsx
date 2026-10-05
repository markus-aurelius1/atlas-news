/**
 * Selection controls: Tabs, SegmentedControl, Switch and Checkbox, with the
 * roles and keyboard behaviour their patterns call for.
 *
 *   Tabs              tablist / tab (/ tabpanel), roving tabindex, ← → Home End, a fade where the row overflows
 *   SegmentedControl  a radio group: ← → move the choice
 *   Switch            a switch; the thumb answers a press and can be dragged across
 *   Checkbox          reusable selection control
 *
 * `Segmented` and `Toggle` are the earlier names, kept so call sites don't
 * change: Segmented is a segmented control that keeps the tablist semantics
 * the existing screens and QA scripts rely on.
 */
import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { haptics } from '@/services/haptics'
import { M } from './motion'
import { Pressable } from './Pressable'

// ───────────────────────── roving focus ─────────────────────────

/** Arrow keys move between the enabled items of a row; Home and End jump to the ends. Returns the index to move to, or null. */
export function rovingIndex(key: string, current: number, count: number, opts: { vertical?: boolean; disabled?: (i: number) => boolean } = {}): number | null {
  if (!count) return null
  const next = opts.vertical ? 'ArrowDown' : 'ArrowRight'
  const prev = opts.vertical ? 'ArrowUp' : 'ArrowLeft'
  const step = key === next ? 1 : key === prev ? -1 : 0
  const usable = (i: number) => !opts.disabled?.(i)
  if (key === 'Home' || key === 'End') {
    const order = Array.from({ length: count }, (_, i) => (key === 'Home' ? i : count - 1 - i))
    return order.find(usable) ?? null
  }
  if (!step) return null
  for (let n = 1; n <= count; n++) {
    const i = (((current + step * n) % count) + count) % count
    if (usable(i)) return i
  }
  return null
}

// ───────────────────────── tabs ─────────────────────────

export interface TabItem<T extends string> {
  id: T
  label: ReactNode
  /** A small count after the label. */
  count?: number
  disabled?: boolean
}

export interface TabsProps<T extends string> {
  items: TabItem<T>[]
  value: T
  onChange: (id: T) => void
  /** What the tabs are for, e.g. "Plan views". */
  label: string
  /**
   * `tabs` (default): the tabs switch a panel on this screen (tablist / tab / aria-selected; pair with <TabPanel>).
   * `nav`: each tab is a place in the app (a nav with aria-current), as the Plan views are.
   */
  kind?: 'tabs' | 'nav'
  /** Shared-layout id for the sliding pill (give two tab rows on one screen different ids). */
  layoutId?: string
  className?: string
  /** Base for tab and panel ids, when panels are rendered with <TabPanel>. */
  id?: string
  /** Rendered after the last tab, inside the row (an overflow menu for the tabs that do not fit). */
  trailing?: ReactNode
}

export function Tabs<T extends string>({ items, value, onChange, label, kind = 'tabs', layoutId, className, id, trailing }: TabsProps<T>) {
  const auto = useId()
  const base = id ?? auto
  const pill = layoutId ?? `tabs-${auto}`
  const row = useRef<HTMLDivElement>(null)

  // A soft edge where there is more to scroll to.
  const fade = useCallback(() => {
    const el = row.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    el.style.setProperty('--fade-start', el.scrollLeft > 2 ? '20px' : '0px')
    el.style.setProperty('--fade-end', max - el.scrollLeft > 2 ? '20px' : '0px')
  }, [])
  useEffect(() => {
    fade()
    const el = row.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(fade)
    ro.observe(el)
    return () => ro.disconnect()
  }, [fade, items.length])
  // Keep the selected tab in view.
  useEffect(() => {
    row.current?.querySelector<HTMLElement>('[data-current]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [value])

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = items.findIndex((it) => it.id === value)
    const to = rovingIndex(e.key, i, items.length, { disabled: (n) => !!items[n].disabled })
    if (to === null) return
    e.preventDefault()
    onChange(items[to].id)
    requestAnimationFrame(() => row.current?.querySelectorAll<HTMLElement>('[data-tab]')[to]?.focus())
  }

  const nav = kind === 'nav'
  const Row = nav ? 'nav' : 'div'
  return (
    <Row ref={row as never} role={nav ? undefined : 'tablist'} aria-label={label} className={cn('tabs', className)} onScroll={fade} onKeyDown={onKey}>
      {items.map((it) => {
        const on = it.id === value
        return (
          <Pressable
            key={it.id}
            data-tab=""
            data-current={on ? '' : undefined}
            id={`${base}-tab-${it.id}`}
            role={nav ? undefined : 'tab'}
            aria-selected={nav ? undefined : on}
            aria-current={nav && on ? 'page' : undefined}
            aria-controls={nav ? undefined : `${base}-panel-${it.id}`}
            tabIndex={on ? 0 : -1}
            disabled={it.disabled}
            plain
            haptic={on ? 'none' : 'tap'}
            className="tab"
            onClick={() => {
              if (!on) onChange(it.id)
            }}
          >
            {on && <motion.span layoutId={pill} className="tab-pill" transition={M.indicator} />}
            <span className="relative">{it.label}</span>
            {it.count !== undefined && it.count > 0 && <span className="t-num relative ml-1.5 text-[11.5px] text-ink-3">{it.count}</span>}
          </Pressable>
        )
      })}
      {trailing}
    </Row>
  )
}

/** The panel a tab shows. Give it the same `id` base as its <Tabs>. */
export function TabPanel<T extends string>({ id, tab, current, children, className }: { id: string; tab: T; current: T; children: ReactNode; className?: string }) {
  if (tab !== current) return null
  return (
    <div role="tabpanel" id={`${id}-panel-${tab}`} aria-labelledby={`${id}-tab-${tab}`} tabIndex={0} className={cn('outline-none', className)}>
      {children}
    </div>
  )
}

// ───────────────────────── segmented control ─────────────────────────

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
}

export interface SegmentedControlProps<T extends string> {
  value: T
  onChange: (v: T) => void
  options: SegmentOption<T>[]
  size?: 'sm' | 'md'
  className?: string
  layoutId?: string
  /** What is being chosen, for assistive technology. */
  label?: string
  /** `radio` (default): a radio group. `tabs`: tablist semantics, for a control that switches the view below it. */
  semantics?: 'radio' | 'tabs'
}

export function SegmentedControl<T extends string>({ value, onChange, options, size = 'md', className, layoutId, label, semantics = 'radio' }: SegmentedControlProps<T>) {
  const auto = useId()
  const id = layoutId ?? `seg-${auto}`
  const group = useRef<HTMLDivElement>(null)
  const tabs = semantics === 'tabs'
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = options.findIndex((o) => o.value === value)
    const to = rovingIndex(e.key, i, options.length) ?? (e.key === 'ArrowDown' ? rovingIndex('ArrowRight', i, options.length) : e.key === 'ArrowUp' ? rovingIndex('ArrowLeft', i, options.length) : null)
    if (to === null) return
    e.preventDefault()
    haptics.tap()
    onChange(options[to].value)
    requestAnimationFrame(() => group.current?.querySelectorAll<HTMLElement>('[data-segment]')[to]?.focus())
  }
  return (
    <div ref={group} role={tabs ? 'tablist' : 'radiogroup'} aria-label={label} data-size={size} className={cn('segmented', className)} onKeyDown={onKey}>
      {options.map((o) => {
        const active = o.value === value
        return (
          <Pressable
            key={o.value}
            data-segment=""
            role={tabs ? 'tab' : 'radio'}
            aria-selected={tabs ? active : undefined}
            aria-checked={tabs ? undefined : active}
            tabIndex={active ? 0 : -1}
            plain
            press="none"
            haptic={active ? 'none' : 'tap'}
            className="segment"
            onClick={() => onChange(o.value)}
          >
            {active && <motion.span layoutId={id} transition={M.indicator} className="segment-pill" />}
            <span className="relative">{o.label}</span>
          </Pressable>
        )
      })}
    </div>
  )
}

/** The earlier name: a segmented control with tablist semantics (it switches the view beneath it). */
export function Segmented<T extends string>(props: Omit<SegmentedControlProps<T>, 'semantics'>) {
  return <SegmentedControl {...props} semantics="tabs" />
}

// ───────────────────────── switch ─────────────────────────

export interface SwitchProps {
  checked: boolean
  onChange: (v: boolean) => void
  /** The accessible name (omit when `labelledBy` points at visible text). */
  label?: string
  labelledBy?: string
  disabled?: boolean
  className?: string
}

/** How far the thumb travels between off and on (px at the default font size; matches .switch-thumb). */
const TRAVEL = 21

export function Switch({ checked, onChange, label, labelledBy, disabled, className }: SwitchProps) {
  const el = useRef<HTMLButtonElement>(null)
  const drag = useRef<{ x: number; moved: boolean } | null>(null)
  /** A drag decides for itself; the click that ends it must not toggle again. */
  const decided = useRef(false)

  const onDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return
    drag.current = { x: e.clientX, moved: false }
    decided.current = false
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d || !el.current) return
    const dx = e.clientX - d.x
    if (!d.moved && Math.abs(dx) < 4) return
    d.moved = true
    el.current.dataset.dragging = ''
    const at = Math.max(0, Math.min(TRAVEL, (checked ? TRAVEL : 0) + dx))
    el.current.style.setProperty('--switch-x', `${at}px`)
    el.current.querySelector<HTMLElement>('.switch-thumb')?.style.setProperty('--switch-x', `${at}px`)
  }
  const onUp = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    drag.current = null
    if (!d?.moved || !el.current) return
    const at = Math.max(0, Math.min(TRAVEL, (checked ? TRAVEL : 0) + (e.clientX - d.x)))
    delete el.current.dataset.dragging
    el.current.style.removeProperty('--switch-x')
    el.current.querySelector<HTMLElement>('.switch-thumb')?.style.removeProperty('--switch-x')
    decided.current = true
    const next = at > TRAVEL / 2
    if (next !== checked) {
      haptics.tap()
      onChange(next)
    }
  }

  return (
    <button
      ref={el}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-labelledby={labelledBy}
      disabled={disabled}
      className={cn('switch pressable', className)}
      data-press="none"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      onClick={() => {
        if (decided.current) {
          decided.current = false
          return
        }
        haptics.tap()
        onChange(!checked)
      }}
    >
      <span className="switch-thumb" />
    </button>
  )
}

/** The earlier name for Switch. */
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return <Switch checked={checked} onChange={onChange} label={label} disabled={disabled} />
}

/** A setting on a full-width row: pressing anywhere on the row flips the switch. */
export function SwitchRow({ title, description, checked, onChange, disabled, icon, className }: { title: ReactNode; description?: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; icon?: ReactNode; className?: string }) {
  const id = useId()
  return (
    // A label activates the switch inside it, so the whole row is the target without nesting one control in another.
    <label className={cn('list-row cursor-pointer', disabled && 'cursor-default opacity-60', className)} data-density="regular">
      {icon && <span className="flex size-9 shrink-0 items-center justify-center rounded-field bg-surface-2 text-ink-2 [&>svg]:size-[18px]">{icon}</span>}
      <span className="min-w-0 flex-1">
        <span id={id} className="block text-[15px] leading-snug font-semibold">
          {title}
        </span>
        {description && <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{description}</span>}
      </span>
      <Switch checked={checked} onChange={onChange} labelledBy={id} disabled={disabled} />
    </label>
  )
}

// ───────────────────────── checkbox ─────────────────────────

export interface CheckboxProps {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  size?: 'sm' | 'md'
  /** A circle or a rounded square. */
  shape?: 'circle' | 'square'
  /** Ring colour while unchecked. */
  ring?: string
  /** Fill colour when checked. */
  fill?: string
  disabled?: boolean
  className?: string
}

/** Selection fills with an animated mark; its touch target is at least 44 px. */
export function Checkbox({ checked, onChange, label, size = 'md', shape = 'circle', ring, fill, disabled, className }: CheckboxProps) {
  const [pulse, setPulse] = useState(false)
  return (
    <Pressable
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      plain
      haptic="none"
      data-shape={shape}
      className={cn('check', size === 'sm' ? 'size-5' : 'size-[25px]', className)}
      style={{ '--check-ring': ring, '--check-fill': fill } as React.CSSProperties}
      onClick={(e) => {
        e.stopPropagation()
        if (checked) haptics.tap()
        else {
          haptics.success()
          setPulse(true)
        }
        onChange(!checked)
      }}
    >
      <Check className={cn('check-mark', size === 'sm' ? 'size-3' : 'size-3.5')} strokeWidth={3.2} />
      {pulse && <motion.span className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ boxShadow: `0 0 0 2px ${fill ?? 'var(--success)'}` }} initial={{ opacity: 0.5, scale: 1 }} animate={{ opacity: 0, scale: 1.7 }} transition={M.progress} onAnimationComplete={() => setPulse(false)} />}
    </Pressable>
  )
}
