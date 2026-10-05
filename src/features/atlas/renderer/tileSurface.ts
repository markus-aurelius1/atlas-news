/** Present unchanged cached tile planes without browser re-rasterization when their CSS scale changes. */
import type { Transform } from '../labels'
export function tileSurface(canvas: HTMLCanvasElement) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true })
  if (!gl) return null
  const shader = (type: number, source: string) => {
    const node = gl.createShader(type)!
    gl.shaderSource(node, source); gl.compileShader(node)
    if (!gl.getShaderParameter(node, gl.COMPILE_STATUS)) { gl.deleteShader(node); throw new Error('Atlas tile shader failed') }
    return node
  }
  const vs = shader(gl.VERTEX_SHADER, 'precision highp float; attribute vec2 corner; uniform vec4 plane; uniform vec2 pan; uniform vec2 viewport; uniform float zoom; varying vec2 uv; void main(){ vec2 p=(plane.xy+corner*plane.zw)*zoom+pan; gl_Position=vec4(p/viewport*vec2(2.,-2.)+vec2(-1.,1.),0.,1.); uv=corner; }')
  const fs = shader(gl.FRAGMENT_SHADER, 'precision highp float; uniform sampler2D image; varying vec2 uv; void main(){ gl_FragColor=texture2D(image,uv); }')
  const program = gl.createProgram()!
  gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program)
  gl.deleteShader(vs); gl.deleteShader(fs)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); throw new Error('Atlas tile program failed') }
  gl.useProgram(program)
  const buffer = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW)
  const corner = gl.getAttribLocation(program, 'corner')
  gl.enableVertexAttribArray(corner); gl.vertexAttribPointer(corner, 2, gl.FLOAT, false, 0, 0)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
  const plane = gl.getUniformLocation(program, 'plane'), pan = gl.getUniformLocation(program, 'pan'), viewport = gl.getUniformLocation(program, 'viewport'), zoom = gl.getUniformLocation(program, 'zoom')
  const textures = new Map<string, { texture: WebGLTexture; rect: number[] }>()
  return {
    update(key: string, source: HTMLCanvasElement, level: number, x: number, y: number, rect?: number[]) {
      if (Math.max(source.width, source.height) > gl.getParameter(gl.MAX_TEXTURE_SIZE)) return false
      const old = textures.get(key), texture = old?.texture ?? gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, texture)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source)
      const scale = 2 ** level
      textures.set(key, { texture, rect: rect ?? [x / scale, y / scale, source.width / scale, source.height / scale] })
      return true
    },
    draw(view: Transform, width: number, height: number, keys: string[]) {
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform2f(pan, view.x, view.y); gl.uniform2f(viewport, width, height); gl.uniform1f(zoom, view.k)
      for (const key of keys) {
        const item = textures.get(key)
        if (!item) continue
        gl.bindTexture(gl.TEXTURE_2D, item.texture); gl.uniform4fv(plane, item.rect); gl.drawArrays(gl.TRIANGLES, 0, 6)
      }
    },
    remove(key: string) { const entry = textures.get(key); if (entry) gl.deleteTexture(entry.texture); textures.delete(key) },
    read() { const pixels = new Uint8Array(canvas.width * canvas.height * 4); gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels); return pixels },
    close() { for (const entry of textures.values()) gl.deleteTexture(entry.texture); textures.clear(); gl.deleteBuffer(buffer); gl.deleteProgram(program) },
  }
}
