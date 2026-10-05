import { describe, expect, it } from 'vitest'
import { easeInOut, flight, isWheelNotch, type View } from './camera'

const centre = (v: View, w: number, h: number) => [(w / 2 - v.x) / v.k, (h / 2 - v.y) / v.k]

describe('flight', () => {
  const w = 400
  const h = 800
  const a: View = { k: 1, x: 0, y: 0 }
  const b: View = { k: 4, x: -1200, y: -2000 }

  it('starts and ends exactly at the given views', () => {
    const f = flight(a, b, w, h)
    expect(f.at(0)).toEqual(a)
    expect(f.at(1)).toEqual(b)
  })

  it('moves the centre monotonically towards the target', () => {
    const f = flight(a, b, w, h)
    const [tx] = centre(b, w, h)
    let prev = centre(a, w, h)[0]
    for (let i = 1; i <= 20; i++) {
      const [x] = centre(f.at(i / 20), w, h)
      expect(x).toBeGreaterThanOrEqual(prev - 1e-6)
      expect(x).toBeLessThanOrEqual(tx + 1e-6)
      prev = x
    }
  })

  it('zooms out mid-way on a long move', () => {
    const far: View = { k: 3, x: -6000, y: -300 }
    const start: View = { k: 3, x: 0, y: 0 }
    const f = flight(start, far, w, h)
    expect(f.at(0.5).k).toBeLessThan(3)
  })

  it('handles a pure zoom and scales duration with distance', () => {
    const f = flight(a, { k: 2, x: -200, y: -400 }, w, h)
    expect(f.at(0.5).k).toBeGreaterThan(1)
    expect(f.at(0.5).k).toBeLessThan(2)
    const short = flight(a, { k: 1, x: -20, y: 0 }, w, h).duration
    const long = flight(a, { k: 1, x: -4000, y: 0 }, w, h).duration
    expect(long).toBeGreaterThan(short)
    expect(long).toBeLessThanOrEqual(1500)
  })

  it('keeps a deep zoom near the chosen point without producing an invalid camera', () => {
    const start: View = { k: 9.6, x: -16820, y: -11240 }
    const target: View = { k: 10.2, x: -18010, y: -11930 }
    const f = flight(start, target, w, h, [340, 220])
    for (let i = 0; i <= 100; i++) {
      const view = f.at(i / 100)
      expect(Number.isFinite(view.k) && Number.isFinite(view.x) && Number.isFinite(view.y)).toBe(true)
      expect(view.k).toBeGreaterThan(0)
    }
  })
})

describe('input helpers', () => {
  it('eases symmetrically', () => {
    expect(easeInOut(0)).toBe(0)
    expect(easeInOut(1)).toBe(1)
    expect(easeInOut(0.5)).toBeCloseTo(0.5)
  })

  it('tells wheel notches from trackpad scrolls', () => {
    expect(isWheelNotch({ deltaMode: 1, deltaY: 3, ctrlKey: false })).toBe(true)
    expect(isWheelNotch({ deltaMode: 0, deltaY: 100, ctrlKey: false })).toBe(true)
    expect(isWheelNotch({ deltaMode: 0, deltaY: -120, ctrlKey: false })).toBe(true)
    expect(isWheelNotch({ deltaMode: 0, deltaY: 4.5, ctrlKey: false })).toBe(false)
    expect(isWheelNotch({ deltaMode: 0, deltaY: 12, ctrlKey: false })).toBe(false)
    expect(isWheelNotch({ deltaMode: 0, deltaY: 100, ctrlKey: true })).toBe(false)
  })
})
