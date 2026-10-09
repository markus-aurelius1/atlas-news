/** Native selection has no universal "finished" event. Never cancel pointer/default selection behavior. */
export const HANDLE_IDLE_MS = 1200
export const MOUSE_IDLE_MS = 60
/** A pen stroke drawn across the text: finished, like a mouse drag, the moment the pen lifts. */
export const STROKE = 'stroke'
/** Movement before a pen contact counts as a stroke rather than a tap. */
export const STROKE_SLOP_PX = 6
export interface SelectionCompletion {
  pointerDown(type: string): void
  pointerUp(type: string): void
  changed(): void
  cancel(): void
  destroy(): void
}
export function selectionCompletion(commit: () => void): SelectionCompletion {
  let down = false, type = 'keyboard', timer: ReturnType<typeof setTimeout> | undefined
  const cancel = () => { clearTimeout(timer); timer = undefined }
  const schedule = () => {
    cancel()
    if (!down) timer = setTimeout(commit, type === 'mouse' || type === STROKE ? MOUSE_IDLE_MS : HANDLE_IDLE_MS)
  }
  return {
    pointerDown(next) { cancel(); down = true; type = next },
    pointerUp(next) { down = false; type = next; schedule() },
    changed: schedule,
    cancel() { down = false; cancel() },
    destroy: cancel,
  }
}
