/**
 * Camera motion for the Atlas map.
 *
 * Views are `{ k, x, y }` (sheet px → screen px: screen = sheet·k + (x, y)).
 * Long moves follow van Wijk & Nuij's "smooth and efficient zooming and
 * panning" path – zoom out a little, travel, zoom back in – the same curve
 * d3's interpolateZoom and Mapbox's flyTo use, so a jump across the sheet reads
 * as one continuous movement instead of a slide at constant scale.
 */
export interface View {
  k: number
  x: number
  y: number
}

/** Curvature of the path (ρ). √2 is "optimal"; a little flatter feels calmer on small screens. */
const RHO = 1.3

export interface Flight {
  /** View at progress 0…1 (already eased). */
  at: (t: number) => View
  /** Suggested duration (ms), proportional to the path length. */
  duration: number
}

/**
 * The path from view `a` to view `b` for a viewport `w`×`h`, keeping the point
 * at `focus` (screen px, default the centre) as the moving centre.
 */
export function flight(a: View, b: View, w: number, h: number, focus: [number, number] = [w / 2, h / 2]): Flight {
  // Centres (sheet px) and widths (sheet px visible across the viewport).
  const [fx, fy] = focus
  const ax = (fx - a.x) / a.k
  const ay = (fy - a.y) / a.k
  const bx = (fx - b.x) / b.k
  const by = (fy - b.y) / b.k
  const w0 = w / a.k
  const w1 = w / b.k
  const dx = bx - ax
  const dy = by - ay
  const d2 = dx * dx + dy * dy
  const d1 = Math.sqrt(d2)
  const view = (cx: number, cy: number, width: number): View => {
    const k = w / width
    return { k, x: fx - cx * k, y: fy - cy * k }
  }

  let S: number
  let at: (s: number) => View
  if (d1 < 1e-6 * Math.max(w0, w1)) {
    // Pure zoom.
    const signed = Math.log(w1 / w0) / RHO
    at = (t) => view(ax + t * dx, ay + t * dy, w0 * Math.exp(RHO * t * signed))
    S = Math.abs(signed)
  } else {
    const r2 = RHO * RHO
    const b0 = (w1 * w1 - w0 * w0 + r2 * r2 * d2) / (2 * w0 * r2 * d1)
    const b1 = (w1 * w1 - w0 * w0 - r2 * r2 * d2) / (2 * w1 * r2 * d1)
    // asinh avoids cancellation in sqrt(b² + 1) - b at close zoom levels.
    const r0 = -Math.asinh(b0)
    const r1 = -Math.asinh(b1)
    S = (r1 - r0) / RHO
    const coshr0 = Math.cosh(r0)
    const sinhr0 = Math.sinh(r0)
    at = (t) => {
      const s = t * S
      const u = (w0 / (r2 * d1)) * (coshr0 * Math.tanh(RHO * s + r0) - sinhr0)
      return view(ax + u * dx, ay + u * dy, (w0 * coshr0) / Math.cosh(RHO * s + r0))
    }
  }
  // About 0.55 s per unit of path, within limits that feel neither sluggish nor abrupt.
  const duration = Math.round(Math.max(320, Math.min(1500, 260 + S * 520)))
  return { at: (t) => (t >= 1 ? { ...b } : t <= 0 ? { ...a } : at(t)), duration }
}

/** Ease in and out (cubic), the standard for camera moves between two rests. */
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
/** Ease out (cubic), for moves that start from a gesture. */
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)

/**
 * Is this wheel event a mouse wheel notch (animate it) rather than a trackpad
 * scroll or pinch (apply it directly)? Line/page deltas are always a wheel;
 * pixel deltas from a wheel come in large whole steps (100 or 120 per notch,
 * scaled by the display), while trackpads send many small, often fractional ones.
 */
export function isWheelNotch(e: { deltaMode: number; deltaY: number; ctrlKey: boolean }): boolean {
  if (e.ctrlKey) return false
  if (e.deltaMode !== 0) return true
  const d = Math.abs(e.deltaY)
  return d >= 50 && Math.abs(d - Math.round(d)) < 1e-6
}
