/** The checkpoint gesture controller extracted intact, with attach/detach lifetime independent of React. */
import { prefersReducedMotion } from '@/lib/motion'
import { easeOut, isWheelNotch } from '../camera'
import type { MapTarget } from './types'
import type { MapCamera } from './useMapCamera'
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const SPRING_BACK_MS = 320
/** Momentum decay time constant (ms) and the fastest fling we accept (px/ms). */
const GLIDE_TAU = 300
const MAX_FLING = 3.5
/** Mouse-wheel notches ease towards their target zoom with this time constant (ms). */
const WHEEL_TAU = 65
/** Zoom per pixel of wheel delta (a 100 px notch ≈ ×1.25). */
const WHEEL_RATE = 0.0022
/** Double-tap zoom and its animation. */
const TAP_ZOOM = 2
const TAP_ZOOM_MS = 300
type Current<T> = { current: T }
export interface GestureTargets {
  symbolRef: Current<(x: number, y: number) => string | null>
  tapRef: Current<(x: number, y: number) => MapTarget>
  selectRef: Current<((target: MapTarget) => void) | undefined>
  instantRef: Current<boolean | undefined>
  hoverRef: Current<(x: number, y: number) => void>
}
export function attachGestures(el: HTMLDivElement, camera: Pick<MapCamera, 'labelLayer' | 't' | 'size' | 'moving' | 'holding' | 'inputPending' | 'lastInput' | 'nextFrame' | 'cancelAnim' | 'limits' | 'clampT' | 'softK' | 'setT' | 'settle' | 'animateTo'>, targets: GestureTargets) {
  const { labelLayer, t, size, moving, holding, inputPending, lastInput, nextFrame, cancelAnim, limits, clampT, softK, setT, settle, animateTo } = camera
  const { symbolRef, tapRef, selectRef, instantRef, hoverRef } = targets
  const pointers = new Map<number, { x: number; y: number }>()
  let rect = el.getBoundingClientRect()
  /** Pan anchor: where the finger went down and the view at that moment. */
  let pan: { x: number; y: number; tx: number; ty: number } | null = null
  let pinch: { dist: number; k: number; wx: number; wy: number; cx: number; cy: number } | null = null
  let tap: { x: number; y: number; time: number } | null = null
  /** Two fingers down together and lifted without moving: zoom out (as in other map apps). */
  let twoTap: { time: number; moved: boolean; cx: number; cy: number } | null = null
  let moved = false
  let samples: Array<{ x: number; y: number; t: number }> = []
  let zoomSamples: Array<{ k: number; t: number; cx: number; cy: number }> = []
  let wheel: { f: number; x: number; y: number } | null = null
  /** A mouse-wheel zoom easing towards `target` around the cursor. */
  let wheelTo: { target: number; fx: number; fy: number; last: number } | null = null
  let lastWheel = 0
  let frame = 0
  let lastTap = 0
  let hoverFrame = 0
  let pendingTap: ReturnType<typeof setTimeout> | undefined
  let hoverAt: { x: number; y: number } | null = null
  /** The symbol under the finger, shown pressed from the moment of contact. */
  let pressed: Element | null = null
  const press = (id: string | null) => {
    pressed?.classList.remove('is-pressed')
    pressed = id ? (labelLayer.current?.querySelector(`[data-place="${CSS.escape(id)}"]`) ?? null) : null
    pressed?.classList.add('is-pressed')
  }

  const local = (e: PointerEvent | WheelEvent | MouseEvent) => ({ x: e.clientX - rect.left, y: e.clientY - rect.top })
  const stopMotion = () => {
    cancelAnim()
    wheelTo = null
  }

  const flush = () => {
    frame = 0
    inputPending.current = false
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()]
      const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
      const cx = (a.x + b.x) / 2
      const cy = (a.y + b.y) / 2
      if (twoTap && (Math.abs(dist - pinch.dist) > 12 || Math.hypot(cx - pinch.cx, cy - pinch.cy) > 12)) twoTap.moved = true
      const k = softK(pinch.k * (dist / pinch.dist))
      setT({ k, x: cx - pinch.wx * k, y: cy - pinch.wy * k }, 'soft')
      zoomSamples.push({ k: t.current.k, t: performance.now(), cx, cy })
      if (zoomSamples.length > 10) zoomSamples.shift()
    } else if (pan && moved && pointers.size === 1) {
      const p = pointers.values().next().value!
      setT({ k: t.current.k, x: pan.tx + (p.x - pan.x), y: pan.ty + (p.y - pan.y) }, 'soft')
    }
    if (wheel) {
      const { f, x, y } = wheel
      wheel = null
      const cur = t.current
      const { min, max } = limits()
      const k = clamp(cur.k * f, min, max)
      const wx = (x - cur.x) / cur.k
      const wy = (y - cur.y) / cur.k
      setT({ k, x: x - wx * k, y: y - wy * k })
    }
  }
  const request = () => {
    inputPending.current = true
    if (!frame) frame = requestAnimationFrame(flush)
  }

  const startPinch = () => {
    const [a, b] = [...pointers.values()]
    const cx = (a.x + b.x) / 2
    const cy = (a.y + b.y) / 2
    const cur = t.current
    pinch = { dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), k: cur.k, wx: (cx - cur.x) / cur.k, wy: (cy - cur.y) / cur.k, cx, cy }
    zoomSamples = []
  }

  const onDown = (e: PointerEvent) => {
    if ((e.target as Element).closest('[data-map-ui]')) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    stopMotion()
    el.setPointerCapture(e.pointerId)
    rect = el.getBoundingClientRect()
    const p = local(e)
    pointers.set(e.pointerId, p)
    holding.current = true
    if (pointers.size === 1) {
      pan = { x: p.x, y: p.y, tx: t.current.x, ty: t.current.y }
      // Taps are timed by when the input happened (the event's own timestamp), not by when the page got round to
      // handling it: a busy frame between two taps must not turn a double tap into two single ones.
      tap = { ...p, time: e.timeStamp }
      moved = false
      samples = [{ ...p, t: e.timeStamp }]
      twoTap = null
      press(symbolRef.current((p.x - t.current.x) / t.current.k, (p.y - t.current.y) / t.current.k))
    } else if (pointers.size === 2) {
      press(null)
      startPinch()
      twoTap = tap && pinch && e.timeStamp - tap.time < 250 ? { time: e.timeStamp, moved: false, cx: pinch.cx, cy: pinch.cy } : null
      moved = true
      tap = null
    }
  }

  const onMove = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) {
      // Hover (mouse, no buttons): show what a click would open.
      if (e.pointerType === 'mouse' && !e.buttons) {
        hoverAt = local(e)
        if (!hoverFrame)
          hoverFrame = requestAnimationFrame(() => {
            hoverFrame = 0
            if (hoverAt && !moving.current) hoverRef.current(hoverAt.x, hoverAt.y)
          })
      }
      return
    }
    const p = local(e)
    pointers.set(e.pointerId, p)
    if (pointers.size === 1) {
      if (!moved && tap && Math.hypot(p.x - tap.x, p.y - tap.y) > 6) {
        moved = true
        press(null)
      }
      samples.push({ ...p, t: e.timeStamp })
      if (samples.length > 12) samples.shift()
    }
    if (moved) request()
  }

  /** Release velocity (px/ms) from the last ~80 ms of movement; zero if the finger rested first. */
  const velocity = (upAt: number) => {
    const last = samples[samples.length - 1]
    if (!last || upAt - last.t > 60) return { x: 0, y: 0 }
    const first = samples.find((s) => last.t - s.t <= 80) ?? samples[0]
    const dt = last.t - first.t
    if (dt < 8) return { x: 0, y: 0 }
    const v = { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt }
    const speed = Math.hypot(v.x, v.y)
    return speed > MAX_FLING ? { x: (v.x / speed) * MAX_FLING, y: (v.y / speed) * MAX_FLING } : v
  }

  const glide = (v: { x: number; y: number }) => {
    let { x: vx, y: vy } = v
    let prev = performance.now()
    const step = (now: number) => {
      const dt = Math.min(48, Math.max(1, now - prev))
      prev = now
      const before = t.current
      setT({ k: before.k, x: before.x + vx * dt, y: before.y + vy * dt })
      // Stop along an axis that ran into the edge.
      if (t.current.x === before.x) vx = 0
      if (t.current.y === before.y) vy = 0
      const decay = Math.exp(-dt / GLIDE_TAU)
      vx *= decay
      vy *= decay
      if (Math.hypot(vx, vy) > 0.02) nextFrame(step)
      else settle()
    }
    nextFrame(step)
  }

  /** Zoom momentum after a quick pinch: the scale keeps changing briefly around the fingers' last centre. */
  const zoomGlide = () => {
    const last = zoomSamples[zoomSamples.length - 1]
    const first = last && zoomSamples.find((s) => last.t - s.t <= 90)
    if (!last || !first || last.t - first.t < 12 || performance.now() - last.t > 60 || prefersReducedMotion()) return false
    let v = Math.log(last.k / first.k) / (last.t - first.t) // ln(scale) per ms
    if (Math.abs(v) < 0.0012) return false
    v = Math.max(-0.006, Math.min(0.006, v))
    let prev = performance.now()
    const step = (now: number) => {
      const dt = Math.min(48, Math.max(1, now - prev))
      prev = now
      const cur = t.current
      const { min, max } = limits()
      const k = clamp(cur.k * Math.exp(v * dt), min, max)
      const wx = (last.cx - cur.x) / cur.k
      const wy = (last.cy - cur.y) / cur.k
      setT({ k, x: last.cx - wx * k, y: last.cy - wy * k })
      v *= Math.exp(-dt / 140)
      if (Math.abs(v) > 0.00015 && t.current.k !== cur.k) nextFrame(step)
      else settle()
    }
    nextFrame(step)
    return true
  }

  const zoomAround = (x: number, y: number, f: number) => {
    const cur = t.current
    const wx = (x - cur.x) / cur.k
    const wy = (y - cur.y) / cur.k
    const { min, max } = limits()
    const k = clamp(cur.k * f, min, max)
    animateTo({ k, x: x - wx * k, y: y - wy * k }, { ms: TAP_ZOOM_MS, ease: easeOut, focus: [x, y] })
  }

  /** Was the view pulled past a bound? Then let it spring back (or, under reduced motion, it never left). */
  const springBack = () => {
    const from = { ...t.current }
    const to = clampT(from)
    if (Math.abs(to.x - from.x) < 0.5 && Math.abs(to.y - from.y) < 0.5 && Math.abs(to.k / from.k - 1) < 0.001) return false
    const start = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / SPRING_BACK_MS)
      const e = easeOut(p)
      const k = from.k * Math.pow(to.k / from.k, e)
      setT({ k, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e }, 'free')
      if (p < 1) nextFrame(step)
      else settle()
    }
    nextFrame(step)
    return true
  }

  const onUp = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return
    const p = local(e)
    pointers.delete(e.pointerId)
    holding.current = pointers.size > 0
    press(null)
    // Two fingers down together and both lifted without moving: zoom out around them.
    if (pointers.size === 0 && twoTap && !twoTap.moved && e.timeStamp - twoTap.time < 350) {
      const { cx, cy } = twoTap
      twoTap = null
      pinch = null
      pan = null
      tap = null
      zoomAround(cx, cy, 1 / TAP_ZOOM)
      return
    }
    if (pinch) {
      if (pointers.size >= 2) startPinch()
      else if (pointers.size === 1) {
        // Carry on panning with the finger that stayed down.
        pinch = null
        const rest = pointers.values().next().value!
        pan = { x: rest.x, y: rest.y, tx: t.current.x, ty: t.current.y }
        samples = []
      } else pinch = null
      if (pointers.size === 0 && !springBack() && (e.type === 'pointercancel' || !zoomGlide())) settle()
      return
    }
    if (pointers.size > 0) return
    if (frame) {
      cancelAnimationFrame(frame)
      flush()
    }
    const wasTap = !moved && tap && e.timeStamp - tap.time < 400
    pan = null
    tap = null
    if (wasTap) {
      const now = e.timeStamp
      const cur = t.current
      if (now - lastTap < 300) {
        // Double tap / double click → zoom in around the point (Shift: out). The first tap's pending selection is dropped.
        clearTimeout(pendingTap)
        zoomAround(p.x, p.y, e.shiftKey ? 1 / TAP_ZOOM : TAP_ZOOM)
        lastTap = 0
      } else {
        lastTap = now
        const target = tapRef.current((p.x - cur.x) / cur.k, (p.y - cur.y) / cur.k)
        // A tap on a place or a question pin acts at once. A tap on open map (a state, a country, nothing)
        // waits a moment in case it is the first of a double tap, which zooms instead.
        if (target.type === 'pin' || (target.type === 'place' && instantRef.current)) selectRef.current?.(target)
        else pendingTap = setTimeout(() => selectRef.current?.(target), 250)
      }
      return
    }
    if (springBack()) return
    const v = velocity(e.timeStamp)
    if (e.type !== 'pointercancel' && Math.hypot(v.x, v.y) > 0.12 && !prefersReducedMotion()) glide(v)
    else settle()
  }

  const wheelStep = (now: number) => {
    if (!wheelTo) return
    const dt = Math.min(48, Math.max(1, now - wheelTo.last))
    wheelTo.last = now
    const cur = t.current
    const a = 1 - Math.exp(-dt / WHEEL_TAU)
    let k = cur.k * Math.pow(wheelTo.target / cur.k, a)
    const done = Math.abs(Math.log(wheelTo.target / k)) < 0.003
    if (done) k = wheelTo.target
    const wx = (wheelTo.fx - cur.x) / cur.k
    const wy = (wheelTo.fy - cur.y) / cur.k
    setT({ k, x: wheelTo.fx - wx * k, y: wheelTo.fy - wy * k })
    if (done || Math.abs(t.current.k - k) > 1e-9) {
      wheelTo = null
      settle()
      return
    }
    nextFrame(wheelStep)
  }

  const onWheel = (e: WheelEvent) => {
    e.preventDefault()
    lastInput.current = performance.now()
    // The container only moves on resize; refresh its position once per wheel burst.
    if (e.timeStamp - lastWheel > 250) rect = el.getBoundingClientRect()
    lastWheel = e.timeStamp
    const p = local(e)
    const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaMode === 2 ? e.deltaY * 400 : e.deltaY
    if (isWheelNotch(e) && !prefersReducedMotion()) {
      // A mouse wheel moves in steps: ease each step in, accumulating, around the cursor.
      const { min, max } = limits()
      const base = wheelTo && performance.now() - wheelTo.last < 150 ? wheelTo.target : t.current.k
      const target = clamp(base * Math.exp(-dy * WHEEL_RATE), min, max)
      const running = !!wheelTo
      wheelTo = { target, fx: p.x, fy: p.y, last: wheelTo?.last ?? performance.now() }
      if (!running) {
        cancelAnim()
        nextFrame(wheelStep)
      }
      return
    }
    // Trackpads send a stream of small deltas (pinch arrives with ctrlKey): apply them directly.
    stopMotion()
    const f = Math.exp(-dy * (e.ctrlKey ? 0.01 : WHEEL_RATE))
    wheel = { f: (wheel?.f ?? 1) * f, x: p.x, y: p.y }
    request()
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.target !== el) return
    const { w, h } = size.current
    const cur = t.current
    const step = 90
    const nudge = (dx: number, dy: number) => animateTo({ ...cur, x: cur.x + dx, y: cur.y + dy }, { ms: 180, ease: easeOut })
    switch (e.key) {
      case 'ArrowLeft':
        nudge(step, 0)
        break
      case 'ArrowRight':
        nudge(-step, 0)
        break
      case 'ArrowUp':
        nudge(0, step)
        break
      case 'ArrowDown':
        nudge(0, -step)
        break
      case '+':
      case '=':
        zoomAround(w / 2, h / 2, 1.6)
        break
      case '-':
      case '_':
        zoomAround(w / 2, h / 2, 1 / 1.6)
        break
      default:
        return
    }
    e.preventDefault()
  }

  const onLeave = () => {
    hoverAt = null
    hoverRef.current(NaN, NaN)
  }

  el.addEventListener('pointerdown', onDown)
  el.addEventListener('pointermove', onMove)
  el.addEventListener('pointerup', onUp)
  el.addEventListener('pointercancel', onUp)
  el.addEventListener('pointerleave', onLeave)
  el.addEventListener('wheel', onWheel, { passive: false })
  el.addEventListener('keydown', onKey)
  return () => {
    cancelAnimationFrame(frame)
    inputPending.current = false
    cancelAnimationFrame(hoverFrame)
    clearTimeout(pendingTap)
    el.removeEventListener('pointerdown', onDown)
    el.removeEventListener('pointermove', onMove)
    el.removeEventListener('pointerup', onUp)
    el.removeEventListener('pointercancel', onUp)
    el.removeEventListener('pointerleave', onLeave)
    el.removeEventListener('wheel', onWheel)
    el.removeEventListener('keydown', onKey)
  }

}
