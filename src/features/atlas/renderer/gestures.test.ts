// @vitest-environment happy-dom
/** Real input sequences against the controller, using a deterministic frame clock and a camera port. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { attachGestures, type GestureTargets } from './gestures'
import type { Transform } from '../labels'

vi.mock('@/lib/motion', () => ({ prefersReducedMotion: () => false }))

let dispose: () => void
beforeEach(() => vi.useFakeTimers())
afterEach(() => { dispose?.(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })

function fixture() {
  let now = 1000
  let id = 0
  let animation = 0
  const frames = new Map<number, FrameRequestCallback>()
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++id, cb); return id })
  vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key))
  const el = document.createElement('div')
  Object.defineProperty(el, 'setPointerCapture', { value: vi.fn() })
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 400, 800))
  const t = { current: { k: 2, x: -200, y: -400 } }
  const clampT = (n: Transform) => ({ k: Math.max(0.5, Math.min(7, n.k)), x: Math.max(-2000, Math.min(0, n.x)), y: Math.max(-4000, Math.min(0, n.y)) })
  const setT = vi.fn((n: Transform) => { t.current = clampT(n) })
  const animateTo = vi.fn((n: Transform) => setT(n))
  const camera: Parameters<typeof attachGestures>[1] = {
    t, labelLayer: { current: null }, size: { current: { w: 400, h: 800, m: 0, o: 0 } },
    moving: { current: false }, holding: { current: false }, inputPending: { current: false }, lastInput: { current: 0 },
    limits: () => ({ min: 0.5, max: 7 }), clampT, softK: (k) => k, setT, animateTo,
    nextFrame: (cb) => { animation = requestAnimationFrame(cb) }, cancelAnim: () => cancelAnimationFrame(animation), settle: vi.fn(),
  }
  const select = vi.fn()
  const targets: GestureTargets = {
    symbolRef: { current: () => null }, tapRef: { current: (x, y) => ({ type: 'point', x, y }) },
    selectRef: { current: select }, instantRef: { current: false }, hoverRef: { current: vi.fn() },
  }
  dispose = attachGestures(el, camera, targets)
  const advance = (ms = 16) => {
    now += ms
    vi.advanceTimersByTime(ms)
    const pending = [...frames.values()]
    frames.clear()
    for (const cb of pending) cb(now)
  }
  const pointer = (type: string, pointerId: number, x: number, y: number) => {
    const event = new PointerEvent(type, { pointerId, pointerType: 'touch', clientX: x, clientY: y, bubbles: true })
    Object.defineProperty(event, 'timeStamp', { value: now })
    el.dispatchEvent(event)
  }
  const wheel = (deltaY: number, ctrlKey = false) => {
    const event = new WheelEvent('wheel', { deltaY, ctrlKey, clientX: 200, clientY: 400, cancelable: true })
    // happy-dom does not copy the inherited MouseEventInit fields.
    Object.defineProperties(event, { ctrlKey: { value: ctrlKey }, clientX: { value: 200 }, clientY: { value: 400 } })
    Object.defineProperty(event, 'timeStamp', { value: now })
    el.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
  }
  const tap = () => { pointer('pointerdown', 1, 200, 400); advance(20); pointer('pointerup', 1, 200, 400) }
  return { el, camera, targets, t, select, advance, pointer, wheel, tap, frames, setT, animateTo }
}

describe('checkpoint gesture sequences', () => {
  it('batches a pan into one frame and commits the final position on release', () => {
    const f = fixture()
    f.pointer('pointerdown', 1, 200, 400)
    f.pointer('pointermove', 1, 180, 380)
    f.pointer('pointermove', 1, 150, 350)
    expect(f.setT).not.toHaveBeenCalled()
    f.advance()
    expect(f.t.current).toEqual({ k: 2, x: -250, y: -450 })
    f.advance(100)
    f.pointer('pointerup', 1, 150, 350)
    expect(f.camera.holding.current).toBe(false)
    expect(f.camera.settle).toHaveBeenCalled()
  })

  it('flings from recent movement and stops when the finger rested before release', () => {
    const f = fixture()
    f.pointer('pointerdown', 1, 200, 400)
    f.advance(20)
    f.pointer('pointermove', 1, 160, 400)
    f.advance(20)
    f.pointer('pointermove', 1, 120, 400)
    f.advance(16)
    f.pointer('pointerup', 1, 120, 400)
    const released = f.t.current.x
    f.advance(16)
    expect(f.t.current.x).toBeLessThan(released)
    for (let i = 0; i < 160; i++) f.advance()
    expect(f.camera.settle).toHaveBeenCalled()
  })

  it('pinches around the world point under the fingers', () => {
    const f = fixture()
    f.pointer('pointerdown', 1, 150, 400)
    f.pointer('pointerdown', 2, 250, 400)
    f.pointer('pointermove', 1, 100, 400)
    f.pointer('pointermove', 2, 300, 400)
    f.advance()
    expect(f.t.current).toEqual({ k: 4, x: -600, y: -1200 })
    expect((200 - f.t.current.x) / f.t.current.k).toBe(200)
  })

  it('hands a pinch to the remaining finger without a camera jump', () => {
    const f = fixture()
    f.pointer('pointerdown', 1, 150, 400)
    f.pointer('pointerdown', 2, 250, 400)
    f.pointer('pointermove', 1, 100, 400)
    f.pointer('pointermove', 2, 300, 400)
    f.advance()
    const before = { ...f.t.current }
    f.pointer('pointerup', 2, 300, 400)
    expect(f.t.current).toEqual(before)
    f.pointer('pointermove', 1, 80, 410)
    f.advance()
    expect(f.t.current).toEqual({ k: 4, x: before.x - 20, y: before.y + 10 })
  })

  it('eases accumulated mouse-wheel notches over several frames', () => {
    const f = fixture()
    f.wheel(-100)
    expect(f.t.current.k).toBe(2)
    f.advance()
    const first = f.t.current.k
    expect(first).toBeGreaterThan(2)
    expect(first).toBeLessThan(2 * Math.exp(0.22))
    f.wheel(-100)
    for (let i = 0; i < 50; i++) f.advance()
    expect(f.t.current.k).toBeCloseTo(2 * Math.exp(0.44), 8)
  })

  it('applies trackpad zoom directly, batching deltas around the cursor', () => {
    const f = fixture()
    f.wheel(-10, true)
    f.wheel(-10, true)
    f.advance()
    expect(f.setT).toHaveBeenCalledTimes(1)
    expect(f.t.current.k).toBeCloseTo(2 * Math.exp(0.2))
    expect((200 - f.t.current.x) / f.t.current.k).toBeCloseTo(200)
  })

  it('double-taps zoom and cancel the pending single-tap selection', () => {
    const f = fixture()
    f.tap()
    f.advance(120)
    f.tap()
    f.advance(300)
    expect(f.t.current.k).toBe(4)
    expect(f.select).not.toHaveBeenCalled()
  })

  it('two-finger taps zoom out and a moved pinch does not become a tap', () => {
    const f = fixture()
    f.pointer('pointerdown', 1, 170, 400)
    f.pointer('pointerdown', 2, 230, 400)
    f.advance(60)
    f.pointer('pointerup', 1, 170, 400)
    f.pointer('pointerup', 2, 230, 400)
    expect(f.t.current.k).toBe(1)
    expect(f.animateTo).toHaveBeenCalledTimes(1)
    f.pointer('pointerdown', 1, 170, 400)
    f.pointer('pointerdown', 2, 230, 400)
    f.pointer('pointermove', 2, 270, 400)
    f.advance()
    f.pointer('pointerup', 1, 170, 400)
    f.pointer('pointerup', 2, 270, 400)
    expect(f.animateTo).toHaveBeenCalledTimes(1)
  })

  it('keyboard pans and zooms only when the map itself has focus', () => {
    const f = fixture()
    const key = (k: string) => f.el.dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true }))
    key('ArrowRight')
    expect(f.t.current.x).toBe(-290)
    key('+')
    expect(f.t.current.k).toBeCloseTo(3.2)
    const child = document.createElement('button')
    f.el.append(child)
    child.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(f.animateTo).toHaveBeenCalledTimes(2)
  })

  it('detach clears queued input, hover and delayed selection and removes listeners', () => {
    const f = fixture()
    f.tap()
    f.wheel(-10, true)
    dispose()
    f.advance(500)
    expect(f.select).not.toHaveBeenCalled()
    expect(f.camera.inputPending.current).toBe(false)
    f.pointer('pointerdown', 1, 200, 400)
    expect(f.camera.holding.current).toBe(false)
    expect(f.frames.size).toBe(0)
  })
})
