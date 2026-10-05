/** Batched fixed-size labels: camera frames update three uniforms rather than a compositor object per word. */
import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject } from 'react'
import type { Sheet } from '@/atlas/sheet'
import type { Place } from '@/atlas/types'
import { labelKeyOf, type PlacedLabel, type Transform } from '../labels'
import { curveGlyphs, type LabelAnchor } from './labelMotion'
import { gpuLabels, rasterLabels } from './labelBatch'
import type { Layout, Tone } from './types'
import type { LabelPort } from './LabelLayer'
interface Props {
  labels: PlacedLabel[]
  layout: Layout | null
  tone: Tone
  sheet: Sheet
  places: Place[]
  port: MutableRefObject<LabelPort | null>
  current: () => Transform
}
export function BatchLabelLayer({ labels, layout, tone, sheet, places, port, current }: Props) {
  const host = useRef<HTMLDivElement>(null), times = useRef<number[]>([])
  const [software, setSoftware] = useState(false)
  const surface = useRef<{ canvas: HTMLCanvasElement; gpu: ReturnType<typeof gpuLabels>; software: boolean; lost: (event: Event) => void } | null>(null)
  const release = () => {
    const old = surface.current
    if (!old) return
    old.canvas.removeEventListener('webglcontextlost', old.lost)
    old.gpu?.close()
    old.canvas.width = old.canvas.height = 0
    old.canvas.remove()
    surface.current = null
  }
  useEffect(() => () => { port.current = null; release() }, [port])
  useLayoutEffect(() => {
    const element = host.current
    if (!element || !layout) return
    const points = new Map(sheet.labels.map(label => [labelKeyOf(label), label]))
    const placePoints = new Map(places.map(place => [place.id, place]))
    const positioned: Array<{ label: PlacedLabel; anchor: LabelAnchor }> = []
    for (const label of labels) {
      if (!label.text) continue
      let x = label.x, y = label.y
      let source: { x?: number; y?: number } | undefined = label.key.startsWith('place:') ? placePoints.get(label.placeId ?? label.key.slice(6)) : points.get(label.key)
      if (label.path) {
        const curve = curveGlyphs(label.path, [])
        if (!curve) continue
        x = curve.centre.x + layout.fx - layout.x
        y = curve.centre.y + layout.fy - layout.y
        source = undefined
      }
      const worldX = source?.x ?? (x - layout.fx) / layout.k, worldY = source?.y ?? (y - layout.fy) / layout.k
      positioned.push({ label, anchor: { worldX, worldY, offsetX: x - worldX * layout.k - layout.fx, offsetY: y - worldY * layout.k - layout.fy } })
    }
    const dpr = window.devicePixelRatio || 1
    const borrowed = positioned[0]?.label.atlasBitmap
    const raster = borrowed && positioned.every(e => e.label.atlasBitmap === borrowed && e.label.raster)
      ? { atlas: borrowed, dpr, entries: positioned.map(e => ({ ...e, ...e.label.raster! })) }
      : rasterLabels(positioned, tone, dpr)
    if (surface.current?.software !== software) release()
    if (!surface.current) {
      let canvas = document.createElement('canvas')
      let gpu: ReturnType<typeof gpuLabels> = null
      if (!software) {
        try { gpu = gpuLabels(canvas, raster) } catch { /* The same raster can be displayed by the software surface. */ }
      }
      if (!gpu) { canvas.width = canvas.height = 0; canvas = document.createElement('canvas') }
      const lost = (event: Event) => { event.preventDefault(); setSoftware(true) }
      canvas.addEventListener('webglcontextlost', lost)
      element.append(canvas)
      surface.current = { canvas, gpu, software, lost }
    } else {
      try { surface.current.gpu?.update(raster) }
      catch {
        release()
        if (!borrowed && !(raster.atlas instanceof ImageBitmap)) raster.atlas.width = raster.atlas.height = 0
        setSoftware(true)
        return
      }
    }
    const { canvas, gpu } = surface.current
    const pixelWidth = Math.ceil(layout.w * dpr), pixelHeight = Math.ceil(layout.h * dpr)
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth; canvas.height = pixelHeight
    }
    canvas.style.width = layout.w + 'px'; canvas.style.height = layout.h + 'px'
    canvas.dataset.labelSurface = gpu ? 'webgl' : 'software'
    const ctx = gpu ? null : canvas.getContext('2d')!
    let view = current()
    // Diagnostics expose the actual submitted geometry and source pixels; browser audits also inspect painted output.
    Object.assign(element, {
      atlasEntries: raster.entries,
      atlasRaster: raster.atlas,
      atlasDpr: dpr,
      atlasPositionTimes: times.current,
      atlasLabelView: () => view,
    })
    const draw: LabelPort = next => {
      const start = performance.now()
      view = next
      if (gpu) gpu.draw(next.k, next.x, next.y, layout.w, layout.h)
      else {
        ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx!.clearRect(0, 0, layout.w, layout.h)
        for (const e of raster.entries) {
          const x = next.x + e.anchor.worldX * next.k + e.anchor.offsetX + e.left
          const y = next.y + e.anchor.worldY * next.k + e.anchor.offsetY + e.top
          if (x + e.width < 0 || y + e.height < 0 || x > layout.w || y > layout.h) continue
          ctx!.drawImage(raster.atlas, e.x, e.y, e.width * dpr, e.height * dpr, x, y, e.width, e.height)
        }
      }
      times.current.push(performance.now() - start)
      if (times.current.length > 240) times.current.shift()
    }
    port.current = draw
    Object.assign(element, { atlasReadPixels: () => {
      draw(view)
      return { pixels: gpu ? gpu.read() : ctx!.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height, bottomUp: !!gpu }
    } })
    draw(view)
    return () => {
      if (port.current === draw) port.current = null
      if (!borrowed && !(raster.atlas instanceof ImageBitmap)) raster.atlas.width = raster.atlas.height = 0
    }
  }, [labels, layout, tone, sheet, places, port, software]) // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={host} className="atlas-names absolute inset-0" aria-hidden="true" />
}
