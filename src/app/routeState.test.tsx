// @vitest-environment happy-dom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { clearRouteState, onRouteReset, peekRouteState, rememberScroll, resetRoute, scrollFor, useRouteState } from './routeState'

function Counter({ id, start = 0 }: { id: string; start?: number | (() => number) }) {
  const [n, setN] = useRouteState(id, start)
  return (
    <button type="button" onClick={() => setN((v) => v + 1)}>
      {id}={n}
    </button>
  )
}

afterEach(() => {
  cleanup()
  clearRouteState()
})

describe('useRouteState', () => {
  it('keeps its value across unmount and remount', () => {
    const first = render(<Counter id="atlas:n" />)
    act(() => screen.getByRole('button').click())
    act(() => screen.getByRole('button').click())
    expect(screen.getByRole('button').textContent).toBe('atlas:n=2')
    first.unmount()
    render(<Counter id="atlas:n" />)
    expect(screen.getByRole('button').textContent).toBe('atlas:n=2')
    expect(peekRouteState('atlas:n')).toBe(2)
  })

  it('keeps two components on the same key in step, and different keys apart', () => {
    render(
      <>
        <Counter id="current-affairs:a" />
        <Counter id="current-affairs:a" />
        <Counter id="current-affairs:b" start={10} />
      </>,
    )
    const [one, two, other] = screen.getAllByRole('button')
    act(() => one.click())
    expect(one.textContent).toBe('current-affairs:a=1')
    expect(two.textContent).toBe('current-affairs:a=1')
    expect(other.textContent).toBe('current-affairs:b=10')
  })

  it('resetting a route returns its state to the defaults, live, and leaves other routes alone', () => {
    let seeds = 0
    render(
      <>
        <Counter id="settings:filter" start={() => 5 + seeds++ * 0} />
        <Counter id="atlas:view" />
      </>,
    )
    const [settings, atlas] = screen.getAllByRole('button')
    act(() => settings.click())
    act(() => atlas.click())
    rememberScroll('settings', 480)
    rememberScroll('atlas', 120)
    const seen: string[] = []
    const off = onRouteReset((r) => seen.push(r))
    act(() => resetRoute('settings'))
    off()
    expect(settings.textContent).toBe('settings:filter=5')
    expect(atlas.textContent).toBe('atlas:view=1')
    expect(scrollFor('settings')).toBe(0)
    expect(scrollFor('atlas')).toBe(120)
    expect(seen).toEqual(['settings'])
    // The lazy default was computed once per mount, not again on reset.
    expect(seeds).toBe(1)
  })

  it('a route name that is a prefix of another does not reset it', () => {
    render(
      <>
        <Counter id="atlas:view" />
        <Counter id="atlas-archive:view" />
      </>,
    )
    const [a, b] = screen.getAllByRole('button')
    act(() => a.click())
    act(() => b.click())
    act(() => resetRoute('atlas'))
    expect(a.textContent).toBe('atlas:view=0')
    expect(b.textContent).toBe('atlas-archive:view=1')
  })
})
