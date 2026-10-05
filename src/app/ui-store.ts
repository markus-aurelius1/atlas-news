/** Shared shell and overlay state. */
import { create } from 'zustand'
import { KEYS } from '@/lib/storage'
interface UiStore {
  paletteOpen: boolean
  shortcutsOpen: boolean
  sidebarCollapsed: boolean
  atlasFullscreen: boolean
  toggleSidebar: () => void
  set: (patch: Partial<Omit<UiStore, 'set' | 'toggleSidebar'>>) => void
}
const readCollapsed = () => { try { return localStorage.getItem(KEYS.sidebar) === '1' } catch { return false } }
export const useUi = create<UiStore>((set, get) => ({
  paletteOpen: false, shortcutsOpen: false, sidebarCollapsed: readCollapsed(), atlasFullscreen: false,
  toggleSidebar: () => {
    const next = !get().sidebarCollapsed
    set({ sidebarCollapsed: next })
    try { localStorage.setItem(KEYS.sidebar, next ? '1' : '0') } catch { /* storage unavailable */ }
  },
  set: patch => set(patch),
}))
