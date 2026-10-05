import { describe, expect, it } from 'vitest'
import { boundsOf, GridIndex, viewRect } from './spatial'

describe('GridIndex', () => {
  const pts = [
    { id: 'a', x: 10, y: 10 },
    { id: 'b', x: 500, y: 500 },
    { id: 'c', x: 990, y: 20 },
    { id: 'd', x: 505, y: 495 },
  ]
  const idx = new GridIndex(pts, (p) => [p.x, p.y, p.x, p.y], 1000, 1000, 10)

  it('returns only items in the queried cells, in original order', () => {
    expect(idx.query([480, 480, 520, 520]).map((p) => p.id)).toEqual(['b', 'd'])
    expect(idx.query([0, 0, 50, 50]).map((p) => p.id)).toEqual(['a'])
    expect(idx.query([0, 0, 1000, 1000]).map((p) => p.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('clamps queries outside the sheet and returns each spanning item once', () => {
    const lines = [{ id: 'river', b: [0, 0, 1000, 1000] as [number, number, number, number] }]
    const li = new GridIndex(lines, (l) => l.b, 1000, 1000, 10)
    expect(li.query([-500, -500, 2000, 2000])).toHaveLength(1)
    expect(li.query([100, 100, 900, 900])).toHaveLength(1)
    expect(li.query([100, 100, 900, 900])).toHaveLength(1)
  })

  it('skips items without bounds', () => {
    const li = new GridIndex([{ b: null }, { b: [5, 5, 5, 5] as [number, number, number, number] }], (x) => x.b, 100, 100)
    expect(li.query([0, 0, 100, 100])).toHaveLength(1)
  })
})

describe('viewRect / boundsOf', () => {
  it('maps the screen back into sheet coordinates', () => {
    expect(viewRect({ k: 2, x: -100, y: -50 }, 400, 300)).toEqual([50, 25, 250, 175])
    expect(viewRect({ k: 1, x: 0, y: 0 }, 100, 100, 10)).toEqual([-10, -10, 110, 110])
  })
  it('bounds a polyline', () => {
    expect(boundsOf([[3, 9], [1, 4], [7, 2]])).toEqual([1, 2, 7, 9])
    expect(boundsOf([])).toBeNull()
  })
})
