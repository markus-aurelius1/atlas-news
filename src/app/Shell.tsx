/** Compact product chrome; route memory and validated navigation stay authoritative. */
import { Search, Settings2, Moon, Sun, CloudOff, Map, Newspaper } from 'lucide-react'
import { useOnline } from '@/lib/useOnline'
import { updateSettings, useSettings } from '@/data/hooks'
import { useResolvedDark } from './theme'
import { haptics } from '@/services/haptics'
import { LogoMark } from '@/ui/Logo'
import { IconButton } from '@/ui/controls'
import { executeAction } from '@/tars/runtime'
import { preloadRoute } from './screens'
import { modKey } from './shortcuts'
import { useUi } from './ui-store'
import { currentRoute, navigate, type RouteName } from './router'
import { resetRoute } from './routeState'

const PRIMARY = [
  { name: 'atlas' as const, label: 'Atlas', icon: Map },
  { name: 'current-affairs' as const, label: 'News', icon: Newspaper },
]

function go(name: RouteName) {
  haptics.tap()
  const here = currentRoute()
  if (here.name === name) {
    resetRoute(name)
    if (here.raw !== `#/${name}`) navigate(`#/${name}`)
  } else void executeAction('navigation.open', { route: name })
}
export function TopBar({ route }: { route: RouteName }) {
  const settings = useSettings()
  const dark = useResolvedDark(settings.theme)
  const online = useOnline()
  return (
    <header className="product-bar" data-product-chrome>
      <button type="button" className="product-brand press" aria-label="Tars – go to Atlas" onClick={() => go('atlas')}>
        <LogoMark className="size-6 text-knowledge" /><span>TARS</span>
      </button>
      <nav className="product-nav" aria-label="Workspaces">
        {PRIMARY.map(({ name, label, icon: Icon }) => <button key={name} type="button" className="product-link press" aria-current={route === name ? 'page' : undefined} onClick={() => go(name)} onPointerEnter={() => preloadRoute(name)} onFocus={() => preloadRoute(name)}><Icon aria-hidden="true" className="product-nav-icon size-4" />{label}</button>)}
      </nav>
      <div className="product-tools">
        {!online && <span className="product-offline" aria-label="Offline. Everything is saved on this device."><CloudOff className="size-4" /><span>Offline</span></span>}
        <button type="button" className="product-search press" aria-label="Ask Tars" aria-keyshortcuts="Control+K Meta+K" onClick={() => useUi.getState().set({ paletteOpen: true })}>
          <Search className="size-4" /><span>Search</span><kbd className="kbd">{modKey}K</kbd>
        </button>
        <IconButton label={dark ? 'Switch to Light theme' : 'Switch to Dark theme'} className="product-theme" onClick={() => void updateSettings({ theme: dark ? 'light' : 'dark' })}>{dark ? <Sun className="size-4" /> : <Moon className="size-4" />}</IconButton>
        <IconButton label="Settings" aria-current={route === 'settings' ? 'page' : undefined} onClick={() => go('settings')} onFocus={() => preloadRoute('settings')}><Settings2 className="size-5" /></IconButton>
      </div>
    </header>
  )
}
