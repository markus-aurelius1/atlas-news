/**
 * A uniform grid over a sheet, so the map only looks at what is on screen
 * instead of walking every place and label on each layout.
 */
export type Rect = [x0: number, y0: number, x1: number, y1: number]

export class GridIndex<T> {
  private readonly cells: number[][]
  private readonly cols: number
  private readonly rows: number
  private readonly cw: number
  private readonly ch: number
  private readonly seen: Uint32Array
  private stamp = 0

  constructor(
    readonly items: readonly T[],
    bbox: (item: T) => Rect | null,
    width: number,
    height: number,
    cells = 24,
  ) {
    this.cols = cells
    this.rows = Math.max(1, Math.round((cells * height) / Math.max(1, width)))
    this.cw = Math.max(1, width) / this.cols
    this.ch = Math.max(1, height) / this.rows
    this.cells = Array.from({ length: this.cols * this.rows }, () => [])
    this.seen = new Uint32Array(items.length)
    items.forEach((item, i) => {
      const b = bbox(item)
      if (!b) return
      const [c0, r0, c1, r1] = this.span(b)
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) this.cells[r * this.cols + c].push(i)
    })
  }

  private span([x0, y0, x1, y1]: Rect): [number, number, number, number] {
    const cc = (x: number) => Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cw)))
    const rr = (y: number) => Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.ch)))
    return [cc(Math.min(x0, x1)), rr(Math.min(y0, y1)), cc(Math.max(x0, x1)), rr(Math.max(y0, y1))]
  }

  /** Items whose cells touch `rect`, in their original order (so layout stays deterministic). */
  query(rect: Rect): T[] {
    if (++this.stamp === 0xffffffff) {
      this.seen.fill(0)
      this.stamp = 1
    }
    const [c0, r0, c1, r1] = this.span(rect)
    const hits: number[] = []
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++)
        for (const i of this.cells[r * this.cols + c]) {
          if (this.seen[i] === this.stamp) continue
          this.seen[i] = this.stamp
          hits.push(i)
        }
    hits.sort((a, b) => a - b)
    return hits.map((i) => this.items[i])
  }
}

/** The part of the sheet on screen for a view transform, padded by `pad` screen pixels. */
export function viewRect(t: { k: number; x: number; y: number }, width: number, height: number, pad = 0): Rect {
  return [(-t.x - pad) / t.k, (-t.y - pad) / t.k, (width - t.x + pad) / t.k, (height - t.y + pad) / t.k]
}

export function boundsOf(points: ReadonlyArray<readonly [number, number]>): Rect | null {
  if (!points.length) return null
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const [x, y] of points) {
    if (x < x0) x0 = x
    if (y < y0) y0 = y
    if (x > x1) x1 = x
    if (y > y1) y1 = y
  }
  return [x0, y0, x1, y1]
}
