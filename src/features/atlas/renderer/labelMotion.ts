/** Screen-size names follow world anchors with fixed screen offsets; river glyphs follow the chosen course at layout. */
import type { Transform } from '../labels'
export interface LabelAnchor {
  worldX: number
  worldY: number
  offsetX: number
  offsetY: number
}
export const labelPosition = (anchor: LabelAnchor, view: Transform) => ({ x: view.x + anchor.worldX * view.k + anchor.offsetX, y: view.y + anchor.worldY * view.k + anchor.offsetY })
export function curveGlyphs(path: string, advances: number[]) {
  const values = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? []
  const points: Array<[number, number]> = []
  for (let i = 0; i < values.length; i += 2) points.push([values[i], values[i + 1]])
  if (points.length < 2) return null
  const lengths = [0]
  for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]))
  const total = lengths.at(-1)!
  const at = (distance: number) => {
    let i = 1
    while (i < points.length - 1 && lengths[i] < distance) i++
    const ratio = Math.max(0, Math.min(1, (distance - lengths[i - 1]) / (lengths[i] - lengths[i - 1] || 1)))
    const [a, b] = [points[i - 1], points[i]]
    return { x: a[0] + (b[0] - a[0]) * ratio, y: a[1] + (b[1] - a[1]) * ratio, angle: Math.atan2(b[1] - a[1], b[0] - a[0]) }
  }
  const centre = at(total / 2)
  const width = advances.reduce((a, b) => a + b, 0)
  let cursor = Math.max(0, (total - width) / 2)
  const glyphs = advances.map((advance) => {
    const point = at(cursor + advance / 2)
    cursor += advance
    return { x: point.x - centre.x, y: point.y - centre.y, angle: point.angle }
  })
  return { centre, glyphs }
}
