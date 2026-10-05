/**
 * Placement for anchored surfaces (popovers, menus, tooltips): beside the
 * anchor on the requested side, flipped to the opposite side when that has more
 * room, and shifted along the edge so it never leaves the viewport.
 */
export type Side = 'top' | 'bottom' | 'left' | 'right'
export type Align = 'start' | 'center' | 'end'

export interface Box {
  left: number
  top: number
  width: number
  height: number
}

export interface Placed {
  left: number
  top: number
  side: Side
  /** Room for the surface on its side, to cap its height (or width) and let it scroll. */
  available: number
}

const MARGIN = 8

export function place(anchor: Box, size: { width: number; height: number }, viewport: { width: number; height: number }, opts: { side?: Side; align?: Align; gap?: number } = {}): Placed {
  const { side: want = 'bottom', align = 'start', gap = 6 } = opts
  const room: Record<Side, number> = {
    top: anchor.top - gap - MARGIN,
    bottom: viewport.height - (anchor.top + anchor.height) - gap - MARGIN,
    left: anchor.left - gap - MARGIN,
    right: viewport.width - (anchor.left + anchor.width) - gap - MARGIN,
  }
  const vertical = want === 'top' || want === 'bottom'
  const need = vertical ? size.height : size.width
  const opposite: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }
  // Flip only if the wanted side is too small and the other side is larger.
  const side = room[want] >= need || room[want] >= room[opposite[want]] ? want : opposite[want]

  const along = (start: number, length: number, mine: number, max: number) => {
    const at = align === 'start' ? start : align === 'end' ? start + length - mine : start + (length - mine) / 2
    return Math.max(MARGIN, Math.min(at, max - mine - MARGIN))
  }
  let left: number
  let top: number
  if (side === 'top' || side === 'bottom') {
    left = along(anchor.left, anchor.width, size.width, viewport.width)
    top = side === 'bottom' ? anchor.top + anchor.height + gap : anchor.top - gap - Math.min(size.height, Math.max(0, room.top))
  } else {
    top = along(anchor.top, anchor.height, size.height, viewport.height)
    left = side === 'right' ? anchor.left + anchor.width + gap : anchor.left - gap - Math.min(size.width, Math.max(0, room.left))
  }
  return { left, top, side, available: Math.max(0, room[side]) }
}
