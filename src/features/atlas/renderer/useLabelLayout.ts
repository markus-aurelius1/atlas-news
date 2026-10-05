/** Retain the committed HTML layout while worker placement catches up; stale generations never reposition words. */
import { startTransition, useEffect, useRef, useState, type MutableRefObject } from 'react'
import type { Sheet } from '@/atlas/sheet'
import { layoutLabels, type LayoutInput, type PlacedLabel } from '../labels'
import type { Tone, Layout } from './types'
const closeLabels = (labels: PlacedLabel[]) => {
  for (const bitmap of new Set(labels.flatMap(label => [label.curveBitmap, label.atlasBitmap]).filter((bitmap): bitmap is ImageBitmap => !!bitmap))) bitmap.close()
}
export function useLabelLayout(sheet: Sheet, input: LayoutInput | null, layout: Layout | null, prefer: MutableRefObject<Map<string, number>>, tone: Tone = 'day') {
  const resources = useRef(new Map<ImageBitmap, number>())
  const sequence = useRef(0)
  const [result, setResult] = useState<{ sheet: Sheet | null; labels: PlacedLabel[]; layout: Layout | null; sequence: number; symbolIds: string[] }>({
    sheet: null,
    labels: [],
    layout: null,
    sequence: 0,
    symbolIds: [],
  })
  const latest = useRef({ input, layout, tone })
  latest.current = { input, layout, tone }
  useEffect(() => {
    for (const [bitmap, version] of resources.current)
      // The committed snapshot can repaint after a Suspense hide/reappearance.
      // Retain its rasters until a newer snapshot commits, or the hook unmounts.
      if (version < result.sequence) {
        bitmap.close()
        resources.current.delete(bitmap)
      }
  }, [result])
  useEffect(
    () => () => {
      for (const bitmap of resources.current.keys()) bitmap.close()
      resources.current.clear()
    },
    [],
  )
  const submit = useRef<() => void>(() => {})
  useEffect(() => {
    let alive = true,
      ready = false,
      serial = 0,
      worker: Worker | null = null
    const requests = new Map<number, { layout: Layout; symbolIds: string[] }>()
    const commit = (labels: PlacedLabel[], snapshot: Layout, symbolIds: string[]) => {
      prefer.current = new Map(labels.filter((label) => label.opt !== undefined).map((label) => [label.key, label.opt!]))
      const dx = snapshot.fx - snapshot.x,
        dy = snapshot.fy - snapshot.y
      const beyond = (label: PlacedLabel) => label.x < -40 || label.y < -20 || label.x > snapshot.w + 40 || label.y > snapshot.h + 20
      const version = ++sequence.current
      for (const label of labels) for (const bitmap of [label.curveBitmap, label.atlasBitmap]) if (bitmap) resources.current.set(bitmap, version)
      startTransition(() =>
        setResult({
          sequence: version,
          symbolIds,
          sheet,
          layout: snapshot,
          labels: labels.map((label) => (label.path ? label : { ...label, x: Math.round((label.x + dx) * 100) / 100, y: Math.round((label.y + dy) * 100) / 100, beyond: beyond(label) })),
        }),
      )
    }
    const request = () => {
      const { input, layout, tone } = latest.current
      if (!alive || !input || !layout) return
      const id = ++serial
      requests.clear()
      if (worker) {
        if (!ready) return
        requests.set(id, { layout, symbolIds: input.places.map((p) => p.place.id) })
        const { labels: _labels, index: _index, ...transport } = input
        worker.postMessage({ type: 'layout', id, input: transport, tone, dpr: window.devicePixelRatio || 1 })
      } else
        commit(
          layoutLabels(input),
          layout,
          input.places.map((p) => p.place.id),
        )
    }
    const fallback = () => {
      worker?.terminate()
      worker = null
      ready = false
      request()
    }
    submit.current = request
    try {
      if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined' || typeof FontFace === 'undefined') fallback()
      else {
        const next = new Worker(new URL('./labelWorker.ts', import.meta.url), { type: 'module' })
        worker = next
        next.onmessage = (event: MessageEvent<{ type: string; id: number; labels: PlacedLabel[] }>) => {
          if (!alive || worker !== next) {
            closeLabels(event.data.labels ?? [])
            return
          }
          if (event.data.type === 'ready') {
            ready = true
            request()
          } else if (event.data.type === 'error') fallback()
          else if (event.data.id === serial) {
            const snapshot = requests.get(event.data.id)
            if (snapshot) commit(event.data.labels, snapshot.layout, snapshot.symbolIds)
            else closeLabels(event.data.labels ?? [])
            requests.delete(event.data.id)
          } else closeLabels(event.data.labels ?? [])
        }
        next.onerror = () => {
          if (alive && worker === next) fallback()
        }
        next.postMessage({ type: 'init', labels: sheet.labels, width: sheet.width, height: sheet.height })
      }
    } catch {
      fallback()
    }
    return () => {
      alive = false
      worker?.terminate()
      requests.clear()
      submit.current = () => {}
    }
  }, [sheet, prefer])
  useEffect(() => submit.current(), [input, layout, tone])
  return result.sheet === sheet ? result : { labels: [], layout: null, symbolIds: [] }
}
