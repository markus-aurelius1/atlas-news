/** Name anchors, curve lettering and stable fitted-font decisions across pinch scales. */
// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { curveGlyphs, labelPosition } from './labelMotion'
import { layoutLabels, resetMeasureCache, type LayoutInput } from '../labels'
describe('label motion', () => {
  it('keeps screen offsets and text size independent of zoom', () => {
    const anchor = { worldX: 300, worldY: 200, offsetX: 12, offsetY: -8 }
    for (const k of [0.2, 0.8, 2, 6]) {
      const p = labelPosition(anchor, { k, x: -50, y: -20 })
      expect(p.x - (300 * k - 50)).toBeCloseTo(12)
      expect(p.y - (200 * k - 20)).toBeCloseTo(-8)
    }
  })
  it('places a curved word around the course midpoint, with local tangents', () => {
    const curve = curveGlyphs('M0,0L50,0L100,50', [10, 10, 10, 10])!
    expect(curve.glyphs).toHaveLength(4)
    for (const g of curve.glyphs) {
      const x = g.x + curve.centre.x,
        y = g.y + curve.centre.y
      expect(y).toBeCloseTo(x > 50 ? x - 50 : 0)
      expect(g.angle).toBeCloseTo(x > 50 ? Math.PI / 4 : 0)
    }
    expect(curveGlyphs('', [10])).toBeNull()
  })
  it('keeps the font basis fitted while detail and abbreviations still follow the live view', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      font: '',
      measureText: (text: string) => ({ width: text.length * 60, actualBoundingBoxAscent: 80, actualBoundingBoxDescent: 20 }),
    } as unknown as CanvasRenderingContext2D)
    resetMeasureCache()
    const input: LayoutInput = {
      labels: [{ id: 'state', name: 'State', kind: 'state', x: 100, y: 100, size: 300, radius: 100, abbr: 'S.' }],
      places: [],
      t: { k: 1, x: 0, y: 0 },
      kFit: 1,
      width: 1000,
      height: 1000,
      mutedIds: new Set(),
      linked: new Map(),
      foggedStates: new Set(),
      sheetId: 'india',
    }
    const first = layoutLabels(input).find((l) => l.key === 'state:state')!
    const zoomed = layoutLabels({ ...input, t: { k: 3, x: 0, y: 0 } }).find((l) => l.key === first.key)!
    expect(first.size).toBe(zoomed.size)
    expect(zoomed.x).toBe(3 * first.x)
    vi.restoreAllMocks()
  })
})
