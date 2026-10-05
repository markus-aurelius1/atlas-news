/** The one navigation surface: a slim rail in the window, a tab bar on a phone. Route memory and validated navigation stay authoritative. */
import { CloudOff, Map, Moon, Newspaper, Settings2, Sun } from 'lucide-react'
import { updateSettings, useSettings } from '@/data/hooks'
import { useOnline } from '@/lib/useOnline'
import { haptics } from '@/services/haptics'
import { LogoMark } from '@/ui/Logo'
import { executeAction } from '@/tars/runtime'
import { currentRoute, navigate, type RouteName } from './router'
import { resetRoute } from './routeState'
import { preloadRoute } from './screens'
import { useResolvedDark } from './theme'

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

export function Nav({ route }: { route: RouteName }) {
  const settings = useSettings()
  const dark = useResolvedDark(settings.theme)
  const online = useOnline()
  const warm = (name: RouteName) => ({ onPointerEnter: () => preloadRoute(name), onFocus: () => preloadRoute(name) })
  return (
    <nav className="nav" aria-label="Workspaces" data-product-chrome>
      <button type="button" className="nav-brand" aria-label="Tars – go to Atlas" onClick={() => go('atlas')}>
        <LogoMark className="size-[22px]" />
      </button>
      <div className="nav-items">
        {PRIMARY.map(({ name, label, icon: Icon }) => (
          <button key={name} type="button" className="nav-item" aria-current={route === name ? 'page' : undefined} onClick={() => go(name)} {...warm(name)}>
            <Icon aria-hidden="true" />
            {label}
          </button>
        ))}
        <button type="button" className="nav-item nav-item-settings-mobile" aria-current={route === 'settings' ? 'page' : undefined} onClick={() => go('settings')} {...warm('settings')}>
          <Settings2 aria-hidden="true" />
          Settings
        </button>
      </div>
      <div className="nav-foot">
        {!online && (
          <span className="nav-tool nav-offline" role="status" aria-label="Offline. Everything is saved on this device." title="Offline – everything is saved on this device">
            <CloudOff aria-hidden="true" />
          </span>
        )}
        <button type="button" className="nav-tool" aria-label={dark ? 'Switch to Light theme' : 'Switch to Dark theme'} title={dark ? 'Light theme' : 'Dark theme'} onClick={() => void updateSettings({ theme: dark ? 'light' : 'dark' })}>
          {dark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </button>
        <button type="button" className="nav-tool" aria-label="Settings" title="Settings" aria-current={route === 'settings' ? 'page' : undefined} onClick={() => go('settings')} {...warm('settings')}>
          <Settings2 aria-hidden="true" />
        </button>
      </div>
    </nav>
  )
}
