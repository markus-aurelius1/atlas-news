/** Inspect actual sprite and viewport pixels, not DOM stand-ins for the batched renderer. Safe to pass to page.evaluate. */
export async function inspectLabelSurface() {
  const host = document.querySelector('.atlas-names'), map = host?.closest('.atlas')
  if (!host?.atlasEntries || !host.atlasReadPixels) return null
  const view = host.atlasLabelView(), base = map.querySelector('.atlas-base').atlasView
  const output = await host.atlasReadPixels(), dpr = host.atlasDpr
  const source = document.createElement('canvas'), bitmap = host.atlasRaster
  source.width = bitmap.width; source.height = bitmap.height
  const ctx = source.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(bitmap, 0, 0)
  const pixels = ctx.getImageData(0, 0, source.width, source.height).data
  const alpha = (x, y) => {
    if (x < 0 || y < 0 || x >= output.width || y >= output.height) return 0
    return output.pixels[((output.bottomUp ? output.height - 1 - y : y) * output.width + x) * 4 + 3]
  }
  const entries = host.atlasEntries.map(e => {
    const x = view.x + e.anchor.worldX * view.k + e.anchor.offsetX + e.left
    const y = view.y + e.anchor.worldY * view.k + e.anchor.offsetY + e.top
    let painted = false, sourcePainted = false, tested = 0, matched = 0
    // Sample ink across every sprite. Compare only samples inside the viewport.
    for (let sy = 0; sy < e.height * dpr; sy += 2) for (let sx = 0; sx < e.width * dpr; sx += 2) {
      const a = pixels[((e.y + sy) * source.width + e.x + sx) * 4 + 3]
      if (a < 180) continue
      sourcePainted = true
      const px = Math.round(x * dpr + sx), py = Math.round(y * dpr + sy)
      if (px < 2 || py < 2 || px >= output.width - 2 || py >= output.height - 2) continue
      tested++
      let hit = false
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (alpha(px + dx, py + dy) > 40) hit = true
      if (hit) { matched++; painted = true }
    }
    ctx.letterSpacing = '0px'; ctx.font = e.font
    const metric = ctx.measureText(e.label.text), actual = metric.width
    ctx.font = e.font.replace(/\d+(?:\.\d+)?px/, '100px')
    const normal = ctx.measureText(e.label.text).width * e.label.size / 100
    return { key: e.label.key, text: e.label.text, path: !!e.label.path, size: e.label.size, font: e.font,
      width: actual, height: metric.actualBoundingBoxAscent + metric.actualBoundingBoxDescent,
      x, y, spriteWidth: e.width, spriteHeight: e.height, painted, sourcePainted, tested, matched,
      anchorError: Math.max(Math.abs((base.x + e.anchor.worldX * base.k) - (view.x + e.anchor.worldX * view.k)), Math.abs((base.y + e.anchor.worldY * base.k) - (view.y + e.anchor.worldY * view.k))),
      fontError: Math.abs(actual - normal) }
  })
  source.width = source.height = 0
  return { entries, mode: host.querySelector('canvas').dataset.labelSurface, loaded: document.fonts.check('600 12px Manrope'), position: Math.max(0, ...host.atlasPositionTimes) }
}
