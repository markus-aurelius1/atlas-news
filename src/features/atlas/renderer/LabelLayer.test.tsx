// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { PlacedLabel } from '../labels'
import { WorkerCurve } from './LabelLayer'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

it('repaints worker river lettering during StrictMode replay and remount without detaching its bitmap', () => {
  let detached = false
  const bitmap = { width: 120, height: 30 } as ImageBitmap
  const drawImage = vi.fn(() => {
    if (detached) throw new DOMException('The input ImageBitmap has been detached', 'InvalidStateError')
  })
  const transfer = vi.fn(() => {
    if (detached) throw new DOMException('The input ImageBitmap has been detached', 'InvalidStateError')
    detached = true
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((kind) =>
    (kind === 'bitmaprenderer' ? { transferFromImageBitmap: transfer } : { drawImage }) as unknown as CanvasRenderingContext2D,
  )
  const label: PlacedLabel = { key: 'river:ganga', text: 'Ganga', style: 'river', x: 0, y: 0, anchor: 'middle', size: 12, curveBitmap: bitmap }
  const view = <StrictMode><WorkerCurve label={label} width={120} height={30} font="italic 500 12px Manrope" /></StrictMode>
  const first = render(view)
  expect(drawImage).toHaveBeenCalledTimes(2)
  expect(first.container.querySelector('canvas')?.width).toBe(120)
  first.unmount()
  const second = render(view)
  expect(drawImage).toHaveBeenCalledTimes(4)
  expect(second.container.querySelector('canvas')?.height).toBe(30)
  expect(transfer).not.toHaveBeenCalled()
  expect(detached).toBe(false)
})

it('retains the copied river raster across identical worker snapshots and redraws a changed course', () => {
  const drawImage = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D)
  const makeLabel = (): PlacedLabel => ({ key: 'river:ganga', text: 'Ganga', style: 'river', x: 0, y: 0, anchor: 'middle', size: 12, curveBitmap: { width: 120, height: 30 } as ImageBitmap })
  const view = (paintKey: string) => <WorkerCurve label={makeLabel()} width={120} height={30} font="italic 500 12px Manrope" paintKey={paintKey} />
  const screen = render(view('same-course'))
  screen.rerender(view('same-course'))
  expect(drawImage).toHaveBeenCalledTimes(1)
  expect(screen.container.querySelector('canvas')?.width).toBe(120)
  screen.rerender(view('changed-course'))
  expect(drawImage).toHaveBeenCalledTimes(2)
})
