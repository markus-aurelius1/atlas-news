/** Rounded sheet geometry, indexed in bounded stroke chunks without changing filled rings. */
import { GridIndex, boundsOf, type Rect } from '@/atlas/spatial'
export interface GeometryChunk {
  d: string
  bbox: Rect
  offset: number
}
export interface ChunkedPath {
  fill: string
  bbox: Rect
  strokes: GeometryChunk[]
}
export function chunkPath(d: string, limit = 256): ChunkedPath {
  const strokes: GeometryChunk[] = []
  const all: Array<[number, number]> = []
  const subpaths = d.match(/M[^M]+/g) ?? []
  for (const sub of subpaths) {
    const numbers = sub.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
    const points: Array<[number, number]> = []
    for (let i = 0; i < numbers.length; i += 2) points.push([numbers[i], numbers[i + 1]])
    if (sub.endsWith('Z') && points.length) points.push(points[0])
    all.push(...points)
    let offset = 0
    for (let i = 0; i < points.length - 1; i += limit) {
      const part = points.slice(i, i + limit + 1)
      strokes.push({ d: 'M' + part.map(([x, y]) => x + ',' + y).join('L'), bbox: boundsOf(part)!, offset })
      for (let j = 1; j < part.length; j++) offset += Math.hypot(part[j][0] - part[j - 1][0], part[j][1] - part[j - 1][1])
    }
  }
  return { fill: d, bbox: boundsOf(all) ?? [0, 0, 0, 0], strokes }
}
export class IndexedPath {
  readonly fill: Path2D
  readonly strokes: GridIndex<GeometryChunk & { path: Path2D }>
  constructor(
    readonly source: ChunkedPath,
    width: number,
    height: number,
  ) {
    this.fill = new Path2D(source.fill)
    this.strokes = new GridIndex(
      source.strokes.map((chunk) => ({ ...chunk, path: new Path2D(chunk.d) })),
      (c) => c.bbox,
      width,
      height,
      8,
    )
  }
}
