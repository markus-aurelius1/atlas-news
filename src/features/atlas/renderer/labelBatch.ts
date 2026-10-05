/** One texture and draw call for fixed-size lettering; layout, collision and river painting remain authoritative. */
import { STYLE_SPEC, measureLabel, type PlacedLabel } from '../labels'
import { curveGeometry, paintCurve } from './curvePainter'
import { labelPaint } from './labelPaint'
import { WordSprites } from './wordSprites'
import type { Tone } from './types'
import type { LabelAnchor } from './labelMotion'

export interface LabelSprite {
  label: PlacedLabel
  anchor: LabelAnchor
  x: number
  y: number
  width: number
  height: number
  left: number
  top: number
  font: string
}
export function rasterLabels(labels: Array<{ label: PlacedLabel; anchor: LabelAnchor }>, tone: Tone, dpr: number,
  create: () => HTMLCanvasElement | OffscreenCanvas = () => document.createElement('canvas'), sharedSprites?: WordSprites) {
  const atlas = create(), sprites = sharedSprites ?? new WordSprites(256, create)
  const entries: LabelSprite[] = []
  const rasters: Array<HTMLCanvasElement | OffscreenCanvas> = []
  let x = 0, y = 0, row = 0
  let width = 2048
  const measureCanvas = create()
  const measurement = measureCanvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  for (const { label, anchor } of labels) {
    const paint = labelPaint(label, tone), spec = STYLE_SPEC[label.style]
    const font = `${spec.italic ? 'italic ' : ''}${spec.weight} ${label.size}px ${paint.fontFamily}`
    const geometry = label.path ? curveGeometry(label) : null
    const measured = label.measuredWidth ?? measureLabel(label.text, label.size, spec.weight, spec.italic, spec.spacing)
    measurement.font = font
    const metrics = measurement.measureText(label.text)
    const ascent = Math.ceil(metrics.actualBoundingBoxAscent), descent = Math.ceil(metrics.actualBoundingBoxDescent)
    const textWidth = Math.ceil(measured + 8), textHeight = Math.ceil(ascent + descent + 8)
    const canvas = create()
    canvas.width = Math.ceil((geometry?.width ?? textWidth) * dpr)
    canvas.height = Math.ceil((geometry?.height ?? textHeight) * dpr)
    width = Math.max(width, canvas.width)
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
    if (geometry) {
      if (label.curveBitmap) ctx.drawImage(label.curveBitmap, 0, 0)
      else paintCurve(ctx, label, tone, dpr, sprites)
    } else {
      ctx.scale(dpr, dpr)
      ctx.font = font
      ctx.letterSpacing = spec.spacing * label.size + 'px'
      ctx.textBaseline = 'alphabetic'
      ctx.lineJoin = 'round'
      ctx.lineWidth = paint.haloWidth
      ctx.strokeStyle = paint.halo
      ctx.fillStyle = paint.color
      ctx.strokeText(label.text, 4, ascent + 4)
      ctx.fillText(label.text, 4, ascent + 4)
    }
    if (x + canvas.width + 2 > width) { x = 0; y += row + 2; row = 0 }
    entries.push({ label, anchor, x, y, width: canvas.width / dpr, height: canvas.height / dpr,
      left: geometry?.minX ?? -4 - (label.anchor === 'middle' ? measured / 2 : label.anchor === 'end' ? measured : 0),
      top: geometry?.minY ?? -ascent - 4, font })
    rasters.push(canvas)
    x += canvas.width + 2
    row = Math.max(row, canvas.height)
  }
  atlas.width = width
  atlas.height = Math.max(1, y + row)
  const ctx = atlas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  entries.forEach((entry, i) => { ctx.drawImage(rasters[i], entry.x, entry.y); rasters[i].width = rasters[i].height = 0 })
  if (!sharedSprites) sprites.close()
  measureCanvas.width = measureCanvas.height = 0
  return { atlas, entries, dpr }
}
export interface LabelRaster { atlas: HTMLCanvasElement | OffscreenCanvas | ImageBitmap; entries: LabelSprite[]; dpr: number }

/** GPU resources own copied pixels, never the layout's borrowed ImageBitmaps. */
export function gpuLabels(canvas: HTMLCanvasElement | OffscreenCanvas, raster: LabelRaster) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true })
  if (!gl || raster.atlas.height > gl.getParameter(gl.MAX_TEXTURE_SIZE)) return null
  const shader = (type: number, source: string) => {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source); gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); throw new Error('Atlas label shader failed') }
    return shader
  }
  const vs = shader(gl.VERTEX_SHADER, `precision highp float; attribute vec2 world; attribute vec2 offset; attribute vec2 uv; uniform vec2 pan; uniform vec2 viewport; uniform float zoom; varying vec2 tex; void main(){ vec2 p=world*zoom+pan+offset; gl_Position=vec4(p/viewport*vec2(2.,-2.)+vec2(-1.,1.),0.,1.); tex=uv; }`)
  const fs = shader(gl.FRAGMENT_SHADER, `precision highp float; varying vec2 tex; uniform sampler2D image; void main(){ gl_FragColor=texture2D(image,tex); }`)
  const program = gl.createProgram()!
  gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program)
  gl.deleteShader(vs); gl.deleteShader(fs)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); throw new Error('Atlas label program failed') }
  gl.useProgram(program)
  const buffer = gl.createBuffer()!, texture = gl.createTexture()!
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  for (const [i, name] of ['world', 'offset', 'uv'].entries()) {
    const location = gl.getAttribLocation(program, name)
    gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 24, i * 8)
  }
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  const pan = gl.getUniformLocation(program, 'pan'), viewport = gl.getUniformLocation(program, 'viewport'), zoom = gl.getUniformLocation(program, 'zoom')
  let count = 0
  let textureWidth = 0, textureHeight = 0, bufferSize = 0
  const update = (raster: LabelRaster) => {
    const nextWidth = Math.max(textureWidth, 2 ** Math.ceil(Math.log2(raster.atlas.width))), nextHeight = Math.max(textureHeight, 2 ** Math.ceil(Math.log2(raster.atlas.height)))
    if (Math.max(nextWidth, nextHeight) > gl.getParameter(gl.MAX_TEXTURE_SIZE)) throw new Error('Atlas texture exceeds GPU limit')
    gl.bindTexture(gl.TEXTURE_2D, texture)
    if (nextWidth !== textureWidth || nextHeight !== textureHeight) {
      textureWidth = nextWidth; textureHeight = nextHeight
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, textureWidth, textureHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    }
    const vertices: number[] = []
    for (const e of raster.entries) for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [0, 1], [1, 0], [1, 1]])
      vertices.push(e.anchor.worldX, e.anchor.worldY, e.anchor.offsetX + e.left + cx * e.width, e.anchor.offsetY + e.top + cy * e.height,
        (e.x + cx * e.width * raster.dpr) / textureWidth, (e.y + cy * e.height * raster.dpr) / textureHeight)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    const data = new Float32Array(vertices)
    if (data.byteLength > bufferSize) { bufferSize = data.byteLength; gl.bufferData(gl.ARRAY_BUFFER, bufferSize, gl.DYNAMIC_DRAW) }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, raster.atlas)
    count = vertices.length / 6
  }
  update(raster)
  return {
    update,
    draw(k: number, x: number, y: number, w: number, h: number) {
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform2f(pan, x, y); gl.uniform2f(viewport, w, h); gl.uniform1f(zoom, k)
      gl.drawArrays(gl.TRIANGLES, 0, count)
    },
    read() { const pixels = new Uint8Array(canvas.width * canvas.height * 4); gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels); return pixels },
    close() { gl.deleteTexture(texture); gl.deleteBuffer(buffer); gl.deleteProgram(program) },
  }
}
