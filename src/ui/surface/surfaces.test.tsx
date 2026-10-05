// @vitest-environment happy-dom
/**
 * Layered surfaces: where focus goes, what Escape and an outside press do, and
 * what the page behind a modal is allowed to do.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useRef, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { haptics } from '@/services/haptics'
import { Button } from '../controls'
import { anyLayerOpen, anyModalOpen } from './core'
import { Dialog } from './Dialog'
import { Menu } from './Menu'
import { Popover } from './Popover'
import { place } from './position'
import { Tooltip } from './Tooltip'

beforeEach(() => {
  vi.spyOn(haptics, 'tap').mockImplementation(() => {})
  document.body.innerHTML = '<div id="root"></div>'
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const mount = (ui: React.ReactElement) => render(ui, { container: document.getElementById('root')! })

function DialogHost({ onClosed }: { onClosed?: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open</Button>
      <Dialog
        open={open}
        onClose={() => {
          setOpen(false)
          onClosed?.()
        }}
        title="Rename project"
        footer={<Button data-autofocus>Save</Button>}
      >
        <input aria-label="Name" />
      </Dialog>
    </>
  )
}

describe('Dialog', () => {
  it('moves focus in, makes the page behind inert, and gives focus back on Escape', () => {
    const closed = vi.fn()
    mount(<DialogHost onClosed={closed} />)
    const opener = screen.getByRole('button', { name: 'Open' })
    opener.focus()
    fireEvent.click(opener)

    const dialog = screen.getByRole('dialog', { name: 'Rename project' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Save' }))
    expect(document.getElementById('root')!.inert).toBe(true)
    expect(anyModalOpen()).toBe(true)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(closed).toHaveBeenCalledTimes(1)
    expect(document.getElementById('root')!.inert).toBe(false)
    expect(anyLayerOpen()).toBe(false)
    expect(document.activeElement).toBe(opener)
  })

  it('keeps Tab inside the dialog', () => {
    mount(<DialogHost />)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    const save = screen.getByRole('button', { name: 'Save' })
    const close = screen.getByRole('button', { name: 'Close' })
    save.focus()
    // Save is the last control: Tab wraps to the first one, the close button.
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(save)
  })

  it('closes on a press that starts on the backdrop, not on one that ends there', () => {
    const closed = vi.fn()
    mount(<DialogHost onClosed={closed} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    const backdrop = document.querySelector('.surface-backdrop')!
    // The tail of the click that opened the dialog lands on the new backdrop: ignored.
    fireEvent.click(backdrop)
    expect(closed).not.toHaveBeenCalled()
    fireEvent.pointerDown(backdrop)
    fireEvent.click(backdrop)
    expect(closed).toHaveBeenCalledTimes(1)
  })
})

function MenuHost({ onRename, onDelete }: { onRename: () => void; onDelete: () => void }) {
  return (
    <Menu
      label="Project actions"
      trigger={(p) => <Button {...p}>Actions</Button>}
      items={[
        { label: 'Rename', onSelect: onRename },
        { label: 'Archive', onSelect: () => {}, disabled: true },
        { label: 'Delete', onSelect: onDelete, danger: true },
      ]}
    />
  )
}

describe('Menu', () => {
  beforeEach(() => {
    // happy-dom lays nothing out; give the anchor a place so the menu can be positioned.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 100, top: 100, width: 80, height: 32, right: 180, bottom: 132, x: 100, y: 100, toJSON: () => ({}) })
  })

  it('opens with focus on its first item and moves with the arrows, skipping what is disabled', () => {
    mount(<MenuHost onRename={() => {}} onDelete={() => {}} />)
    const trigger = screen.getByRole('button', { name: 'Actions' })
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    const menu = screen.getByRole('menu', { name: 'Project actions' })
    const items = screen.getAllByRole('menuitem')
    expect(document.activeElement).toBe(items[0])
    fireEvent.keyDown(items[0], { key: 'ArrowDown' })
    expect(document.activeElement).toBe(items[2])
    fireEvent.keyDown(items[2], { key: 'Home' })
    expect(document.activeElement).toBe(items[0])
    expect(menu.contains(document.activeElement)).toBe(true)
  })

  it('jumps to an item by its first letter', () => {
    mount(<MenuHost onRename={() => {}} onDelete={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Actions' }))
    const items = screen.getAllByRole('menuitem')
    fireEvent.keyDown(items[0], { key: 'd' })
    expect(document.activeElement).toBe(items[2])
  })

  it('runs the chosen item and closes; Escape closes and returns focus', () => {
    const rename = vi.fn()
    mount(<MenuHost onRename={rename} onDelete={() => {}} />)
    const trigger = screen.getByRole('button', { name: 'Actions' })
    trigger.focus()
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }))
    expect(rename).toHaveBeenCalledTimes(1)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(trigger)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
  })
})

function PopoverHost() {
  const [open, setOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)
  return (
    <>
      <Button ref={anchor} onClick={() => setOpen((o) => !o)}>
        Filters
      </Button>
      <button type="button">Elsewhere</button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={anchor} label="Filters">
        <button type="button">Only saved</button>
      </Popover>
    </>
  )
}

describe('Popover', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 40, top: 40, width: 80, height: 32, right: 120, bottom: 72, x: 40, y: 40, toJSON: () => ({}) })
  })

  it('closes on a press outside it, but not on a press inside or on its own trigger', () => {
    mount(<PopoverHost />)
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeTruthy()
    // It is not modal: the page behind stays live.
    expect(document.getElementById('root')!.inert).toBe(false)
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Only saved' }))
    expect(screen.queryByRole('dialog', { name: 'Filters' })).not.toBeNull()
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Elsewhere' }))
    expect(anyLayerOpen()).toBe(false)
  })
})

describe('placement', () => {
  const viewport = { width: 400, height: 600 }
  it('sits below its anchor, and flips above when there is no room below', () => {
    expect(place({ left: 20, top: 40, width: 80, height: 30 }, { width: 200, height: 200 }, viewport).side).toBe('bottom')
    expect(place({ left: 20, top: 540, width: 80, height: 30 }, { width: 200, height: 200 }, viewport).side).toBe('top')
  })
  it('shifts sideways to stay on screen', () => {
    const p = place({ left: 360, top: 40, width: 30, height: 30 }, { width: 200, height: 100 }, viewport)
    expect(p.left + 200).toBeLessThanOrEqual(viewport.width - 8)
  })
})

describe('Tooltip', () => {
  it('waits before showing on hover, never shows for touch, and adds no wrapper element', () => {
    vi.useFakeTimers()
    const { container } = mount(
      <Tooltip label="Sounds" shortcut="S">
        <button type="button">♪</button>
      </Tooltip>,
    )
    const button = screen.getByRole('button')
    expect(container.firstElementChild).toBe(button)

    fireEvent.pointerEnter(button, { pointerType: 'touch' })
    act(() => void vi.advanceTimersByTime(600))
    expect(screen.queryByRole('tooltip')).toBeNull()

    fireEvent.pointerEnter(button, { pointerType: 'mouse' })
    act(() => void vi.advanceTimersByTime(200))
    expect(screen.queryByRole('tooltip')).toBeNull()
    act(() => void vi.advanceTimersByTime(250))
    expect(screen.getByRole('tooltip').textContent).toContain('Sounds')
    fireEvent.pointerLeave(button)
  })
})
