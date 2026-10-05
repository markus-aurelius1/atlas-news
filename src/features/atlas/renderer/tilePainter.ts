/** The shared worker/idle painter, preserving the SVG reference's layer order and rounded paths. */
import type { Sheet } from '@/atlas/sheet'
import type { Rect } from '@/atlas/spatial'
import { chunkPath, IndexedPath } from './geometry'
import { POLITICAL } from '../style'
import { TONES } from './palette'
import type { Plate, Tone } from './types'
import { TILE_SIZE, tileBounds, type Tile } from './tiles'
export type TileSheet = Pick<Sheet, 'id' | 'width' | 'height' | 'states' | 'countries' | 'lakes' | 'rivers' | 'areas' | 'lines' | 'chunks' | 'reliefUrl' | 'shadeUrl'>
export interface TileStyle {
  plate: Plate
  tone: Tone
  colours: Array<[string, string]>
  showAreas: boolean
  showParks?: boolean
  paper?: string
  explored: string[] | null
}
export interface TileRequest {
  id: number
  generation: number
  tile: Tile
  style: TileStyle
  inkK: number
  dpr: number
}
type Context = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
const intersects = (a: Rect, b: Rect) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]
export class TilePainter {
  private readonly paths = new Map<string, IndexedPath>()
  private readonly relief: ImageBitmap
  private readonly shade: ImageBitmap
  private constructor(
    readonly sheet: TileSheet,
    relief: ImageBitmap,
    shade: ImageBitmap,
  ) {
    this.relief = relief
    this.shade = shade
    const add = (key: string, d: string) => this.paths.set(key, new IndexedPath(sheet.chunks?.[key] ?? chunkPath(d), sheet.width, sheet.height))
    for (const [key, d] of Object.entries(sheet.lines)) add(key, d)
    for (const group of ['states', 'countries', 'lakes', 'rivers', 'areas'] as const) for (const f of sheet[group]) add(group + ':' + f.id, f.d)
  }
  static async create(sheet: TileSheet) {
    const load = async (url: string) => createImageBitmap(await (await fetch(url)).blob())
    const [relief, shade] = await Promise.all([load(sheet.reliefUrl), load(sheet.shadeUrl)])
    return new TilePainter(sheet, relief, shade)
  }
  close() {
    this.relief.close()
    this.shade.close()
    this.paths.clear()
  }
  draw(ctx: Context, request: TileRequest) {
    const { sheet } = this
    const { tile, style, inkK, dpr } = request
    const palette = TONES[style.tone]
    const physical = style.plate === 'physical' && !palette.political
    const india = sheet.states.length > 0
    const density = 2 ** tile.level
    const b = tileBounds(tile)
    const pad = 5 / inkK
    const bounds: Rect = [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad]
    ctx.clearRect(0, 0, TILE_SIZE, TILE_SIZE)
    if (style.paper) {
      // Relief PNG nodata is transparent. Opaque tile transfers must composite it over the same page paper as the SVG.
      ctx.fillStyle = style.paper
      ctx.fillRect(0, 0, TILE_SIZE, TILE_SIZE)
    }
    ctx.save()
    ctx.setTransform(density, 0, 0, density, -b[0] * density, -b[1] * density)
    ctx.beginPath()
    ctx.rect(0, 0, sheet.width, sheet.height)
    ctx.clip()
    const fill = (key: string, colour: string, alpha = 1) => {
      const path = this.paths.get(key)
      if (!path || !intersects(path.source.bbox, bounds)) return
      ctx.fillStyle = colour
      ctx.globalAlpha = alpha
      ctx.fill(path.fill)
    }
    const stroke = (key: string, colour: string, width: number, dash: number[] = [], alpha = 1, round = false) => {
      const path = this.paths.get(key)
      if (!path) return
      ctx.strokeStyle = colour
      ctx.globalAlpha = alpha
      ctx.lineWidth = width / inkK
      ctx.lineCap = round ? 'round' : 'butt'
      ctx.lineJoin = round ? 'round' : 'miter'
      ctx.setLineDash(dash.map((n) => n / inkK))
      for (const chunk of path.strokes.query(bounds)) {
        if (!intersects(chunk.bbox, bounds)) continue
        ctx.lineDashOffset = -chunk.offset
        ctx.stroke(chunk.path)
      }
      ctx.lineDashOffset = 0
    }
    // inkK is CSS pixels per sheet pixel; density includes device pixels.
    // It is fixed for each request, so no vector draw ever occurs in the camera frame.
    void dpr
    const studied = (india ? sheet.states : sheet.countries).filter((f) => style.explored?.includes(f.id))
    {
      if (physical) {
        // Whole-sheet fallbacks downsample the relief substantially; match SVG's image filtering.
        ctx.imageSmoothingQuality = 'high'
        ctx.filter = palette.imageFilter ?? 'none'
        ctx.drawImage(this.relief, 0, 0, sheet.width, sheet.height)
        ctx.filter = 'none'
      } else {
        ctx.fillStyle = palette.sea
        ctx.fillRect(0, 0, sheet.width, sheet.height)
        const colours = new Map(style.colours)
        const colour = (id: string) => {
          const c = colours.get(id)
          return c && palette.political ? (palette.political[POLITICAL.indexOf(c) % palette.political.length] ?? palette.political[0]) : c
        }
        for (const f of sheet.countries) fill('countries:' + f.id, india ? palette.neighbour : (colour(f.id) ?? palette.neighbour))
        for (const f of sheet.states) fill('states:' + f.id, colour(f.id) ?? '#eee')
        ctx.globalCompositeOperation = palette.political ? 'soft-light' : 'multiply'
        ctx.globalAlpha = palette.political ? 0.55 : 0.22
        ctx.drawImage(this.shade, 0, 0, sheet.width, sheet.height)
        ctx.globalCompositeOperation = 'source-over'
        ctx.globalAlpha = 1
      }
      for (const r of sheet.rivers) stroke('rivers:' + r.id, palette.river, ({ 1: 2.2, 2: 1.6, 3: 1.2, 4: 0.85 } as Record<number, number>)[r.rank] ?? 0.85, [], 1, true)
      for (const f of sheet.lakes) {
        fill('lakes:' + f.id, palette.lake)
        if (Math.max(f.bbox[2] - f.bbox[0], f.bbox[3] - f.bbox[1]) > (india ? 10 : 6)) stroke('lakes:' + f.id, palette.lakeStroke, 0.7)
      }
      for (const f of sheet.areas) {
        const key = 'areas:' + f.id
        if (f.kind === 'water') {
          fill(key, palette.lake)
          stroke(key, palette.lakeStroke, 0.6)
        }
        if (f.kind === 'park' && style.showAreas && style.showParks !== false) {
          fill(key, palette.park, 0.16)
          stroke(key, palette.parkLine, 0.9, [3, 2], 0.85)
        }
      }
    }
    for (const f of studied) fill((india ? 'states:' : 'countries:') + f.id, palette.studied, physical ? 0.07 : 0.1)
    {
      stroke('graticule', palette.graticule, 0.6, [], 0.45)
      stroke('coasts', palette.coast, 0.9)
      if (india) {
        stroke('indiaCoast', palette.indiaCoast, 1)
        stroke('stateBorders', palette.halo, 2.6, [], 0.55)
        stroke('stateBorders', palette.stateBorder, 1.15, [5, 2.5])
      }
    }
    for (const f of studied) stroke((india ? 'states:' : 'countries:') + f.id, palette.studied, 1.7, [], 0.8, true)
    {
      for (const f of sheet.areas)
        if (f.kind === 'region' && style.showAreas) {
          fill('areas:' + f.id, palette.dispute, 0.07)
          stroke('areas:' + f.id, palette.dispute, 1.1, [5, 3])
        }
      stroke('intlBorders', palette.halo, india ? 3.6 : 2.4, [], 0.7)
      stroke('intlBorders', palette.border, india ? 1.6 : 0.9, india ? [8, 2.5, 2, 2.5] : [4, 2])
      if (india) {
        stroke('indiaBorder', palette.halo, 4.6, [], 0.75)
        stroke('indiaBorder', palette.indiaBorder, 2.2, [9, 3, 2.5, 3])
      }
      ctx.globalAlpha = 1
      ctx.strokeStyle = palette.neatline
      ctx.lineWidth = 1.2 / inkK
      ctx.setLineDash([])
      ctx.strokeRect(0, 0, sheet.width, sheet.height)
    }
    ctx.restore()
  }
}
