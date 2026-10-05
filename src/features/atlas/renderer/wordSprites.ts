/** Bounded software glyph cache: river-course changes compose existing lettering instead of parsing and rasterising every letter again. */
export interface GlyphStyle {
  font: string
  size: number
  spacing: number
  halo: string
  haloWidth: number
  color: string
}
interface Glyph {
  stroke: HTMLCanvasElement | OffscreenCanvas
  fill: HTMLCanvasElement | OffscreenCanvas
  x: number
  y: number
  width: number
  height: number
}
export class WordSprites {
  private glyphs = new Map<string, Glyph>()
  private scratch: HTMLCanvasElement | OffscreenCanvas
  private context: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  constructor(
    private budget = 256,
    private createCanvas: () => HTMLCanvasElement | OffscreenCanvas = () => document.createElement('canvas'),
  ) {
    this.scratch = createCanvas()
    this.context = this.scratch.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  }
  get(char: string, style: GlyphStyle, dpr: number): Glyph {
    const key = JSON.stringify([char, style, dpr])
    const found = this.glyphs.get(key)
    if (found) {
      this.glyphs.delete(key)
      this.glyphs.set(key, found)
      return found
    }
    const width = Math.ceil(style.size * 4 * dpr) / dpr
    const height = Math.ceil(style.size * 4 * dpr) / dpr
    const x = -width / 2,
      y = -height / 2
    const pixelWidth = Math.round(width * dpr),
      pixelHeight = Math.round(height * dpr)
    if (this.scratch.width < pixelWidth || this.scratch.height < pixelHeight) {
      this.scratch.width = Math.max(this.scratch.width, pixelWidth)
      this.scratch.height = Math.max(this.scratch.height, pixelHeight)
    }
    const ctx = this.context
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    if (ctx.font !== style.font) ctx.font = style.font
    ctx.textAlign = 'center'
    ctx.textBaseline = 'alphabetic'
    ctx.letterSpacing = style.spacing + 'px'
    ctx.lineJoin = 'round'
    ctx.lineWidth = style.haloWidth
    ctx.strokeStyle = style.halo
    ctx.fillStyle = style.color
    const plane = (stroke: boolean) => {
      ctx.clearRect(0, 0, this.scratch.width / dpr, this.scratch.height / dpr)
      if (stroke) ctx.strokeText(char, -x, -y)
      else ctx.fillText(char, -x, -y)
      const canvas = this.createCanvas()
      canvas.width = pixelWidth
      canvas.height = pixelHeight
      const context = canvas.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
      context.drawImage(this.scratch, 0, 0)
      return canvas
    }
    const glyph = { stroke: plane(true), fill: plane(false), x, y, width, height }
    this.glyphs.set(key, glyph)
    if (this.glyphs.size > this.budget) {
      const oldest = this.glyphs.keys().next().value!
      this.release(this.glyphs.get(oldest)!)
      this.glyphs.delete(oldest)
    }
    return glyph
  }
  private release(glyph: Glyph) {
    glyph.stroke.width = glyph.stroke.height = glyph.fill.width = glyph.fill.height = 0
  }
  close() {
    for (const glyph of this.glyphs.values()) this.release(glyph)
    this.glyphs.clear()
    this.scratch.width = this.scratch.height = 0
  }
}
