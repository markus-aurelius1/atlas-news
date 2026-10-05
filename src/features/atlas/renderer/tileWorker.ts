/** Worker lifetime owns geometry and source images; messages rasterise only off the camera thread. */
import { TilePainter, type TileRequest, type TileSheet } from './tilePainter'
import { TILE_SIZE } from './tiles'
let painter: TilePainter | null = null
let generation = 0
const scope = self as unknown as { onmessage: ((event: MessageEvent) => void) | null; postMessage(message: unknown, transfer?: Transferable[]): void }
scope.onmessage = (event: MessageEvent<{ type: string; sheet?: TileSheet; request?: TileRequest; generation: number }>) => {
  const message = event.data
  if (message.type === 'init') {
    generation = message.generation
    painter?.close()
    painter = null
    void TilePainter.create(message.sheet!)
      .then((next) => {
        if (generation !== message.generation) {
          next.close()
          return
        }
        painter = next
        scope.postMessage({ type: 'ready', generation })
      })
      .catch((error: unknown) => scope.postMessage({ type: 'error', message: String(error), generation }))
  } else if (message.type === 'draw' && painter && message.generation === generation) {
    try {
      const canvas = new OffscreenCanvas(TILE_SIZE, TILE_SIZE)
      const context = canvas.getContext('2d', { willReadFrequently: true, alpha: false })
      if (!context) throw new Error('No worker 2D canvas')
      painter.draw(context, message.request!)
      const bitmap = canvas.transferToImageBitmap()
      scope.postMessage({ type: 'tile', generation, id: message.request!.id, bitmap }, [bitmap])
    } catch (error) {
      scope.postMessage({ type: 'error', message: String(error), generation })
    }
  }
}
