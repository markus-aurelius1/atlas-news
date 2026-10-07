/** Native selection has no universal "finished" event. Never cancel pointer/default selection behavior. */
export const HANDLE_IDLE_MS = 1200
export const MOUSE_IDLE_MS = 60
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
    if (!down) timer = setTimeout(commit, type === 'mouse' ? MOUSE_IDLE_MS : HANDLE_IDLE_MS)
  }
  return {
    pointerDown(next) { cancel(); down = true; type = next },
    pointerUp(next) { down = false; type = next; schedule() },
    changed: schedule,
    cancel() { down = false; cancel() },
    destroy: cancel,
  }
}
