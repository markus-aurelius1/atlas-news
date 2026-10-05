/** Placement runs off the frame path with the same fonts, priorities, course windows and collision rules. */
import { labelIndexFor, layoutLabels, setLabelMeasureContext, type LayoutInput } from '../labels'
import type { MapLabel } from '@/atlas/types'
import { workerFonts } from './workerFonts'
import { rasterLabels } from './labelBatch'
import type { Tone } from './types'
import { WordSprites } from './wordSprites'
const sprites = new WordSprites(256, () => new OffscreenCanvas(1, 1))
let labels: MapLabel[] = []
let index: LayoutInput['index']
const scope = self as unknown as { postMessage(value: unknown, transfer?: Transferable[]): void; onmessage: ((event: MessageEvent) => void) | null }
scope.onmessage = (event: MessageEvent<{ type: string; labels?: MapLabel[]; width: number; height: number; id: number; input: LayoutInput; dpr?: number; tone?: Tone }>) => {
  const message = event.data
  if (message.type === 'init') {
    labels = message.labels!
    index = labelIndexFor(labels, message.width, message.height)
    void workerFonts
      .then(() => {
        const ctx = new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true })
        if (!ctx) throw new Error('No worker label measurement context')
        setLabelMeasureContext(ctx)
        scope.postMessage({ type: 'ready' })
      })
      .catch((error: unknown) => scope.postMessage({ type: 'error', error: String(error) }))
  } else if (message.type === 'layout') {
    const bitmaps: ImageBitmap[] = []
    try {
      const placed = layoutLabels({ ...message.input, labels, index })
      if (message.dpr && placed.length) {
        const raster = rasterLabels(placed.map(label => ({ label, anchor: { worldX: 0, worldY: 0, offsetX: 0, offsetY: 0 } })), message.tone ?? 'day', message.dpr, () => new OffscreenCanvas(1, 1), sprites)
        const bitmap = (raster.atlas as OffscreenCanvas).transferToImageBitmap()
        bitmaps.push(bitmap)
        for (const entry of raster.entries) {
          const { x, y, width, height, left, top, font } = entry
          entry.label.atlasBitmap = bitmap
          entry.label.raster = { x, y, width, height, left, top, font }
        }
        raster.atlas.width = raster.atlas.height = 0
      }
      scope.postMessage({ type: 'labels', id: message.id, labels: placed }, bitmaps)
    } catch (error) {
      for (const bitmap of bitmaps) bitmap.close()
      scope.postMessage({ type: 'error', error: String(error) })
    }
  }
}
