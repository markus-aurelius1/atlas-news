/** Timestamp camera, compositor placement and settlement policy; no React state on the gesture path. */
import { startTransition, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react'
import type { LabelPort } from './LabelLayer'
import type { BasePort } from './BaseLayer'
import { lowPowerDevice } from '@/lib/device'
import { prefersReducedMotion } from '@/lib/motion'
import { resetMeasureCache, type Transform } from '../labels'
import { easeInOut, easeOut, flight, type View } from '../camera'
import type { AtlasMapHandle, AtlasMapProps, Layout, MapInsets } from './types'
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
/** Past a bound the view follows the finger with growing resistance, by at most this many px. */
const RUBBER = 96
const rubber = (over: number) => Math.sign(over) * RUBBER * (1 - 1 / ((Math.abs(over) / RUBBER) * 0.6 + 1))

/** The view is at rest once nothing has moved it for this long and for a few frames running: then it is repainted crisply and the names are laid out. */
const SETTLE_MS = 140
const SETTLE_FRAMES = 3
/** Repaint mid-gesture at most this often (only when the painted layer no longer covers the view, or has been scaled too far). */
const MIN_REPAINT_GAP = 220
/** While a finger or the mouse button is down, names are laid out again at most this often, and only once the view has studied half the overscan. */
const HOLD_LAYOUT_GAP = 250
/** Zoom level (× the fitted scale) at which protected-area outlines appear. */
const AREAS_FROM_ZOOM = 1.7

export function useMapCamera(props: AtlasMapProps, ref: Ref<AtlasMapHandle>) {
  const { sheet } = props
  const container = useRef<HTMLDivElement>(null)
  const basePort = useRef<BasePort | null>(null)
  const labelLayer = useRef<HTMLDivElement>(null)
  const decorLayer = useRef<HTMLDivElement>(null)
  const pinLayer = useRef<HTMLDivElement>(null)
  const labelPort = useRef<LabelPort | null>(null)
  /** Selection and question highlights, on a layer of their own: changing them never repaints the base map. */
  const overlayLayer = useRef<HTMLDivElement>(null)
  const overlayG = useRef<SVGGElement>(null)
  /** The live view (sheet px → screen px). Changes every frame, so it is never React state. */
  const t = useRef<Transform>({ k: 1, x: 0, y: 0 })
  /** The view the base map was last painted at; between paints the layer is moved on the compositor. */
  const painted = useRef<Transform | null>(null)
  const lastPaint = useRef(0)
  /** The frame the rendered names and symbols are positioned in, and the view they were laid out for. */
  const laidOut = useRef<Transform | null>(null)
  const laidOutView = useRef<Transform | null>(null)
  const frame = useRef<Transform | null>(null)
  const kFit = useRef(1)
  /** Viewport size, the painted margin around it, and how far beyond the view names are laid out (px). */
  const size = useRef({ w: 1, h: 1, m: 0, o: 0 })
  /** The size the painted layers were given at the last repaint. They are only resized when repainted, so a resizing window moves them on the compositor like any other gesture. */
  const layerGeom = useRef({ w: 0, h: 0, m: 0 })
  const [layoutT, setLayoutT] = useState<Layout | null>(null)
  /** When names were last laid out, and the positions the point names took (kept on the next layout where they still fit). */
  const lastLayout = useRef(0)
  /** A layout has been asked for and not committed yet: asking again would only restart it. */
  const layoutPending = useRef(false)
  const namePositions = useRef<Map<string, number>>(new Map())
  /** The frame loop that watches for the view coming to rest (0 when it isn't running), and the frames it has seen without movement. */
  const settleWatch = useRef(0)
  const stillFrames = useRef(0)
  const anim = useRef(0)
  const moving = useRef(false)
  const near = useRef(false)
  /** Fingers or a mouse button are down: names wait for the release instead of re-laying out mid-gesture. */
  const holding = useRef(false)
  /** A camera animation (fly-to, glide, wheel easing) has its next frame scheduled. */
  const animPending = useRef(false)
  /** Pointer or wheel input is batched and waiting for its frame. */
  const inputPending = useRef(false)
  /** When the view was last asked to move – by input that may not have reached a frame yet, or by a frame. */
  const lastInput = useRef(0)
  /** A repaint has been issued and the frame that shows it has not been produced yet. */
  const paintInFlight = useRef(false)

  /** Schedule an animation step; animPending says one is on its way even when frames are slow. */
  const nextFrame = useCallback((step: (now: number) => void) => {
    animPending.current = true
    anim.current = requestAnimationFrame((now) => {
      animPending.current = false
      step(now)
    })
  }, [])
  const cancelAnim = useCallback(() => {
    cancelAnimationFrame(anim.current)
    animPending.current = false
  }, [])

  const limits = useCallback(() => {
    const { w, h } = size.current
    // Cover the viewport at every zoom so the paper around the sheet never appears.
    const cover = Math.max(w / sheet.width, h / sheet.height)
    return { min: cover, max: Math.max(cover, kFit.current * 7) }
  }, [sheet])

  const clampT = useCallback(
    (n: Transform): Transform => {
      const { w, h } = size.current
      const { min, max } = limits()
      const k = clamp(n.k, min, max)
      // If a caller overshoots a zoom limit, keep its requested centre instead of
      // applying an offset calculated for a different scale (which jumps the map).
      const xAtScale = k === n.k ? n.x : w / 2 - ((w / 2 - n.x) / n.k) * k
      const yAtScale = k === n.k ? n.y : h / 2 - ((h / 2 - n.y) / n.k) * k
      const sw = sheet.width * k
      const sh = sheet.height * k
      const x = clamp(xAtScale, w - sw, 0)
      const y = clamp(yAtScale, h - sh, 0)
      return { k, x, y }
    },
    [limits, sheet],
  )

  /** The scale a pinch may reach while it is held: past a limit it gives, a little. */
  const softK = useCallback(
    (k: number) => {
      const { min, max } = limits()
      if (prefersReducedMotion()) return clamp(k, min, max)
      return k < min ? min * Math.pow(k / min, 0.3) : k > max ? max * Math.pow(k / max, 0.3) : k
    },
    [limits],
  )

  /**
   * The view while a finger holds it: past an edge of the sheet (or a zoom
   * limit) it follows with resistance instead of stopping dead, and springs
   * back on release. Under reduced motion it simply stops at the bound.
   */
  const softClampT = useCallback(
    (n: Transform): Transform => {
      if (prefersReducedMotion()) return clampT(n)
      const { w, h } = size.current
      const k = softK(n.k)
      const x0 = k === n.k ? n.x : w / 2 - ((w / 2 - n.x) / n.k) * k
      const y0 = k === n.k ? n.y : h / 2 - ((h / 2 - n.y) / n.k) * k
      const axis = (v: number, view: number, sheetPx: number) => {
        // Smaller than the view (only while a pinch is past its limit): centred.
        const lo = sheetPx >= view ? view - sheetPx : (view - sheetPx) / 2
        const hi = sheetPx >= view ? 0 : (view - sheetPx) / 2
        const inside = clamp(v, lo, hi)
        return inside + rubber(v - inside)
      }
      return { k, x: axis(x0, w, sheet.width * k), y: axis(y0, h, sheet.height * k) }
    },
    [clampT, sheet, softK],
  )

  /** Move the painted layers to match the live view. Compositor only: nothing is repainted. */
  const place = useCallback(() => {
    const cur = t.current
    const { m } = layerGeom.current
    const p = painted.current
    if (p) {
      const s = cur.k / p.k
      const tf = `translate3d(${cur.x + m - s * (p.x + m)}px,${cur.y + m - s * (p.y + m)}px,0) scale(${s})`
      if (overlayLayer.current) overlayLayer.current.style.transform = tf
    }
    basePort.current?.({ view: cur, width: size.current.w, height: size.current.h, rest: !moving.current, near: near.current })
    labelPort.current?.(cur)
    const l = laidOut.current
    const layer = decorLayer.current
    if (l && layer) {
      const s = cur.k / l.k
      layer.style.transform = `translate3d(${cur.x - s * l.x}px,${cur.y - s * l.y}px,0) scale(${s})`
      if (pinLayer.current) pinLayer.current.style.transform = layer.style.transform
    }
  }, [])

  /** Place the small SVG overlay at the live view; base vectors belong to the tile worker. */
  const paint = useCallback(() => {
    const cur = { ...t.current }
    const { w, h, m } = size.current
    const g = layerGeom.current
    if (g.w !== w || g.h !== h || g.m !== m) {
      layerGeom.current = { w, h, m }
      for (const layer of [overlayLayer.current]) {
        if (!layer) continue
        layer.style.left = layer.style.top = `${-m}px`
        layer.style.width = `${w + 2 * m}px`
        layer.style.height = `${h + 2 * m}px`
      }
    }
    painted.current = cur
    lastPaint.current = performance.now()
    // Rasterising the map can take several frames' worth of time. Until the frame after the
    // one that carries this paint has started, a second repaint would only queue behind it.
    paintInFlight.current = true
    requestAnimationFrame(() => requestAnimationFrame(() => (paintInFlight.current = false)))
    const tf = `translate(${cur.x + m},${cur.y + m}) scale(${cur.k})`
    overlayG.current?.setAttribute('transform', tf)
    place()
  }, [place])

  /** Has the view drifted so far from the painted layer that edges show, or it looks soft? */
  const stale = useCallback(() => {
    const p = painted.current
    if (!p) return true
    const cur = t.current
    const s = cur.k / p.k
    if (s > 2.4 || s < 0.6) return true
    const { w, h } = size.current
    const g = layerGeom.current
    const x0 = cur.x - s * (p.x + g.m)
    const y0 = cur.y - s * (p.y + g.m)
    return x0 > 1 || y0 > 1 || x0 + (g.w + 2 * g.m) * s < w - 1 || y0 + (g.h + 2 * g.m) * s < h - 1
  }, [])

  /** The live view as a layout request, in the current frame (a new frame when the zoom has changed). */
  const snapshot = useCallback((): Layout => {
    const cur = t.current
    const { w, h, o } = size.current
    let f = frame.current
    // Keep coordinates small: after a very long pan at one zoom the frame is moved up to the view.
    if (!f || f.k !== cur.k || Math.abs(cur.x - f.x) > 6000 || Math.abs(cur.y - f.y) > 6000) f = frame.current = { ...cur }
    return { k: cur.k, x: cur.x, y: cur.y, w, h, o, fx: f.x, fy: f.y }
  }, [])

  /** Lay the names and symbols out for the live view (a low-priority render; the gesture keeps its frames). */
  const requestLayout = useCallback(() => {
    layoutPending.current = true
    const snap = snapshot()
    startTransition(() => setLayoutT(snap))
  }, [snapshot])

  /** Once still: repaint crisply, resume decorative motion and lay the names out again. */
  const settle = useCallback(() => {
    cancelAnimationFrame(settleWatch.current)
    settleWatch.current = 0
    const p = painted.current
    const cur = t.current
    const g = layerGeom.current
    if (!p || p.k !== cur.k || p.x !== cur.x || p.y !== cur.y || g.w !== size.current.w || g.h !== size.current.h) paint()
    if (moving.current) {
      moving.current = false
      container.current?.classList.remove('atlas-moving')
    }
    // Zoom-dependent layers switch only at rest, never mid-gesture.
    near.current = cur.k / kFit.current >= AREAS_FROM_ZOOM
    container.current?.classList.toggle('atlas-near', near.current)
    basePort.current?.({ view: cur, width: size.current.w, height: size.current.h, rest: true, near: near.current })
    requestLayout()
  }, [paint, requestLayout])

  /**
   * Watch for the view coming to rest, from the frame loop rather than a timer.
   * A repaint can hold the next frame back for far longer than SETTLE_MS, and
   * the browser delivers wheel and pointer input with the frame, so during such
   * a stall a timer sees neither movement nor input and would settle in the
   * middle of a gesture – repainting and laying the names out again, which
   * delays the following frame even more. Frames don't run during a stall, so
   * counting them can't be fooled: the view is at rest after SETTLE_FRAMES
   * frames and SETTLE_MS without movement, with no animation or batched input
   * pending and no repaint still in flight.
   */
  const watchForRest = useCallback(() => {
    stillFrames.current = 0
    if (settleWatch.current) return
    const check = () => {
      settleWatch.current = 0
      if (holding.current) return
      stillFrames.current++
      const busy = animPending.current || inputPending.current || paintInFlight.current
      if (busy || stillFrames.current < SETTLE_FRAMES || performance.now() - lastInput.current < SETTLE_MS) {
        if (busy) stillFrames.current = 0
        settleWatch.current = requestAnimationFrame(check)
        return
      }
      settle()
    }
    settleWatch.current = requestAnimationFrame(check)
  }, [settle])

  /**
   * Show the view `n`. `hold` says how strictly it is kept on the sheet:
   * 'hard' (default) stops at the bounds, 'soft' lets a held gesture pull past
   * them with resistance, 'free' applies it as given (the spring back).
   */
  const setT = useCallback(
    (n: Transform, hold: 'hard' | 'soft' | 'free' = 'hard') => {
      t.current = hold === 'free' ? n : hold === 'soft' ? softClampT(n) : clampT(n)
      lastInput.current = performance.now()
      if (!moving.current) {
        moving.current = true
        container.current?.classList.add('atlas-moving')
      }
      // Never start a repaint while one is still being rasterised: the view keeps moving on the compositor meanwhile.
      if (stale() && !paintInFlight.current && performance.now() - lastPaint.current > MIN_REPAINT_GAP) paint()
      else place()
      if (!holding.current) {
        watchForRest()
        return
      }
      // Held: the names were laid out beyond the view, so a drag reveals named map. Once half of that
      // reserve is used up (or the scale has changed a lot), lay them out again around the new view.
      const l = laidOutView.current
      const now = performance.now()
      if (!l || layoutPending.current || now - lastLayout.current < HOLD_LAYOUT_GAP) return
      const cur = t.current
      const s = cur.k / l.k
      const reserve = size.current.o / 2
      if (Math.abs(cur.x - s * l.x) >= reserve || Math.abs(cur.y - s * l.y) >= reserve || s > 1.5 || s < 0.67) {
        lastLayout.current = now
        requestLayout()
      }
    },
    [clampT, paint, place, requestLayout, softClampT, stale, watchForRest],
  )

  // The names now on screen were laid out for `layoutT`: line their layer up with the live view.
  useLayoutEffect(() => {
    if (!layoutT) return
    laidOut.current = { k: layoutT.k, x: layoutT.fx, y: layoutT.fy }
    laidOutView.current = layoutT
    lastLayout.current = performance.now()
    layoutPending.current = false
    place()
  }, [layoutT, place])

  /**
   * Move the camera to `target` along one continuous zoom-and-pan path
   * (camera.ts). `focus` is the screen point that stays the centre of the
   * motion (a tapped point for zooms). Under reduced motion it jumps.
   */
  const animateTo = useCallback(
    (target: Transform, opts: { ms?: number; ease?: (p: number) => number; focus?: [number, number] } = {}) => {
      cancelAnim()
      const from: View = { ...t.current }
      const to = clampT(target)
      if (opts.ms === 0 || prefersReducedMotion()) {
        setT(to)
        settle()
        return
      }
      const { w, h } = size.current
      const path = flight(from, to, w, h, opts.focus)
      const ms = opts.ms ?? path.duration
      const ease = opts.ease ?? easeInOut
      const start = performance.now()
      const step = (now: number) => {
        const p = Math.min(1, (now - start) / ms)
        setT(path.at(ease(p)))
        if (p < 1) nextFrame(step)
        else settle()
      }
      nextFrame(step)
    },
    [cancelAnim, clampT, nextFrame, setT, settle],
  )

  const insetsRef = useRef(props.insets)
  insetsRef.current = props.insets
  const fitRect = useCallback(
    (r: [number, number, number, number], pad = 0.08): Transform => {
      const { w, h } = size.current
      const bw = r[2] - r[0]
      const bh = r[3] - r[1]
      const focusFit = Math.min(w / (bw * (1 + pad * 2)), h / (bh * (1 + pad * 2)))
      const k = Math.max(w / sheet.width, h / sheet.height, focusFit)
      return { k, x: w / 2 - ((r[0] + r[2]) / 2) * k, y: h / 2 - ((r[1] + r[3]) / 2) * k }
    },
    [sheet],
  )

  /** The part of the map not covered by overlays (screen px). An inset that would leave too little is ignored. */
  const clearRect = useCallback((insets?: MapInsets) => {
    const { w, h } = size.current
    const side = (k: keyof MapInsets) => insets?.[k] ?? insetsRef.current?.[k] ?? 0
    let [left, right, top, bottom] = [side('left'), side('right'), side('top'), side('bottom')]
    if (w - left - right < 200) left = right = 0
    if (h - top - bottom < 160) bottom = Math.max(0, h - top - 160)
    return { x0: left, x1: w - right, y0: top, y1: h - bottom }
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      flyTo: (x, y, zoom = 2.6, insets) => {
        const c = clearRect(insets)
        const cx = (c.x0 + c.x1) / 2
        const cy = (c.y0 + c.y1) / 2
        const { max } = limits()
        const k = Math.min(max, Math.max(t.current.k, kFit.current * zoom))
        animateTo({ k, x: cx - x * k, y: cy - y * k }, { focus: [cx, cy] })
      },
      reveal: (x, y, insets) => {
        const c = clearRect(insets)
        const cur = t.current
        const pad = 48
        const sx = x * cur.k + cur.x
        const sy = y * cur.k + cur.y
        // A river or a range is selected by touching it anywhere; its own point may be far away. Only a point on screen is moved clear.
        if (sx < 0 || sy < 0 || sx > size.current.w || sy > size.current.h) return
        const dx = sx < c.x0 + pad ? c.x0 + pad - sx : sx > c.x1 - pad ? c.x1 - pad - sx : 0
        const dy = sy < c.y0 + pad ? c.y0 + pad - sy : sy > c.y1 - pad ? c.y1 - pad - sy : 0
        if (dx || dy) animateTo({ k: cur.k, x: cur.x + dx, y: cur.y + dy }, { ms: 260, ease: easeOut })
      },
      fitFocus: () => animateTo(fitRect(props.initialFocus ?? sheet.focus)),
      zoomBy: (f) => {
        const { w, h } = size.current
        const { min, max } = limits()
        const k = clamp(t.current.k * f, min, max)
        const cx = (w / 2 - t.current.x) / t.current.k
        const cy = (h / 2 - t.current.y) / t.current.k
        animateTo({ k, x: w / 2 - cx * k, y: h / 2 - cy * k }, { ms: 280, ease: easeOut, focus: [w / 2, h / 2] })
      },
    }),
    [animateTo, clearRect, fitRect, limits, props.initialFocus, sheet],
  )

  /** The sheet the camera has been fitted to. */
  const fitted = useRef<string | null>(null)
  /**
   * The Atlas screen is kept mounted behind the others. While it is not the one
   * in front, nothing here moves: camera animations and the rest watcher are
   * cancelled, decorative animation is paused (.atlas-asleep), and a resize is
   * taken up only on return.
   */
  const activeRef = useRef(true)
  const remeasure = useRef<() => void>(() => {})
  // Size, painted margin and the initial fit.
  useLayoutEffect(() => {
    const el = container.current
    if (!el) return
    const measure = (initial: boolean) => {
      const r = el.getBoundingClientRect()
      const prev = size.current
      const w = Math.max(1, r.width)
      const h = Math.max(1, r.height)
      // Hidden (display: none) measures as nothing: keep what is known until it is shown again.
      if (!initial && (r.width === 0 || r.height === 0)) return
      if (!initial && w === prev.w && h === prev.h) return
      // A painted margin lets short pans reveal already-drawn map. Smaller on low-power devices.
      const m = Math.round(Math.min(lowPowerDevice() ? 240 : 480, Math.max(w, h) * (lowPowerDevice() ? 0.25 : 0.4)))
      // Names are laid out this far beyond the view, so dragging reveals map that is already named.
      const o = Math.round(Math.min(lowPowerDevice() ? 120 : 260, Math.min(w, h) * (lowPowerDevice() ? 0.2 : 0.3)))
      size.current = { w, h, m, o }
      const fit = fitRect(props.initialFocus ?? sheet.focus, 0)
      kFit.current = fit.k
      if (initial) {
        t.current = clampT(fit)
        paint()
        settle()
        return
      }
      // A resize (the rail collapsing, full screen, a rotated phone) is treated like a gesture: keep the
      // same centre, move the painted layers on the compositor, and repaint once when it has stopped.
      const cx = (prev.w / 2 - t.current.x) / t.current.k
      const cy = (prev.h / 2 - t.current.y) / t.current.k
      setT({ k: t.current.k, x: w / 2 - cx * t.current.k, y: h / 2 - cy * t.current.k })
    }
    const first = fitted.current !== sheet.id
    fitted.current = sheet.id
    measure(first)
    remeasure.current = () => measure(false)
    // Behind another screen (the Atlas is kept alive there) a change of size waits until the map is in front again.
    const ro = new ResizeObserver(() => {
      if (!activeRef.current) return
      measure(false)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [sheet]) // eslint-disable-line react-hooks/exhaustive-deps

  const onActive = useCallback(
    (active: boolean) => {
      if (activeRef.current === active) return
      activeRef.current = active
      basePort.current?.({ view: t.current, width: size.current.w, height: size.current.h, rest: true, active, near: near.current })
      container.current?.classList.toggle('atlas-asleep', !active)
      // Behind another screen the map is not a tab stop (the screen is not made inert as a whole: see App.tsx).
      if (container.current) container.current.tabIndex = active ? 0 : -1
      if (active) {
        remeasure.current()
        return
      }
      cancelAnim()
      cancelAnimationFrame(settleWatch.current)
      settleWatch.current = 0
    },
    [cancelAnim],
  )

  // Re-measure names once web fonts are ready (widths measured before are for the fallback font).
  useEffect(() => {
    let alive = true
    void document.fonts?.ready.then(() => {
      if (!alive) return
      resetMeasureCache()
      requestLayout()
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(
    () => () => {
      cancelAnim()
      cancelAnimationFrame(settleWatch.current)
    },
    [cancelAnim],
  )

  return {
    container,
    basePort,
    labelPort,
    labelLayer,
    decorLayer,
    pinLayer,
    overlayLayer,
    overlayG,
    t,
    kFit,
    size,
    layerGeom,
    layoutT,
    namePositions,
    moving,
    holding,
    inputPending,
    lastInput,
    nextFrame,
    cancelAnim,
    limits,
    clampT,
    softK,
    setT,
    settle,
    animateTo,
    onActive,
  }
}
export type MapCamera = ReturnType<typeof useMapCamera>
