/** Cached tile containers move on the compositor; the worker or idle queue draws outside camera frames. */
import { useEffect, useRef, type MutableRefObject } from 'react'
import type { Sheet } from '@/atlas/sheet'
import { lowPowerDevice } from '@/lib/device'
import { prefersReducedMotion } from '@/lib/motion'
import type { Transform } from '../labels'
import { TILE_SIZE, levelFor, tileBounds, tileKey, tilesFor, type Tile } from './tiles'
import { TileCache } from './tileCache'
import { TilePainter, type TileRequest, type TileSheet, type TileStyle } from './tilePainter'
import { TONES } from './palette'
import { tileSurface } from './tileSurface'
export interface BaseView {
  view: Transform
  width: number
  height: number
  rest: boolean
  active?: boolean
  near?: boolean
}
export type BasePort = (view: BaseView) => void
interface Resource {
  canvas: HTMLCanvasElement
  close(): void
}
interface Props {
  sheet: Sheet
  style: TileStyle
  port: MutableRefObject<BasePort | null>
  initial: () => BaseView
}
export function BaseLayer({ sheet, style, port, initial }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const currentStyle = useRef(style)
  currentStyle.current = style
  const reset = useRef<() => void>(() => {})
  useEffect(() => reset.current(), [style])
  useEffect(() => {
    const element = host.current
    if (!element) return
    const dpr = window.devicePixelRatio || 1
    const cache = new TileCache<Resource>(lowPowerDevice() ? 24 : 48)
    const coarse = Math.floor(Math.log2(TILE_SIZE / Math.max(sheet.width, sheet.height)))
    const layers = new Map<string, { node: HTMLDivElement; level: number; surface?: HTMLCanvasElement; signature?: string; gpuReady?: boolean }>()
    const presentation = document.createElement('canvas')
    presentation.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;display:none;'
    presentation.dataset.tilePresentation = 'true'
    element.appendChild(presentation)
    let gpu: ReturnType<typeof tileSurface> = null
    try { gpu = tileSurface(presentation) } catch { /* Native cached planes remain the fallback. */ }
    const contextLost = (event: Event) => {
      event.preventDefault()
      gpu?.close(); gpu = null
      presentation.style.display = 'none'
      for (const layer of layers.values()) layer.node.style.visibility = ''
    }
    presentation.addEventListener('webglcontextlost', contextLost)
    let alive = true
    let active = true
    let releaseTimer = 0
    let boot = 0
    let worker: Worker | null = null
    let painter: TilePainter | null = null
    let ready = false
    let latest = initial()
    let timer = 0
    let idle = 0
    let uploadFrame = 0
    let pendingBitmap: ImageBitmap | null = null
    let serial = 0
    let busy: { request: TileRequest; key: string; layer: string } | null = null
    let queue: Array<{ request: TileRequest; key: string; layer: string }> = []
    let previous = new Set<string>()
    let wanted = new Set<string>()
    let overviewKeys = new Set<string>()
    let retainedOverview = new Set<string>()
    let wantedLevel = 0
    let wantedInkK = 1
    let plannedCoverage = ''
    const effectiveStyle = () => {
      const current = currentStyle.current
      const paper = TONES[current.tone].paper
      return { ...current, showParks: latest.near ?? false, paper: paper.startsWith('var(') ? getComputedStyle(element).getPropertyValue('--bg').trim() : paper }
    }
    let renderedStyle = effectiveStyle()
    let keySerial = 0
    const styleKeys = new Map<string, string>(),
      travelKeys = new Map<string, string>()
    const shortKey = (keys: Map<string, string>, signature: string) => {
      let key = keys.get(signature)
      if (!key) {
        key = String(++keySerial)
        keys.set(signature, key)
        if (keys.size > 32) keys.delete(keys.keys().next().value!)
      }
      return key
    }
    let baseSignature = JSON.stringify({ ...renderedStyle, explored: null })
    let baseStyleKey = shortKey(styleKeys, baseSignature)
    let travelSignature = shortKey(travelKeys, [...(renderedStyle.explored ?? [])].sort().join('|'))
    let revision = 0
    let protectedKeys = new Set<string>()
    const tileSheet: TileSheet = {
      id: sheet.id,
      width: sheet.width,
      height: sheet.height,
      states: sheet.states,
      countries: sheet.countries,
      rivers: sheet.rivers,
      lakes: sheet.lakes,
      areas: sheet.areas,
      lines: sheet.lines,
      chunks: sheet.chunks,
      reliefUrl: new URL(sheet.reliefUrl, location.href).href,
      shadeUrl: new URL(sheet.shadeUrl, location.href).href,
    }
    const position = () => {
      const visible = [...layers].filter(([, layer]) => layer.node.style.opacity !== '0').sort((a, b) => Number(a[1].node.style.zIndex) - Number(b[1].node.style.zIndex))
      const batched = !!gpu && visible.length > 0 && visible.every(([, layer]) => layer.gpuReady)
      presentation.style.display = batched ? '' : 'none'
      if (batched) {
        if (!presentation.isConnected) element.prepend(presentation)
        const width = Math.ceil(latest.width * dpr), height = Math.ceil(latest.height * dpr)
        if (presentation.width !== width) presentation.width = width
        if (presentation.height !== height) presentation.height = height
        presentation.style.width = latest.width + 'px'; presentation.style.height = latest.height + 'px'
        gpu!.draw(latest.view, latest.width, latest.height, visible.map(([key]) => key))
      }
      for (const { node, level } of layers.values()) {
        node.style.visibility = batched ? 'hidden' : ''
        if (node.style.opacity === '0') continue
        if (batched) continue
        const scale = latest.view.k / 2 ** level
        node.style.transform = 'translate3d(' + latest.view.x + 'px,' + latest.view.y + 'px,0) scale(' + scale + ')'
      }
      // Read-only harness instrumentation avoids a diagnostic SVG or per-frame attribute writes.
      Object.assign(element, { atlasView: { ...latest.view }, atlasSheet: { width: sheet.width, height: sheet.height } })
    }
    Object.assign(element, { atlasReadPixels: () => {
      position()
      return gpu && presentation.style.display !== 'none'
        ? { pixels: gpu.read(), width: presentation.width, height: presentation.height, bottomUp: true }
        : null
    } })
    const layerFor = (key: string, level: number) => {
      let layer = layers.get(key)
      if (!layer) {
        const node = document.createElement('div')
        Object.assign(node.style, {
          position: 'absolute',
          left: '0',
          top: '0',
          transformOrigin: '0 0',
          width: sheet.width * 2 ** level + 'px',
          height: sheet.height * 2 ** level + 'px',
          contain: 'strict',
          willChange: 'transform',
          opacity: key.includes(':overview:') && !retainedOverview.size ? '1' : '0',
          zIndex: String((key.includes(':overview:') ? 0 : 2) + (key.includes(':travel:') ? 1 : 0)),
          transition: prefersReducedMotion() ? 'none' : 'opacity var(--dur-base) var(--motion-ease-out)',
        })
        node.dataset.tileLevel = String(level)
        node.dataset.tileKind = key.includes(':overview:') ? 'overview' : 'detail'
        element.appendChild(node)
        layer = { node, level }
        layers.set(key, layer)
        node.style.transform = 'translate3d(' + latest.view.x + 'px,' + latest.view.y + 'px,0) scale(' + latest.view.k / 2 ** level + ')'
        position()
      }
      return layer.node
    }
    const travelIntersects = (tile: Tile, inkK: number) => {
      const bounds = tileBounds(tile),
        pad = 4 / inkK
      const units = sheet.states.length ? sheet.states : sheet.countries
      return units.some((f) => renderedStyle.explored?.includes(f.id) && f.bbox[0] <= bounds[2] + pad && f.bbox[2] >= bounds[0] - pad && f.bbox[1] <= bounds[3] + pad && f.bbox[3] >= bounds[1] - pad)
    }
    const pack = (key: string) => {
      const layer = layers.get(key)
      if (!layer) return
      const allTiles = [...layer.node.querySelectorAll<HTMLCanvasElement>('canvas:not([data-tile-surface])')]
      const nearby = new Set(tilesFor(latest.view, latest.width, latest.height, sheet.width, sheet.height, layer.level, 1).map((tile) => tile.x * TILE_SIZE + ':' + tile.y * TILE_SIZE))
      const tiles = allTiles.filter((tile) => tile.style.visibility !== 'hidden' && (key.includes(':overview:') || nearby.has(parseFloat(tile.style.left) + ':' + parseFloat(tile.style.top))))
      if (!tiles.length) return
      const signature = tiles.map((tile) => tile.dataset.tileRaster).join(':')
      if (signature === layer.signature) return
      const x = Math.min(...tiles.map((tile) => parseFloat(tile.style.left))), y = Math.min(...tiles.map((tile) => parseFloat(tile.style.top)))
      const right = Math.max(...tiles.map((tile) => parseFloat(tile.style.left) + TILE_SIZE)), bottom = Math.max(...tiles.map((tile) => parseFloat(tile.style.top) + TILE_SIZE))
      // Sparse old addresses must never allocate a world-sized backing store.
      // Retain the native tile path if packing would exceed the existing pixel budget.
      if ((right - x) * (bottom - y) > cache.budget * TILE_SIZE * TILE_SIZE) {
        for (const tile of allTiles) tile.style.display = ''
        layer.surface?.remove()
        if (layer.surface) layer.surface.width = layer.surface.height = 0
        layer.surface = undefined
        layer.signature = undefined
        layer.gpuReady = false
        gpu?.remove(key)
        return
      }
      const surface = layer.surface ?? document.createElement('canvas')
      if (surface.width !== right - x) surface.width = right - x
      if (surface.height !== bottom - y) surface.height = bottom - y
      const context = surface.getContext('2d')
      if (!context) return
      // Pack existing tile pixels only at rest. The LRU still owns every native tile;
      // one surface per plane avoids a separate compositor layer for each bitmap.
      context.clearRect(0, 0, surface.width, surface.height)
      for (const tile of tiles) context.drawImage(tile, parseFloat(tile.style.left) - x, parseFloat(tile.style.top) - y)
      surface.dataset.tileSurface = 'true'
      surface.dataset.tileSources = signature
      surface.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:${surface.width}px;height:${surface.height}px;`
      Object.assign(surface, { atlasInkK: (tiles[0] as HTMLCanvasElement & { atlasInkK: number }).atlasInkK })
      layer.node.appendChild(surface)
      for (const tile of layer.node.querySelectorAll<HTMLCanvasElement>('canvas:not([data-tile-surface])')) tile.style.display = 'none'
      layer.surface = surface
      layer.signature = signature
      layer.gpuReady = gpu?.update(key, surface, layer.level, x, y) ?? false
    }
    const removeLayer = (key: string) => {
      const layer = layers.get(key)
      if (!layer) return
      if (layer.surface) layer.surface.width = layer.surface.height = 0
      gpu?.remove(key)
      layer.node.remove()
      layers.delete(key)
    }
    const refresh = () => {
      // Keep one coherent raster plane while the camera moves; cached levels become visible at rest.
      if (!latest.rest) {
        element.dataset.tilesReady = 'false'
        element.dataset.tileCacheSize = String(cache.size)
        return
      }
      const overviewTile = tileKey({ level: coarse, x: 0, y: 0 })
      const overviewReady = overviewKeys.size > 0 && [...overviewKeys].every((key) => cache.get(key + ':' + overviewTile))
      const visible = tilesFor(latest.view, latest.width, latest.height, sheet.width, sheet.height, wantedLevel)
      const complete = [...wanted].every((key) => visible.filter((t) => !key.includes(':travel:') || travelIntersects(t, wantedInkK)).every((tile) => cache.get(key + ':' + tileKey(tile))))
      if (overviewReady && complete) {
        // Keep the preceding whole-sheet fallback until both replacement planes exist.
        // Its strokes use the requested view's ink scale, independently of its coarse raster density.
        retainedOverview = new Set(overviewKeys)
        for (const [key, layer] of layers) if (key.includes(':overview:')) layer.node.style.opacity = overviewKeys.has(key) ? '1' : '0'
      }
      element.dataset.tilesReady = String(!!visible.length && complete && overviewReady && !!wanted.size)
      if (visible.length && complete && overviewReady && wanted.size) {
        const base = [...wanted].find((key) => key.includes(':base:'))!
        const travel = [...wanted].find((key) => key.includes(':travel:'))
        // Progress tiles contain the complete painter result. Hide the matching base tile once ready,
        // retaining its cache entry so changing history never invalidates the unchanged cartography.
        for (const tile of tilesFor(latest.view, latest.width, latest.height, sheet.width, sheet.height, wantedLevel, 1)) {
          const resource = cache.get(base + ':' + tileKey(tile))
          if (resource) resource.canvas.style.visibility = travel && cache.get(travel + ':' + tileKey(tile)) ? 'hidden' : 'visible'
        }
        for (const key of wanted) {
          const layer = layers.get(key)
          if (layer) {
            layer.node.style.transform = 'translate3d(' + latest.view.x + 'px,' + latest.view.y + 'px,0) scale(' + latest.view.k / 2 ** layer.level + ')'
            layer.node.style.opacity = '1'
          }
        }
        for (const key of [...wanted, ...overviewKeys]) pack(key)
        previous = new Set(wanted)
        element.dataset.tilesReady = 'true'
        for (const [key, layer] of layers) if (!wanted.has(key) && !overviewKeys.has(key) && !retainedOverview.has(key)) layer.node.style.opacity = '0'
      }
      element.dataset.tileCacheSize = String(cache.size)
      element.dataset.tileCacheBudget = String(cache.budget)
      position()
    }
    const install = (bitmap: ImageBitmap, requestId: number) => {
      if (busy?.request.id !== requestId) {
        bitmap.close()
        return
      }
      const job = busy
      busy = null
      if (!job || !alive || job.request.generation !== revision) {
        bitmap.close()
        pump()
        return
      }
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = TILE_SIZE
      canvas.style.cssText = 'position:absolute;width:512px;height:512px;'
      canvas.style.left = job.request.tile.x * TILE_SIZE + 'px'
      canvas.style.top = job.request.tile.y * TILE_SIZE + 'px'
      const bitmapContext = canvas.getContext('bitmaprenderer', { alpha: false })
      if (bitmapContext) bitmapContext.transferFromImageBitmap(bitmap)
      else {
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) {
          bitmap.close()
          pump()
          return
        }
        context.drawImage(bitmap, 0, 0)
      }
      bitmap.close()
      const resource = {
        canvas,
        close: () => {
          canvas.remove()
          canvas.width = canvas.height = 0
        },
      }
      Object.assign(canvas, { atlasInkK: job.request.inkK })
      canvas.dataset.tileRaster = String(job.request.id)
      if (cache.put(job.key, resource, cache.generation, protectedKeys)) {
        // Adjacent-level prefetches stay detached until requested; their backing stores still count in the LRU.
        if (wanted.has(job.layer) || previous.has(job.layer) || overviewKeys.has(job.layer)) layerFor(job.layer, job.request.tile.level).appendChild(canvas)
      }
      refresh()
      pump()
    }
    const uploadPending = () => {
      idle = 0
      if (!latest.rest || !pendingBitmap || !busy) return
      const bitmap = pendingBitmap
      pendingBitmap = null
      install(bitmap, busy.request.id)
    }
    const scheduleUpload = () => {
      if (idle || uploadFrame || !latest.rest || !pendingBitmap) return
      // At most one native raster transfer per frame, even when worker results arrive in an idle burst.
      uploadFrame = requestAnimationFrame(() => {
        uploadFrame = 0
        if (!alive || !latest.rest || !pendingBitmap) return
        if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(uploadPending, { timeout: 100 })
        else idle = Number(globalThis.setTimeout(uploadPending, 16))
      })
    }
    const receive = (bitmap: ImageBitmap, requestId: number) => {
      if (!alive || busy?.request.id !== requestId || busy.request.generation !== revision) {
        bitmap.close()
        if (busy?.request.id === requestId) busy = null
        pump()
        return
      }
      pendingBitmap = bitmap
      // A completed tile can wait offscreen while the existing overview/detail plane moves.
      // Uploading and attaching new canvas layers during zoom forces expensive GPU raster work.
      // One outstanding bitmap also bounds GPU transfer pressure.
      scheduleUpload()
    }
    const pump = () => {
      if (!alive || !active || !latest.rest || !ready || busy || !queue.length) return
      busy = queue.shift()!
      if (worker) worker.postMessage({ type: 'draw', generation: 1, request: busy.request })
      else {
        const run = () => {
          idle = 0
          if (!alive || !busy || !painter) return
          const canvas = document.createElement('canvas')
          canvas.width = canvas.height = TILE_SIZE
          const context = canvas.getContext('2d', { willReadFrequently: true })
          if (!context) return
          const job = busy
          painter.draw(context, job.request)
          void createImageBitmap(canvas).then((bitmap) => receive(bitmap, job.request.id))
        }
        // One tile per idle slice, with a bounded timeout so unsupported workers still make progress.
        if (typeof window.requestIdleCallback === 'function') idle = window.requestIdleCallback(run, { timeout: 250 })
        else idle = Number(globalThis.setTimeout(run, 16))
      }
    }
    const plan = () => {
      timer = 0
      if (!alive || !active || document.hidden) return
      // The retained overview covers motion. Planning levels that cannot be uploaded yet wastes camera time.
      if (!latest.rest) return
      let level = levelFor(latest.view.k, dpr)
      const hasTravel = !!renderedStyle.explored?.length
      const needed = (level: number) => {
        const visible = tilesFor(latest.view, latest.width, latest.height, sheet.width, sheet.height, level)
        return visible.length + (hasTravel ? visible.filter((t) => travelIntersects(t, latest.view.k)).length : 0) + (hasTravel ? 4 : 2)
      }
      // Dense DPR3 views and progress patches must fit the budget, not wait forever for impossible coverage.
      while (level > coarse && needed(level) > cache.budget) level--
      wantedLevel = level
      const inkK = latest.rest ? latest.view.k : 2 ** level / dpr
      wantedInkK = inkK
      const ink = inkK.toFixed(4)
      const visible = tilesFor(latest.view, latest.width, latest.height, sheet.width, sheet.height, level)
      const adjacentTiles = [level - 1, level + 1]
        .filter((adjacent) => adjacent >= coarse)
        .map((adjacent) => ({ level: adjacent, tiles: tilesFor(latest.view, latest.width, latest.height, sheet.width, sheet.height, adjacent) }))
      // A pan inside the same tile coverage needs only compositor placement. Preserve the
      // existing queue and LRU order instead of rebuilding equivalent requests every 120 ms.
      const coverage = [baseStyleKey, travelSignature, level, ink, visible.map(tileKey).sort().join('|'), ...adjacentTiles.map(({ tiles }) => tiles.map(tileKey).sort().join('|'))].join(':')
      // Incomplete coverage must still retry: a style reset can invalidate an in-flight
      // request for the same address, so queue identity alone never establishes readiness.
      if (coverage === plannedCoverage && element.dataset.tilesReady === 'true') return
      plannedCoverage = coverage
      const baseLayer = baseStyleKey + ':base:level:' + level + ':' + ink
      const travelLayer = baseStyleKey + ':travel:' + travelSignature + ':level:' + level + ':' + ink
      wanted = new Set(hasTravel ? [baseLayer, travelLayer] : [baseLayer])
      const overviewBase = baseStyleKey + ':base:overview:' + coarse + ':' + ink
      const overviewTravel = baseStyleKey + ':travel:' + travelSignature + ':overview:' + coarse + ':' + ink
      overviewKeys = new Set(hasTravel ? [overviewBase, overviewTravel] : [overviewBase])
      const overscan = tilesFor(latest.view, latest.width, latest.height, sheet.width, sheet.height, level, 1)
      const baseStyle = { ...renderedStyle, explored: null }
      const travelStyle = renderedStyle
      type Planned = { tile: { level: number; x: number; y: number }; layer: string; inkK: number; style: TileStyle }
      const requests: Planned[] = [{ tile: { level: coarse, x: 0, y: 0 }, layer: overviewBase, inkK, style: baseStyle }]
      if (hasTravel) requests.push({ tile: { level: coarse, x: 0, y: 0 }, layer: overviewTravel, inkK, style: travelStyle })
      const add = (tile: Planned['tile'], layer: string, inkK: number) => {
        requests.push({ tile, layer, inkK, style: baseStyle })
        if (hasTravel && travelIntersects(tile, inkK)) requests.push({ tile, layer: layer.replace(':base:', ':travel:' + travelSignature + ':'), inkK, style: travelStyle })
      }
      for (const tile of visible) add(tile, baseLayer, inkK)
      protectedKeys = new Set(requests.map((r) => r.layer + ':' + tileKey(r.tile)))
      for (const key of retainedOverview) protectedKeys.add(key + ':' + tileKey({ level: coarse, x: 0, y: 0 }))
      for (const tile of overscan) if (!visible.some((v) => tileKey(v) === tileKey(tile))) add(tile, baseLayer, inkK)
      for (const { level: adjacent, tiles } of adjacentTiles)
        for (const tile of tiles) add(tile, baseStyleKey + ':base:level:' + adjacent + ':' + (2 ** adjacent / dpr).toFixed(4), 2 ** adjacent / dpr)
      requests.splice(cache.budget)
      for (const r of requests) {
        const hit = cache.get(r.layer + ':' + tileKey(r.tile))
        if (latest.rest && hit && (wanted.has(r.layer) || previous.has(r.layer) || overviewKeys.has(r.layer)) && hit.canvas.parentElement !== layers.get(r.layer)?.node)
          layerFor(r.layer, r.tile.level).appendChild(hit.canvas)
      }
      queue = requests
        .filter((r) => !cache.get(r.layer + ':' + tileKey(r.tile)) && busy?.key !== r.layer + ':' + tileKey(r.tile))
        .map((r) => ({ key: r.layer + ':' + tileKey(r.tile), layer: r.layer, request: { id: ++serial, generation: revision, tile: r.tile, style: r.style, inkK: r.inkK, dpr } }))
      for (const key of layers.keys())
        if (!previous.has(key) && !wanted.has(key) && !overviewKeys.has(key) && !retainedOverview.has(key)) {
          removeLayer(key)
        }
      refresh()
      pump()
    }
    const pause = () => {
      queue = []
      busy = null
      revision++
      plannedCoverage = ''
      window.clearTimeout(timer)
      timer = 0
      cancelAnimationFrame(uploadFrame)
      uploadFrame = 0
      if ('cancelIdleCallback' in window) window.cancelIdleCallback(idle)
      window.clearTimeout(idle)
      idle = 0
      pendingBitmap?.close()
      pendingBitmap = null
      window.clearTimeout(releaseTimer)
      releaseTimer = window.setTimeout(release, 60_000)
    }
    port.current = (view) => {
      const nearChanged = latest.near !== view.near
      if (latest.rest && !view.rest) element.dataset.tilesReady = 'false'
      latest = view
      if (nearChanged) reset.current()
      if (view.active !== undefined) {
        active = view.active
        if (!active) {
          pause()
          return
        }
        window.clearTimeout(releaseTimer)
        if (!ready && !worker && !painter) initialize()
      }
      position()
      scheduleUpload()
      // Planning is scheduled outside the camera callback. Panning itself only changes level transforms.
      if (latest.rest && !timer) timer = window.setTimeout(plan, 0)
    }
    reset.current = () => {
      renderedStyle = effectiveStyle()
      revision++
      plannedCoverage = ''
      const signature = JSON.stringify({ ...renderedStyle, explored: null })
      if (signature !== baseSignature) {
        baseStyleKey = shortKey(styleKeys, signature)
        baseSignature = signature
      }
      travelSignature = shortKey(travelKeys, [...(renderedStyle.explored ?? [])].sort().join('|'))
      // Style/progress changes keep the previous sheet visible until the replacement has coverage.
      queue = []
      if (!timer) timer = window.setTimeout(plan, 0)
    }
    const fallback = () => {
      const token = ++boot
      revision++
      plannedCoverage = ''
      cancelAnimationFrame(uploadFrame)
      uploadFrame = 0
      if ('cancelIdleCallback' in window) window.cancelIdleCallback(idle)
      window.clearTimeout(idle)
      idle = 0
      pendingBitmap?.close()
      pendingBitmap = null
      worker?.terminate()
      worker = null
      ready = false
      busy = null
      void TilePainter.create(tileSheet)
        .then((next) => {
          if (!alive || token !== boot) {
            next.close()
            return
          }
          painter = next
          ready = true
          plan()
        })
        .catch((error: unknown) => {
          element.dataset.tileError = String(error)
        })
    }
    const initialize = () => {
      try {
        if (typeof OffscreenCanvas === 'undefined') fallback()
        else {
          const nextWorker = new Worker(new URL('./tileWorker.ts', import.meta.url), { type: 'module' })
          worker = nextWorker
          worker.onmessage = (event: MessageEvent<{ type: string; bitmap?: ImageBitmap; id?: number }>) => {
            if (!alive || worker !== nextWorker) {
              event.data.bitmap?.close()
              return
            }
            if (event.data.type === 'ready') {
              ready = true
              plan()
            } else if (event.data.type === 'tile') receive(event.data.bitmap!, event.data.id!)
            else if (event.data.type === 'error') fallback()
          }
          worker.onerror = () => {
            if (worker === nextWorker) fallback()
          }
          worker.postMessage({ type: 'init', generation: 1, sheet: tileSheet })
        }
      } catch {
        fallback()
      }
    }
    initialize()
    position()
      const release = () => {
      if (active && !document.hidden) return
      boot++
      revision++
      plannedCoverage = ''
      cancelAnimationFrame(uploadFrame)
      uploadFrame = 0
      worker?.terminate()
      worker = null
      painter?.close()
      painter = null
      ready = false
      busy = null
      if ('cancelIdleCallback' in window) window.cancelIdleCallback(idle)
      window.clearTimeout(idle)
      idle = 0
      pendingBitmap?.close()
      pendingBitmap = null
      cache.clear()
      element.dataset.tileCacheSize = '0'
      queue = []
      previous.clear()
      wanted.clear()
      overviewKeys.clear()
      retainedOverview.clear()
      element.dataset.tilesReady = 'false'
      for (const key of layers.keys()) removeLayer(key)
      layers.clear()
      presentation.width = presentation.height = 0
      presentation.remove()
    }
    const visibility = () => {
      if (document.hidden) {
        pause()
      } else {
        window.clearTimeout(releaseTimer)
        if (!ready && !worker && !painter) initialize()
        plan()
      }
    }
    document.addEventListener('visibilitychange', visibility)
    const theme = new MutationObserver(() => {
      const next = effectiveStyle()
      if (next.paper !== renderedStyle.paper) reset.current()
    })
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => {
      alive = false
      boot++
      window.clearTimeout(releaseTimer)
      port.current = null
      reset.current = () => {}
      worker?.terminate()
      painter?.close()
      cache.clear()
      window.clearTimeout(timer)
      cancelAnimationFrame(uploadFrame)
      if ('cancelIdleCallback' in window) window.cancelIdleCallback(idle)
      window.clearTimeout(idle)
      pendingBitmap?.close()
      pendingBitmap = null
      document.removeEventListener('visibilitychange', visibility)
      theme.disconnect()
      for (const key of layers.keys()) removeLayer(key)
      layers.clear()
      presentation.removeEventListener('webglcontextlost', contextLost)
      gpu?.close()
      presentation.width = presentation.height = 0
      presentation.remove()
    }
  }, [sheet, port]) // eslint-disable-line react-hooks/exhaustive-deps
  // Tile z-indices order base rasters only; they must never cover sibling names/symbols.
  return <div ref={host} className="atlas-base isolate pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true" />
}
