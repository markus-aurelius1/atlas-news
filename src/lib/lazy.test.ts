import { describe, expect, it, vi } from 'vitest'
import { isChunkError, reloadOnceForChunk } from './lazy'

const memory = () => {
  const data = new Map<string, string>()
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) }
}

describe('chunk failure recovery', () => {
  it('recognises failed dynamic imports across browsers', () => {
    expect(isChunkError(new TypeError('Failed to fetch dynamically imported module: https://x/assets/AtlasScreen-abc.js'))).toBe(true)
    expect(isChunkError(new TypeError('Importing a module script failed.'))).toBe(true)
    expect(isChunkError(new TypeError('error loading dynamically imported module'))).toBe(true)
    expect(isChunkError(new Error('Cannot read properties of undefined'))).toBe(false)
  })

  it('reloads once, then lets the error through', () => {
    const storage = memory()
    const reload = vi.fn()
    expect(reloadOnceForChunk(storage, reload)).toBe(true)
    expect(reloadOnceForChunk(storage, reload)).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('never reloads when storage is unavailable, so it cannot loop', () => {
    const reload = vi.fn()
    const broken = { getItem: () => { throw new Error('denied') }, setItem: () => {} }
    expect(reloadOnceForChunk(broken, reload)).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})
