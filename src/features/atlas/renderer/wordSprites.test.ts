/** River lettering reuses native font work and releases bounded backing stores on eviction and unmount. */
// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { WordSprites } from './wordSprites'
describe('word sprites', () => {
  afterEach(() => vi.restoreAllMocks())
  const setup = () => {
    const calls: string[] = []
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () =>
        ({
          font: '',
          setTransform: vi.fn(),
          clearRect: vi.fn(),
          drawImage: vi.fn(),
          strokeText: (char: string) => calls.push('stroke:' + char),
          fillText: (char: string) => calls.push('fill:' + char),
        }) as unknown as CanvasRenderingContext2D,
    )
    const style = { font: 'italic 500 12px Manrope', size: 12, spacing: 0.36, halo: '#fff', haloWidth: 2.8, color: '#369' }
    return { style, calls }
  }
  it('reuses a letter until its font, paint or device density changes', () => {
    const { style, calls } = setup(),
      cache = new WordSprites()
    const first = cache.get('A', style, 3)
    expect(cache.get('A', style, 3)).toBe(first)
    expect(calls).toEqual(['stroke:A', 'fill:A'])
    expect(cache.get('A', { ...style, color: '#fff' }, 3)).not.toBe(first)
    expect(cache.get('A', style, 2)).not.toBe(first)
    cache.close()
    expect(first.stroke.width).toBe(0)
    expect(first.fill.height).toBe(0)
  })
  it('releases an evicted backing store and can repaint after cleanup', () => {
    const { style, calls } = setup(),
      cache = new WordSprites(1)
    const first = cache.get('A', style, 3)
    cache.get('B', style, 3)
    expect(first.stroke.width).toBe(0)
    cache.close()
    const restored = cache.get('A', style, 3)
    expect(restored.stroke.width).toBeGreaterThan(0)
    expect(calls).toEqual(['stroke:A', 'fill:A', 'stroke:B', 'fill:B', 'stroke:A', 'fill:A'])
    cache.close()
  })
})
