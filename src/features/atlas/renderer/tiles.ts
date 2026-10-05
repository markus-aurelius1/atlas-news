/** Device-pixel tile addresses and deterministic centre-first coverage planning. */
import { viewRect, type Rect } from '@/atlas/spatial'
import type { Transform } from '../labels'
export const TILE_SIZE = 512
export interface Tile {
  level: number
  x: number
  y: number
}
export const tileKey = (t: Tile) => t.level + ':' + t.x + ':' + t.y
export const levelFor = (k: number, dpr: number) => Math.ceil(Math.log2(Math.max(1 / 128, k * dpr)))
export const tileBounds = (t: Tile): Rect => {
  const step = TILE_SIZE / 2 ** t.level
  return [t.x * step, t.y * step, (t.x + 1) * step, (t.y + 1) * step]
}
export function tilesFor(view: Transform, width: number, height: number, sheetWidth: number, sheetHeight: number, level: number, ring = 0): Tile[] {
  const step = TILE_SIZE / 2 ** level
  const b = viewRect(view, width, height)
  const x0 = Math.max(0, Math.floor(b[0] / step) - ring)
  const y0 = Math.max(0, Math.floor(b[1] / step) - ring)
  const x1 = Math.min(Math.ceil(sheetWidth / step) - 1, Math.floor((b[2] - 0.001) / step) + ring)
  const y1 = Math.min(Math.ceil(sheetHeight / step) - 1, Math.floor((b[3] - 0.001) / step) + ring)
  const cx = (b[0] + b[2]) / (2 * step) - 0.5
  const cy = (b[1] + b[3]) / (2 * step) - 0.5
  const result: Tile[] = []
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) result.push({ level, x, y })
  return result.sort((a, b) => Math.hypot(a.x - cx, a.y - cy) - Math.hypot(b.x - cx, b.y - cy) || a.y - b.y || a.x - b.x)
}
export const parentOf = (t: Tile): Tile => ({ level: t.level - 1, x: Math.floor(t.x / 2), y: Math.floor(t.y / 2) })
export const childrenOf = (t: Tile): Tile[] => [0, 1, 2, 3].map((i) => ({ level: t.level + 1, x: 2 * t.x + (i % 2), y: 2 * t.y + Math.floor(i / 2) }))
