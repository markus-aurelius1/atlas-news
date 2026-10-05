/**
 * Moving the stage without animating layout.
 *
 * Collapsing the rail, or putting all the chrome away for the full-screen map
 *  changes where the stage sits and how big it is. Animating
 * that as padding and width lays the whole workspace out on every frame (and on
 * the Atlas repainted the map four or five times).
 *
 * Here the change of layout happens once and the movement is a transform:
 *
 *   the stage grows     the new layout is applied at once, and the stage slides
 *                       from where it was to where it now is
 *   the stage shrinks   the stage first slides to where it is going, keeping
 *                       its old size (the part that leaves is off-screen or
 *                       under the rail), and the new layout is applied when it
 *                       arrives
 *
 * Either way there is one layout, and what is on the stage reflows once.
 * Reduced motion, and phones (where the stage is the page), skip the slide.
 */
import { prefersReducedMotion } from '@/lib/motion'

const MS = 320
const EASE = 'cubic-bezier(0.65, 0, 0.35, 1)'

let running: { animation: Animation; finish: () => void } | null = null

/** Apply a change to the shell's attributes (`apply`), moving the stage to its new place with a transform. */
export function shiftStage(apply: () => void) {
  // A change that arrives mid-slide: land the previous one first.
  if (running) {
    running.animation.cancel()
    running.finish()
    running = null
  }
  const stage = document.querySelector<HTMLElement>('.stage')
  const frame = document.querySelector<HTMLElement>('.app-frame')
  if (!stage || !frame || typeof stage.animate !== 'function' || window.innerWidth < 768 || prefersReducedMotion()) return apply()

  const before = stage.getBoundingClientRect()
  const padding = getComputedStyle(frame).padding
  apply()
  const after = stage.getBoundingClientRect()
  const dx = before.left - after.left
  const dy = before.top - after.top
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(before.width - after.width) < 1 && Math.abs(before.height - after.height) < 1) return

  if (after.width >= before.width && after.height >= before.height) {
    // Growing: already in its new box; slide in from the old position.
    const animation = stage.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], { duration: MS, easing: EASE })
    running = { animation, finish: () => {} }
    animation.onfinish = () => (running = null)
    return
  }
  // Shrinking: hold the old box, slide to the new position, then take the new layout.
  frame.style.padding = padding
  const finish = () => {
    frame.style.padding = ''
  }
  const animation = stage.animate([{ transform: 'translate(0, 0)' }, { transform: `translate(${-dx}px, ${-dy}px)` }], { duration: MS, easing: EASE })
  running = { animation, finish }
  animation.onfinish = () => {
    finish()
    running = null
  }
}
