/** Load shared overlays only when opened. */
import { lazy, Suspense } from 'react'
import { useUi } from './ui-store'
const Palette = lazy(() => import('./CommandPalette').then(m => ({ default: m.CommandPalette })))
const Shortcuts = lazy(() => import('./ShortcutsSheet').then(m => ({ default: m.ShortcutsSheet })))
export function Overlays() {
  const palette = useUi(s => s.paletteOpen), shortcuts = useUi(s => s.shortcutsOpen)
  return <Suspense fallback={null}>{palette && <Palette />}{shortcuts && <Shortcuts />}</Suspense>
}
