// @vitest-environment happy-dom
/** Worker placement must retain the last committed snapshot, reject stale replies, and recover after a worker failure. */
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Sheet } from '@/atlas/sheet'
import { layoutLabels, type LayoutInput, type PlacedLabel } from '../labels'
import { useLabelLayout } from './useLabelLayout'
import type { Layout } from './types'
vi.mock('../labels', () => ({ layoutLabels: vi.fn(() => []) }))
class TestWorker {
  static instances: TestWorker[] = []
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  messages: Array<{ type: string; id?: number }> = []
  terminated = false
  constructor() {
    TestWorker.instances.push(this)
  }
  postMessage(message: { type: string; id?: number }) {
    this.messages.push(message)
  }
  terminate() {
    this.terminated = true
  }
  reply(value: unknown) {
    act(() => this.onmessage?.({ data: value } as MessageEvent))
  }
  get request() {
    return this.messages.filter((m) => m.type === 'layout').at(-1)!.id!
  }
}
const sheet = { id: 'india', width: 1000, height: 1000, labels: [] } as unknown as Sheet
const snapshot: Layout = { k: 1, x: -20, y: -30, fx: -10, fy: -10, w: 390, h: 844, o: 200 }
const input: LayoutInput = { labels: [], places: [], t: snapshot, kFit: 1, width: 390, height: 844, mutedIds: new Set(), linked: new Map(), foggedStates: new Set(), sheetId: 'india' }
const label: PlacedLabel = { key: 'place:leh', text: 'Leh', style: 'place', x: 100, y: 120, anchor: 'start', size: 12.5, opt: 0 }
const setup = (initialInput: LayoutInput = input) => {
  const prefer = { current: new Map<string, number>() }
  const hook = renderHook(({ input, layout, source }) => useLabelLayout(source, input, layout, prefer), { initialProps: { input: initialInput, layout: snapshot, source: sheet } })
  return { ...hook, prefer, worker: TestWorker.instances.at(-1)! }
}
beforeEach(() => {
  TestWorker.instances = []
  vi.stubGlobal('Worker', TestWorker)
  vi.stubGlobal('OffscreenCanvas', class {})
  vi.stubGlobal('FontFace', class {})
  vi.mocked(layoutLabels).mockReturnValue([])
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})
describe('worker placement lifecycle', () => {
  it('closes a shared sprite atlas once per stale snapshot and retains committed atlas pixels until replacement', () => {
    const { worker, rerender, unmount } = setup()
    worker.reply({ type: 'ready' })
    const first = { close: vi.fn() } as unknown as ImageBitmap
    const stale = { close: vi.fn() } as unknown as ImageBitmap
    const next = { close: vi.fn() } as unknown as ImageBitmap
    const words = (atlasBitmap: ImageBitmap) => [label, { ...label, key: 'place:delhi', text: 'Delhi' }].map(word => ({ ...word, atlasBitmap }))
    worker.reply({ type: 'labels', id: worker.request, labels: words(first) })
    const prior = worker.request
    rerender({ input: { ...input, width: 400 }, layout: snapshot, source: sheet })
    worker.reply({ type: 'labels', id: prior, labels: words(stale) })
    expect(stale.close).toHaveBeenCalledTimes(1)
    expect(first.close).not.toHaveBeenCalled()
    worker.reply({ type: 'labels', id: worker.request, labels: words(next) })
    expect(first.close).toHaveBeenCalledTimes(1)
    expect(next.close).not.toHaveBeenCalled()
    unmount()
    expect(next.close).toHaveBeenCalledTimes(1)
    expect(first.close).toHaveBeenCalledTimes(1)
  })
  it('commits symbol identities with the matching name snapshot while retaining both during a request', () => {
    const symbol = { place: { id: 'leh', name: 'Leh', kind: 'capital' as const, level: 1 as const }, x: 100, y: 100, mastery: 'discovered' as const, isNew: false, selected: false }
    const { result, worker, rerender } = setup({ ...input, places: [symbol] })
    worker.reply({ type: 'ready' })
    worker.reply({ type: 'labels', id: worker.request, labels: [label] })
    expect(result.current.symbolIds).toEqual(['leh'])
    rerender({ input: { ...input, places: [{ ...symbol, place: { ...symbol.place, id: 'delhi' } }] }, layout: snapshot, source: sheet })
    expect(result.current.symbolIds).toEqual(['leh'])
    expect(result.current.labels[0].text).toBe('Leh')
    worker.reply({ type: 'labels', id: worker.request, labels: [{ ...label, text: 'Delhi' }] })
    expect(result.current.symbolIds).toEqual(['delhi'])
    expect(result.current.labels[0].text).toBe('Delhi')
  })
  it('keeps committed names during a new request and rejects the superseded camera snapshot', () => {
    const { result, rerender, worker, prefer } = setup()
    worker.reply({ type: 'ready' })
    worker.reply({ type: 'labels', id: worker.request, labels: [label] })
    expect(result.current.labels[0]).toMatchObject({ x: 110, y: 140, text: 'Leh' })
    expect(prefer.current.get(label.key)).toBe(0)
    rerender({ input: { ...input, t: { ...snapshot, x: -40 } }, layout: { ...snapshot, x: -40 }, source: sheet })
    const stale = worker.request
    rerender({ input: { ...input, t: { ...snapshot, x: -60 } }, layout: { ...snapshot, x: -60 }, source: sheet })
    worker.reply({ type: 'labels', id: stale, labels: [{ ...label, text: 'Stale reply' }] })
    expect(result.current.labels[0].text).toBe('Leh')
    worker.reply({ type: 'labels', id: worker.request, labels: [label] })
    expect(result.current.labels[0].x).toBe(150)
  })
  it('does not carry India names or late replies into a new sheet, and terminates on unmount', () => {
    const { result, rerender, worker, unmount } = setup()
    worker.reply({ type: 'ready' })
    worker.reply({ type: 'labels', id: worker.request, labels: [label] })
    rerender({ input, layout: snapshot, source: { ...sheet, id: 'world' } })
    expect(worker.terminated).toBe(true)
    worker.reply({ type: 'labels', id: worker.request, labels: [label] })
    expect(result.current.labels).toEqual([])
    const next = TestWorker.instances.at(-1)!
    unmount()
    expect(next.terminated).toBe(true)
  })
  it('uses the shared placement implementation after worker failure', () => {
    const { result, worker } = setup()
    vi.mocked(layoutLabels).mockReturnValue([label])
    act(() => worker.onerror?.())
    expect(worker.terminated).toBe(true)
    expect(layoutLabels).toHaveBeenCalledWith(input)
    expect(result.current.labels[0].x).toBe(110)
  })
  it('retains committed curve bitmaps for effect replay, then closes superseded and unmounted resources', () => {
    const { rerender, worker, unmount } = setup()
    worker.reply({ type: 'ready' })
    const stale = worker.request
    rerender({ input: { ...input, t: { ...snapshot, x: -40 } }, layout: { ...snapshot, x: -40 }, source: sheet })
    const first = { close: vi.fn() } as unknown as ImageBitmap
    worker.reply({ type: 'labels', id: stale, labels: [{ ...label, curveBitmap: first }] })
    expect(first.close).toHaveBeenCalledOnce()
    const committed = { close: vi.fn() } as unknown as ImageBitmap
    worker.reply({ type: 'labels', id: worker.request, labels: [{ ...label, curveBitmap: committed }] })
    expect(committed.close).not.toHaveBeenCalled()
    rerender({ input: { ...input }, layout: snapshot, source: sheet })
    const replacement = { close: vi.fn() } as unknown as ImageBitmap
    worker.reply({ type: 'labels', id: worker.request, labels: [{ ...label, curveBitmap: replacement }] })
    expect(committed.close).toHaveBeenCalledOnce()
    expect(replacement.close).not.toHaveBeenCalled()
    unmount()
    expect(replacement.close).toHaveBeenCalledOnce()
    const late = { close: vi.fn() } as unknown as ImageBitmap
    worker.reply({ type: 'labels', id: worker.request, labels: [{ ...label, curveBitmap: late }] })
    expect(late.close).toHaveBeenCalledOnce()
  })
})
