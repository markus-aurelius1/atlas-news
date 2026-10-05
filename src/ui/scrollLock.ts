/**
 * Page scroll lock shared by dialogs and full-screen views. Counted, so nested
 * dialogs don't unlock each other. Where the platform shows classic scrollbars
 * (Windows, Linux) the removed scrollbar's width is padded back, so nothing
 * behind the overlay jumps sideways.
 */
let locks = 0

export function lockScroll(): () => void {
  if (typeof document === 'undefined') return () => {}
  const root = document.documentElement
  if (locks++ === 0) {
    const gap = window.innerWidth - root.clientWidth
    root.style.setProperty('--scroll-lock-gap', `${Math.max(0, gap)}px`)
    root.dataset.scrollLocked = ''
  }
  let released = false
  return () => {
    if (released) return
    released = true
    locks = Math.max(0, locks - 1)
    if (!locks) {
      delete root.dataset.scrollLocked
      root.style.removeProperty('--scroll-lock-gap')
    }
  }
}
