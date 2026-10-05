/** Unscaled HTML words, including curved river lettering: one compositor position per word, never SVG writes per frame. */
import { memo, useEffect, useLayoutEffect, useMemo, useRef, type MutableRefObject } from 'react'
import type { Sheet } from '@/atlas/sheet'
import type { Place } from '@/atlas/types'
import { baselineFromTop, glyphAdvances, labelKeyOf, measureLabel, STYLE_SPEC, type PlacedLabel, type Transform } from '../labels'
import { PlaceName, labelPaint } from './glyphs'
import { curveGlyphs, type LabelAnchor } from './labelMotion'
import type { Layout, Tone } from './types'
import { WordSprites } from './wordSprites'
export type LabelPort = (view: Transform) => void
interface WordBounds { left: number; right: number; top: number; bottom: number }
interface Props {
  labels: PlacedLabel[]
  layout: Layout | null
  tone: Tone
  sheet: Sheet
  places: Place[]
  port: MutableRefObject<LabelPort | null>
  current: () => Transform
}
const fadeDelay = (key: string) => {
  let hash = 0
  for (const c of key) hash = (hash * 31 + c.charCodeAt(0)) | 0
  return Math.abs(hash) % 130
}
export function WorkerCurve({ label, width, height, font, paintKey }: { label: PlacedLabel; width: number; height: number; font: string; paintKey?: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const raster = paintKey ?? label.curveBitmap
  useLayoutEffect(() => {
    const node = canvas.current,
      bitmap = label.curveBitmap
    if (!node || !bitmap) return
    node.width = bitmap.width
    node.height = bitmap.height
    Object.assign(node, { atlasFont: font })
    // React can replay this layout effect (StrictMode or Suspense reappearance).
    // Copy the raster; transferring it would detach the layout-owned bitmap.
    node.getContext('2d')?.drawImage(bitmap, 0, 0)
    return () => {
      node.width = node.height = 0
    }
  }, [raster]) // eslint-disable-line react-hooks/exhaustive-deps
  return <canvas ref={canvas} aria-label={label.text} style={{ width, height }} />
}
const RiverWord = memo(function RiverWord({ label, tone, sprites }: { label: PlacedLabel; tone: Tone; sprites: WordSprites }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const spec = STYLE_SPEC[label.style]
  const paint = labelPaint(label, tone)
  const chars = [...label.text]
  const advances = label.glyphAdvances ?? glyphAdvances(label.text, label.size, spec.weight, spec.italic, spec.spacing)
  const curve = curveGlyphs(label.path!, advances)
  const minX = curve ? Math.min(...curve.glyphs.map((g) => g.x)) - label.size * 2 : 0
  const minY = curve ? Math.min(...curve.glyphs.map((g) => g.y)) - label.size * 2 : 0
  const width = curve ? Math.ceil(Math.max(...curve.glyphs.map((g) => g.x)) - minX + label.size * 2) : 0
  const height = curve ? Math.ceil(Math.max(...curve.glyphs.map((g) => g.y)) - minY + label.size * 2) : 0
  // The course centre is positioned by its HTML anchor. A pure pan does not change the local lettering.
  const rasterKey = JSON.stringify([
    label.text,
    label.size,
    label.style,
    tone,
    width,
    height,
    label.curveBitmap?.width,
    label.curveBitmap?.height,
    curve?.glyphs.map((g) => [Math.round(g.x * 100) / 100, Math.round(g.y * 100) / 100, Math.round(g.angle * 1000) / 1000]),
  ])
  useLayoutEffect(() => {
    const node = canvas.current
    if (!node || !curve || label.curveBitmap) return
    const dpr = window.devicePixelRatio || 1
    node.width = Math.ceil(width * dpr)
    node.height = Math.ceil(height * dpr)
    const ctx = node.getContext('2d', { willReadFrequently: true })
    if (!ctx) return
    ctx.scale(dpr, dpr)
    const style = {
      font: (spec.italic ? 'italic ' : '') + spec.weight + ' ' + label.size + 'px ' + paint.fontFamily,
      size: label.size,
      spacing: spec.spacing * label.size,
      halo: paint.halo,
      haloWidth: paint.haloWidth,
      color: paint.color,
    }
    ctx.font = style.font
    const glyphs = chars.map((char) => sprites.get(char, style, dpr))
    // Compose the selected course from cached letters, preserving the original all-halos-then-fills order.
    for (const stroke of [true, false])
      for (const [i, glyph] of curve.glyphs.entries()) {
        const sprite = glyphs[i]
        ctx.save()
        ctx.translate(glyph.x - minX, glyph.y - minY)
        ctx.rotate(glyph.angle)
        ctx.drawImage(stroke ? sprite.stroke : sprite.fill, sprite.x, sprite.y, sprite.width, sprite.height)
        ctx.restore()
      }
    return () => {
      node.width = node.height = 0
    }
  }, [rasterKey, !!label.curveBitmap]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!curve) return null
  return (
    <span className="atlas-name atlas-river-name" data-label-key={label.key} style={{ animationDelay: fadeDelay(label.key) + 'ms' }}>
      <span className="atlas-name-text" style={{ width, height, fontSize: label.size, transform: 'translate(' + minX + 'px,' + minY + 'px)' }}>
        {label.curveBitmap ? (
          <WorkerCurve label={label} width={width} height={height} paintKey={rasterKey} font={(spec.italic ? 'italic ' : '') + spec.weight + ' ' + label.size + 'px ' + paint.fontFamily} />
        ) : (
          <canvas ref={canvas} aria-label={label.text} style={{ width, height }} />
        )}
        <span className="sr-only">{label.text}</span>
      </span>
    </span>
  )
})
export { BatchLabelLayer as LabelLayer } from './BatchLabelLayer'
export function LegacyLabelLayer({ labels, layout, tone, sheet, places, port, current }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const positionTimes = useRef<number[]>([])
  const motions = useRef(new Map<HTMLElement, { animation: Animation; anchor: LabelAnchor; range: number; k: number; bounds: WordBounds }>())
  const sprites = useMemo(() => new WordSprites(), [])
  useEffect(() => {
    let alive = true
    // A first layout can use fallback lettering. The camera requests a new layout after the same font-ready promise.
    void document.fonts.ready.then(() => {
      if (alive) sprites.close()
    })
    return () => {
      alive = false
      sprites.close()
    }
  }, [sprites, sheet])
  const points = useMemo(() => new Map(sheet.labels.map((l) => [labelKeyOf(l), l])), [sheet])
  const placePoints = useMemo(() => new Map(places.map((p) => [p.id, p])), [places])
  useEffect(
    () => () => {
      port.current = null
      for (const { animation } of motions.current.values()) animation.cancel()
      motions.current.clear()
    },
    [port],
  )
  useLayoutEffect(() => {
    const element = host.current
    if (!element || !layout) return
    const nodes = new Map([...element.querySelectorAll<HTMLElement>('.atlas-name')].map((node) => [node.dataset.labelKey!, node]))
    const anchors: Array<{ node: HTMLElement; anchor: LabelAnchor; bounds: WordBounds }> = []
    for (const label of labels) {
      const node = nodes.get(label.key)
      if (!node) continue
      let x = label.x,
        y = label.y
      let source: { x?: number; y?: number } | undefined = label.key.startsWith('place:') ? placePoints.get(label.placeId ?? label.key.slice(6)) : points.get(label.key)
      if (label.path) {
        const curve = curveGlyphs(label.path, [])
        if (!curve) continue
        x = curve.centre.x + layout.fx - layout.x
        y = curve.centre.y + layout.fy - layout.y
        source = undefined
      }
      const worldX = source?.x ?? (x - layout.fx) / layout.k,
        worldY = source?.y ?? (y - layout.fy) / layout.k
      const spec = STYLE_SPEC[label.style]
      const width = label.measuredWidth ?? measureLabel(label.text, label.size, spec.weight, spec.italic, spec.spacing)
      const left = label.anchor === 'middle' ? -width / 2 : label.anchor === 'end' ? -width : 0
      const top = -(label.baseline ?? baselineFromTop(label.style, label.size))
      anchors.push({
        node,
        anchor: { worldX, worldY, offsetX: x - worldX * layout.k - layout.fx, offsetY: y - worldY * layout.k - layout.fy },
        bounds: label.path ? { left: -256, right: 256, top: -256, bottom: 256 } : { left: left - 2, right: left + width + 2, top: top - 2, bottom: top + label.size * 1.25 + 2 },
      })
    }
    const times = positionTimes.current
    const retained = new Set(anchors.map(({ node }) => node))
    for (const [node, motion] of motions.current) {
      if (retained.has(node)) continue
      motion.animation.cancel()
      motions.current.delete(node)
    }
    const animations = anchors.map(({ node, anchor, bounds }) => {
      const { worldX, worldY, offsetX, offsetY } = anchor
      const previous = motions.current.get(node)
      const range = Math.max(previous?.range ?? 8, layout.k * 2)
      if (
        previous &&
        previous.range === range &&
        previous.anchor.worldX === worldX &&
        previous.anchor.worldY === worldY &&
        Math.abs(previous.anchor.offsetX - offsetX) < 0.025 &&
        Math.abs(previous.anchor.offsetY - offsetY) < 0.025
      ) {
        previous.bounds = bounds
        return previous
      }
      const frames = [{ transform: 'translate3d(' + offsetX + 'px,' + offsetY + 'px,0)' }, { transform: 'translate3d(' + (worldX * range + offsetX) + 'px,' + (worldY * range + offsetY) + 'px,0)' }]
      // Retained words keep their compositor objects. A settled pan must not cancel and rebuild every animation.
      const animation = previous?.animation ?? node.animate(frames, { duration: range * 1000, fill: 'forwards' })
      if (previous) {
        const effect = animation.effect as KeyframeEffect
        effect.setKeyframes(frames)
        effect.updateTiming({ duration: range * 1000 })
      }
      animation.pause()
      const motion = { animation, anchor, range, k: NaN, bounds }
      motions.current.set(node, motion)
      return motion
    })
    let lastPan = ''
    Object.assign(element, { atlasAnchors: new Map(anchors.map(({ node, anchor }) => [node, anchor])) })
    const position: LabelPort = (view) => {
      const start = performance.now()
      const pan = 'translate3d(' + Math.round(view.x * 100) / 100 + 'px,' + Math.round(view.y * 100) / 100 + 'px,0)'
      if (pan !== lastPan) {
        element.style.transform = pan
        lastPan = pan
      }
      // A pan changes one container. Only zoom changes individual word anchors; no font is scaled.
      for (const motion of animations) {
        if (motion.k === view.k) continue
        const { worldX, worldY, offsetX, offsetY } = motion.anchor
        const { left, right, top, bottom } = motion.bounds
        const visible = (k: number) => {
          const x = view.x + worldX * k + offsetX,
            y = view.y + worldY * k + offsetY
          return x + right >= 0 && y + bottom >= 0 && x + left <= layout.w && y + top <= layout.h
        }
        // An offscreen word can retain its previous compositor position until either position reaches the view.
        // Check both positions so a word never leaves a stale ghost behind while zooming or enters at an old scale.
        if (Number.isNaN(motion.k) || visible(view.k) || visible(motion.k)) {
          if (view.k > motion.range) {
            motion.range = view.k * 2
            const effect = motion.animation.effect as KeyframeEffect
            effect.setKeyframes([
              { transform: 'translate3d(' + offsetX + 'px,' + offsetY + 'px,0)' },
              { transform: 'translate3d(' + (worldX * motion.range + offsetX) + 'px,' + (worldY * motion.range + offsetY) + 'px,0)' },
            ])
            effect.updateTiming({ duration: motion.range * 1000 })
          }
          motion.animation.currentTime = view.k * 1000
          motion.k = view.k
        }
      }
      times.push(performance.now() - start)
      if (times.length > 240) times.shift()
      Object.assign(element, { atlasPositionTimes: times })
    }
    port.current = position
    position(current())
  }, [labels, layout, points, placePoints, port]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div
      ref={(node) => {
        host.current = node
      }}
      className="atlas-names absolute inset-0"
      aria-hidden="true"
    >
      {labels.map((label) => (label.path ? <RiverWord key={label.key} label={label} tone={tone} sprites={sprites} /> : label.text ? <PlaceName key={label.key} label={label} tone={tone} /> : null))}
    </div>
  )
}
