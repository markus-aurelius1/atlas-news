/**
 * Menu: a short list of actions anchored to a trigger. Focus moves into it on
 * open; ↑ ↓ move, Home and End jump, typing a letter jumps to the item that
 * starts with it, Escape or a press outside closes it and focus returns to the
 * trigger.
 */
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { rovingIndex } from '../selection'
import { Pressable } from '../Pressable'
import { Popover } from './Popover'
import type { Side } from './position'

export interface MenuItem {
  label: string
  icon?: ReactNode
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
  /** A quiet note at the end of the row (a key hint, a current value). */
  hint?: ReactNode
}

export interface MenuProps {
  trigger: (props: { onClick: () => void; 'aria-expanded': boolean; 'aria-haspopup': 'menu'; 'aria-controls': string | undefined }) => ReactNode
  items: MenuItem[]
  /** Which edge of the trigger the menu lines up with. */
  align?: 'left' | 'right'
  side?: Side
  /** The accessible name of the menu. */
  label?: string
}

export function Menu({ trigger, items, align = 'right', side = 'bottom', label }: MenuProps) {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()
  const typed = useRef({ text: '', at: 0 })

  const nodes = () => [...(panel.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
  const focusItem = (i: number) => nodes()[i]?.focus()

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const list = nodes()
    const current = list.indexOf(document.activeElement as HTMLElement)
    const to = rovingIndex(e.key, current, list.length, { vertical: true, disabled: (i) => !!items[i]?.disabled })
    if (to !== null) {
      e.preventDefault()
      focusItem(to)
      return
    }
    if (e.key === 'Tab') {
      setOpen(false)
      return
    }
    // Type-ahead: letters typed in quick succession spell the start of a label.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== ' ') {
      const now = Date.now()
      typed.current = { text: now - typed.current.at < 600 ? typed.current.text + e.key.toLowerCase() : e.key.toLowerCase(), at: now }
      const hit = items.findIndex((it, i) => !it.disabled && it.label.toLowerCase().startsWith(typed.current.text) && i !== current)
      const any = hit >= 0 ? hit : items.findIndex((it) => !it.disabled && it.label.toLowerCase().startsWith(typed.current.text))
      if (any >= 0) focusItem(any)
    }
  }

  return (
    <div className="relative" ref={anchor}>
      {trigger({ onClick: () => setOpen((o) => !o), 'aria-expanded': open, 'aria-haspopup': 'menu', 'aria-controls': open ? id : undefined })}
      <Popover open={open} onClose={() => setOpen(false)} anchor={anchor} panelRef={panel} role="menu" label={label} side={side} align={align === 'right' ? 'end' : 'start'} minWidth={192} className="p-1" focusOnOpen>
        <div id={id} onKeyDown={onKey}>
          {items.map((item, i) => (
            <Pressable
              key={item.label}
              role="menuitem"
              tabIndex={-1}
              disabled={item.disabled}
              // Focus lands on the first item rather than the panel, so the arrow keys work at once.
              data-autofocus={i === items.findIndex((it) => !it.disabled) ? '' : undefined}
              press="none"
              plain
              className="menu-item"
              data-danger={item.danger ? '' : undefined}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
            >
              {item.icon}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.hint && <span className="shrink-0 text-xs font-medium text-ink-3">{item.hint}</span>}
            </Pressable>
          ))}
        </div>
      </Popover>
    </div>
  )
}
