// @vitest-environment happy-dom
/**
 * The primitives' contracts: roles, keyboard behaviour, disabled and loading,
 * one haptic per activation, and rows whose actions are not nested inside the
 * row's own control.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { haptics } from '@/services/haptics'
import { Button, Checkbox, Chip, Field, IconButton, ListRow, Progress, SearchField, SegmentedControl, Slider, Switch, SwitchRow, Tabs, TextInput } from './controls'
import { Pressable } from './Pressable'
import { rovingIndex } from './selection'

beforeEach(() => {
  vi.spyOn(haptics, 'tap').mockImplementation(() => {})
  vi.spyOn(haptics, 'press').mockImplementation(() => {})
  vi.spyOn(haptics, 'success').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Pressable and Button', () => {
  it('is a native button, so Enter and Space activate it, and a click runs the action with one haptic', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button.tagName).toBe('BUTTON')
    expect(button.getAttribute('type')).toBe('button')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(haptics.tap).toHaveBeenCalledTimes(1)
  })

  it('does nothing while disabled or loading, and says it is busy', () => {
    const onClick = vi.fn()
    const { rerender } = render(
      <Button onClick={onClick} disabled>
        Save
      </Button>,
    )
    fireEvent.click(screen.getByRole('button'))
    rerender(
      <Button onClick={onClick} loading>
        Save
      </Button>,
    )
    const busy = screen.getByRole('button')
    fireEvent.click(busy)
    expect(onClick).not.toHaveBeenCalled()
    expect(busy.getAttribute('aria-busy')).toBe('true')
    expect((busy as HTMLButtonElement).disabled).toBe(true)
  })

  it('plays the haptic it is given, or none', () => {
    render(
      <>
        <Pressable haptic="press">Hold</Pressable>
        <Pressable haptic="none">Quiet</Pressable>
      </>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Hold' }))
    fireEvent.click(screen.getByRole('button', { name: 'Quiet' }))
    expect(haptics.press).toHaveBeenCalledTimes(1)
    expect(haptics.tap).not.toHaveBeenCalled()
  })

  it('carries a state layer and, as a link, an href', () => {
    render(<Pressable href="#/home">Home</Pressable>)
    const link = screen.getByRole('link', { name: 'Home' })
    expect(link.getAttribute('href')).toBe('#/home')
    expect(link.querySelector('.pressable-state')).not.toBeNull()
  })

  it('names an icon button by its label', () => {
    render(
      <IconButton label="Sounds">
        <svg />
      </IconButton>,
    )
    expect(screen.getByRole('button', { name: 'Sounds' })).toBeTruthy()
  })

  it('renders a chip as text, or as a pressed button when it can be chosen', () => {
    const onClick = vi.fn()
    render(
      <>
        <Chip>Plain</Chip>
        <Chip onClick={onClick} active>
          Rivers
        </Chip>
      </>,
    )
    expect(screen.queryByRole('button', { name: 'Plain' })).toBeNull()
    const chip = screen.getByRole('button', { name: 'Rivers' })
    expect(chip.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(chip)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('roving focus', () => {
  it('moves with the arrows, wraps, and skips disabled items', () => {
    expect(rovingIndex('ArrowRight', 0, 3)).toBe(1)
    expect(rovingIndex('ArrowRight', 2, 3)).toBe(0)
    expect(rovingIndex('ArrowLeft', 0, 3)).toBe(2)
    expect(rovingIndex('ArrowRight', 0, 3, { disabled: (i) => i === 1 })).toBe(2)
    expect(rovingIndex('Home', 2, 3)).toBe(0)
    expect(rovingIndex('End', 0, 3)).toBe(2)
    expect(rovingIndex('ArrowDown', 0, 3)).toBeNull()
    expect(rovingIndex('ArrowDown', 0, 3, { vertical: true })).toBe(1)
    expect(rovingIndex('a', 0, 3)).toBeNull()
  })
})

describe('Tabs', () => {
  const items = [
    { id: 'today', label: 'Today' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'done', label: 'Done' },
  ]

  it('is a tablist with one selected tab in the tab order', () => {
    render(<Tabs label="Plan views" items={items} value="upcoming" onChange={() => {}} />)
    expect(screen.getByRole('tablist', { name: 'Plan views' })).toBeTruthy()
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false'])
    expect(tabs.map((t) => t.tabIndex)).toEqual([-1, 0, -1])
  })

  it('moves with the arrow keys, Home and End', () => {
    const onChange = vi.fn()
    render(<Tabs label="Plan views" items={items} value="today" onChange={onChange} />)
    const list = screen.getByRole('tablist')
    fireEvent.keyDown(list, { key: 'ArrowRight' })
    fireEvent.keyDown(list, { key: 'ArrowLeft' })
    fireEvent.keyDown(list, { key: 'End' })
    fireEvent.keyDown(list, { key: 'Home' })
    expect(onChange.mock.calls.map((c) => c[0])).toEqual(['upcoming', 'done', 'done', 'today'])
  })

  it('as navigation, marks the current place instead of selecting a tab', () => {
    render(<Tabs kind="nav" label="Plan views" items={items} value="done" onChange={() => {}} />)
    expect(screen.getByRole('navigation', { name: 'Plan views' })).toBeTruthy()
    expect(screen.queryByRole('tab')).toBeNull()
    expect(screen.getByRole('button', { name: 'Done' }).getAttribute('aria-current')).toBe('page')
  })
})

describe('SegmentedControl', () => {
  const options = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
  ]
  it('is a radio group whose arrows change the choice', () => {
    const onChange = vi.fn()
    render(<SegmentedControl label="Range" options={options} value="day" onChange={onChange} />)
    const group = screen.getByRole('radiogroup', { name: 'Range' })
    expect(screen.getAllByRole('radio').map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false'])
    fireEvent.keyDown(group, { key: 'ArrowRight' })
    expect(onChange).toHaveBeenCalledWith('week')
  })
})

describe('Switch and Checkbox', () => {
  it('flips a switch on a click and reports its state', () => {
    const onChange = vi.fn()
    render(<Switch checked={false} onChange={onChange} label="Keep awake" />)
    const sw = screen.getByRole('switch', { name: 'Keep awake' })
    expect(sw.getAttribute('aria-checked')).toBe('false')
    fireEvent.click(sw)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('names a switch row by its title', () => {
    render(<SwitchRow title="Haptics" description="Vibrations on supported devices." checked onChange={() => {}} />)
    expect(screen.getByRole('switch', { name: 'Haptics' })).toBeTruthy()
  })

  it('ticks a checkbox and stops the click reaching the row behind it', () => {
    const onChange = vi.fn()
    const onRow = vi.fn()
    render(
      // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- a stand-in for a row
      <div onClick={onRow}>
        <Checkbox checked={false} onChange={onChange} label="Complete “Polity”" />
      </div>,
    )
    fireEvent.click(screen.getByRole('checkbox', { name: 'Complete “Polity”' }))
    expect(onChange).toHaveBeenCalledWith(true)
    expect(onRow).not.toHaveBeenCalled()
    expect(haptics.success).toHaveBeenCalledTimes(1)
  })
})

describe('ListRow', () => {
  it('keeps its actions beside the row’s own button, never inside it', () => {
    const open = vi.fn()
    const play = vi.fn()
    render(
      <ListRow
        title="Polity revision"
        onClick={open}
        actions={
          <IconButton label="Focus on this" onClick={play}>
            <svg />
          </IconButton>
        }
      />,
    )
    const row = screen.getByRole('button', { name: 'Polity revision' })
    const action = screen.getByRole('button', { name: 'Focus on this' })
    expect(row.contains(action)).toBe(false)
    fireEvent.click(action)
    expect(play).toHaveBeenCalledTimes(1)
    expect(open).not.toHaveBeenCalled()
    fireEvent.click(row)
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('is plain content when it has nothing to open', () => {
    render(<ListRow title="Just text" meta="A second line" />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('A second line')).toBeTruthy()
  })
})

describe('Fields', () => {
  it('labels the control it wraps', () => {
    render(
      <Field label="Title" hint="Short and specific.">
        <TextInput />
      </Field>,
    )
    expect(screen.getByLabelText(/Title/)).toBeTruthy()
  })

  it('offers to clear a search once there is text', () => {
    const onChange = vi.fn()
    const { rerender } = render(<SearchField label="Search places" value="" onChange={onChange} shortcut="/" />)
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search places' }), { target: { value: 'ganga' } })
    expect(onChange).toHaveBeenCalledWith('ganga')
    rerender(<SearchField label="Search places" value="ganga" onChange={onChange} shortcut="/" />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear search' }))
    expect(onChange).toHaveBeenLastCalledWith('')
  })

  it('is a named slider that reports its value', () => {
    const onChange = vi.fn()
    render(<Slider label="Volume" value={0.4} onChange={onChange} valueLabel="40%" />)
    const slider = screen.getByRole('slider', { name: 'Volume' })
    expect(slider.getAttribute('aria-valuetext')).toBe('40%')
    fireEvent.change(slider, { target: { value: '0.7' } })
    expect(onChange).toHaveBeenCalledWith(0.7)
  })
})

describe('Progress', () => {
  it('announces its value in every variant', () => {
    render(
      <>
        <Progress label="Daily goal" value={0.5} />
        <Progress label="Sessions" variant="segments" value={0.5} count={4} valueText="2 of 4" />
        <Progress label="Ring" variant="ring" value={1.4} />
      </>,
    )
    expect(screen.getByRole('progressbar', { name: 'Daily goal' }).getAttribute('aria-valuenow')).toBe('50')
    expect(screen.getByRole('progressbar', { name: 'Sessions' }).getAttribute('aria-valuetext')).toBe('2 of 4')
    // Out-of-range values are clamped rather than announced as 140%.
    expect(screen.getByRole('progressbar', { name: 'Ring' }).getAttribute('aria-valuenow')).toBe('100')
  })
})
