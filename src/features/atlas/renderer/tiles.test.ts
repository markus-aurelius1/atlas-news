/** Coverage, fallback ancestry, geometry continuity and resource lifetime contracts. */
import { describe, expect, it, vi } from 'vitest'
import { childrenOf, levelFor, parentOf, tileBounds, tileKey, tilesFor } from './tiles'
import { TileCache } from './tileCache'
import { chunkPath } from './geometry'
describe('tile coverage', () => {
  it('chooses enough device pixels without scaling a tile bitmap up', () => {
    for (const dpr of [1, 1.25, 2, 3])
      for (const k of [0.12, 0.49, 0.8, 1.1, 3.4]) {
        expect(2 ** levelFor(k, dpr)).toBeGreaterThanOrEqual(k * dpr)
        expect(2 ** levelFor(k, dpr)).toBeLessThan(k * dpr * 2 + 0.00001)
      }
  })
  it('covers a clamped view centre first, with an overscan ring', () => {
    const view = { k: 1, x: -700, y: -400 }
    const visible = tilesFor(view, 1366, 900, 2400, 2104, 0)
    for (let y = 400; y < 1300; y += 50)
      for (let x = 700; x < 2066; x += 50)
        expect(
          visible.some((t) => {
            const b = tileBounds(t)
            return x >= b[0] && x < b[2] && y >= b[1] && y < b[3]
          }),
        ).toBe(true)
    expect(visible[0]).toEqual({ level: 0, x: 2, y: 1 })
    const overscan = tilesFor(view, 1366, 900, 2400, 2104, 0, 1)
    expect(overscan.length).toBeGreaterThan(visible.length)
    expect(new Set(overscan.map(tileKey)).size).toBe(overscan.length)
  })
  it('parent and children cover identical sheet bounds', () => {
    const parent = { level: -1, x: 2, y: 3 }
    for (const child of childrenOf(parent)) expect(parentOf(child)).toEqual(parent)
    const b = tileBounds(parent),
      kids = childrenOf(parent).map(tileBounds)
    expect([Math.min(...kids.map((c) => c[0])), Math.min(...kids.map((c) => c[1])), Math.max(...kids.map((c) => c[2])), Math.max(...kids.map((c) => c[3]))]).toEqual(b)
  })
})
describe('geometry', () => {
  it('keeps filled rings and holes exact while strokes are bounded', () => {
    const d = 'M0,0L4,0L4,4L0,4Z' + 'M1,1L1,2L2,2L2,1Z'
    const result = chunkPath(d, 2)
    expect(result.fill).toBe(d)
    expect(result.strokes).toHaveLength(4)
    expect(result.strokes.map((c) => c.offset)).toEqual([0, 8, 0, 2])
    expect(result.bbox).toEqual([0, 0, 4, 4])
    expect(result.strokes.every((c) => (c.d.match(/L/g)?.length ?? 0) <= 2)).toBe(true)
  })
  it('retains joins at chunk boundaries and dash distances across pieces', () => {
    const result = chunkPath('M0,0L3,4L6,8L9,12L12,16', 2)
    expect(result.strokes[1]).toMatchObject({ d: 'M6,8L9,12L12,16', offset: 10 })
  })
})
describe('bitmap LRU', () => {
  it('releases the least recently used bitmap and all surviving resources on clear', () => {
    const a = { close: vi.fn() },
      b = { close: vi.fn() },
      c = { close: vi.fn() }
    const cache = new TileCache(2)
    cache.put('a', a)
    cache.put('b', b)
    cache.get('a')
    cache.put('c', c)
    expect(b.close).toHaveBeenCalledTimes(1)
    expect(a.close).not.toHaveBeenCalled()
    expect(cache.size).toBe(2)
    cache.clear()
    expect(a.close).toHaveBeenCalledTimes(1)
    expect(c.close).toHaveBeenCalledTimes(1)
  })
  it('rejects stale generations and never evicts protected fallback tiles', () => {
    const cache = new TileCache(1),
      a = { close: vi.fn() },
      b = { close: vi.fn() }
    cache.put('a', a)
    expect(cache.put('b', b, 0, new Set(['a']))).toBe(false)
    expect(b.close).toHaveBeenCalledTimes(1)
    expect(cache.get('a')).toBe(a)
    const generation = cache.generation
    cache.clear()
    const stale = { close: vi.fn() }
    expect(cache.put('late', stale, generation)).toBe(false)
    expect(stale.close).toHaveBeenCalledTimes(1)
    expect(cache.size).toBe(0)
  })
})
