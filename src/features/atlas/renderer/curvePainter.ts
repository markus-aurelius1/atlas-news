/** Curve geometry and painting are shared by worker bitmaps and the software fallback. */
import { glyphAdvances, STYLE_SPEC, type PlacedLabel } from '../labels'
import { curveGlyphs } from './labelMotion'
import { labelPaint } from './labelPaint'
import type { Tone } from './types'
import type { WordSprites } from './wordSprites'
export function curveGeometry(label: PlacedLabel) {
  const spec = STYLE_SPEC[label.style]
  const curve = curveGlyphs(label.path!, label.glyphAdvances ?? glyphAdvances(label.text, label.size, spec.weight, spec.italic, spec.spacing))
  if (!curve) return null
  const minX = Math.min(...curve.glyphs.map((g) => g.x)) - label.size * 2
  const minY = Math.min(...curve.glyphs.map((g) => g.y)) - label.size * 2
  const width = Math.ceil(Math.max(...curve.glyphs.map((g) => g.x)) - minX + label.size * 2)
  const height = Math.ceil(Math.max(...curve.glyphs.map((g) => g.y)) - minY + label.size * 2)
  return { curve, minX, minY, width, height }
}
export function paintCurve(ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, label: PlacedLabel, tone: Tone, dpr: number, sprites: WordSprites) {
  const geometry = curveGeometry(label)
  if (!geometry) return
  const { curve, minX, minY } = geometry
  const spec = STYLE_SPEC[label.style],
    paint = labelPaint(label, tone)
  ctx.scale(dpr, dpr)
  ctx.font = (spec.italic ? 'italic ' : '') + spec.weight + ' ' + label.size + 'px ' + paint.fontFamily
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.letterSpacing = spec.spacing * label.size + 'px'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = paint.halo
  ctx.lineWidth = paint.haloWidth
  ctx.fillStyle = paint.color
  const chars = [...label.text]
  const style = { font: ctx.font, size: label.size, spacing: spec.spacing * label.size, halo: paint.halo, haloWidth: paint.haloWidth, color: paint.color }
  const glyphs = chars.map((char) => sprites.get(char, style, dpr))
  for (const stroke of [true, false])
    for (const [i, glyph] of curve.glyphs.entries()) {
      ctx.save()
      ctx.translate(glyph.x - minX, glyph.y - minY)
      ctx.rotate(glyph.angle)
      const sprite = glyphs[i]
      ctx.drawImage(stroke ? sprite.stroke : sprite.fill, sprite.x, sprite.y, sprite.width, sprite.height)
      ctx.restore()
    }
}
