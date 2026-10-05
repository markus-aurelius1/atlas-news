import { App as CapApp } from '@capacitor/app'
import { MotionConfig, motion } from 'motion/react'
import { Suspense, useDeferredValue, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useSettings } from '@/data/hooks'
import { ensureSeed } from '@/data/seed'
import { cn } from '@/lib/cn'
import { loadAtlas } from '@/atlas/data'
import { lowPowerDevice } from '@/lib/device'
import { whenIdle } from '@/lib/lazy'
import { useMotionPreference } from '@/lib/motion'
import { isNative } from '@/lib/platform'
import { setHapticsEnabled } from '@/services/haptics'
import { AppError, ErrorBoundary, ScreenError } from '@/ui/ErrorBoundary'
import { ConfirmHost, Toaster } from '@/ui/feedback'
import { LogoMark } from '@/ui/Logo'
import { toast } from '@/ui/toast'
import { closeTopSurface } from '@/ui/surface/core'
import { currentRoute, navigate, RouteContext, useRoute, type RouteName } from './router'
import { useOnline } from '@/lib/useOnline'
import { screenEnter } from '@/ui/motion'
import { TarsContextBridge } from '@/tars/useContext'
import { Overlays } from './Overlays'
import { onRouteReset, rememberScroll, scrollFor } from './routeState'
import { ScreenActive } from './screenActive'
import { shiftStage } from './shellShift'
import { preloadRoute, preloadRoutesWhenIdle, SCREENS } from './screens'
import { TopBar } from './Shell'
import { useGlobalShortcuts } from './shortcuts'
import { useApplyTheme } from './theme'
import { useUi } from './ui-store'

// The screen the app is opening on: ask for its code while the database is still being opened.
preloadRoute(currentRoute().name)

type BootState = 'loading' | 'ready' | 'error'

function useBoot(): BootState {
  const [state, setState] = useState<BootState>('loading')
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await ensureSeed()
        // Ask the browser not to evict our local-first data under storage pressure.
        void navigator.storage?.persist?.().catch(() => {})
        if (!cancelled) setState('ready')
      } catch (err) {
        console.error('[boot]', err)
        if (!cancelled) setState('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
  return state
}

export function App() {
  const boot = useBoot()
  const settings = useSettings()
  useApplyTheme(settings.theme)
  const motion = useMotionPreference()

  if (boot === 'error') {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-8 text-center">
        <LogoMark className="size-10 text-accent" />
        <p className="font-display text-xl">Tars couldn’t open its local database.</p>
        <p className="max-w-sm text-sm text-ink-2">Private browsing modes sometimes block storage. Try a normal window, or check that site data is allowed.</p>
      </div>
    )
  }
  // The frame of the app (rail or tab bar, the stage) is in the very first paint; the screen fills in when the database is open.
  return (
    <ErrorBoundary fallback={() => <AppError />}>
      {/* One source for reduced motion (lib/motion.ts): Motion turns movement into cross-fades, as the CSS does. */}
      <MotionConfig reducedMotion={motion === 'reduced' ? 'always' : 'never'}>
        <Main ready={boot === 'ready'} />
      </MotionConfig>
    </ErrorBoundary>
  )
}

/** How a screen meets the stage: scrolling inside it, fitting it (and scrolling only if it must), or filling it. */
const stageScroll = (route: RouteName) => (route === 'atlas' ? 'none' : 'page')

function Main({ ready }: { ready: boolean }) {
  const route = useRoute()
  /**
   * The screen on the stage follows the route as a deferred value. If the next
   * screen's code or data isn't here yet, React keeps the current screen up
   * instead of swapping in a placeholder, and switches when the new one can
   * draw. The rail and tab bar use the live route, so the press shows at once.
   */
  const keepAtlas = useRef(false)
  const deferredRoute = useDeferredValue(route)
  // Going back to the Atlas when it is being kept (below) needs no preparing: it is already drawn, so it is shown in the same render.
  const shownRoute = route.name === 'atlas' && keepAtlas.current ? route : deferredRoute
  const shown = shownRoute.name
  // The Atlas, once kept behind the other screens, goes on seeing the last address that was its own.
  const atlasRoute = useRef(shownRoute)
  if (shown === 'atlas') atlasRoute.current = shownRoute
  const stage = useRef<HTMLDivElement>(null)
  const firstScreen = useRef(true)
  /**
   * Each workspace keeps its own scroll position (app/routeState.ts): a screen
   * you have not visited starts at the top, one you return to is where you left
   * it. The position is read as you scroll and once more as you leave.
   */
  const shownRef = useRef(shown)
  useEffect(() => {
    // The stage scrolls inside itself from 768 px; below that the page does. Only one of the two is ever non-zero.
    const read = () => rememberScroll(shownRef.current, Math.max(stage.current?.scrollTop ?? 0, window.scrollY))
    const el = stage.current
    el?.addEventListener('scroll', read, { passive: true })
    window.addEventListener('scroll', read, { passive: true })
    // Before the next screen replaces this one (the router has not re-rendered yet).
    window.addEventListener('hashchange', read)
    // Pressing the tab of the screen you are on: back to the top.
    const off = onRouteReset((r) => {
      if (r !== shownRef.current) return
      window.scrollTo({ top: 0 })
      el?.scrollTo({ top: 0 })
    })
    return () => {
      el?.removeEventListener('scroll', read)
      window.removeEventListener('scroll', read)
      window.removeEventListener('hashchange', read)
      off()
    }
  }, [])
  useLayoutEffect(() => {
    if (!ready) return
    shownRef.current = shown
    if (firstScreen.current) {
      firstScreen.current = false
      return
    }
    const target = scrollFor(shown)
    const apply = () => {
      window.scrollTo(0, target)
      stage.current?.scrollTo(0, target)
      return Math.max(stage.current?.scrollTop ?? 0, window.scrollY) >= target - 1
    }
    if (apply() || target === 0) return
    // The list may still be filling in (its data arrives a frame or two later): keep trying briefly, and stop at once if the learner scrolls.
    let frames = 0
    let raf = 0
    const stop = () => {
      cancelAnimationFrame(raf)
      for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown']) window.removeEventListener(type, stop)
    }
    const again = () => {
      if (apply() || ++frames > 45) return stop()
      raf = requestAnimationFrame(again)
    }
    for (const type of ['wheel', 'touchstart', 'keydown', 'pointerdown']) window.addEventListener(type, stop, { passive: true, once: true })
    raf = requestAnimationFrame(again)
    return stop
  }, [shown, ready])
  /**
   * The Atlas is the one workspace that is expensive to build and to paint (two
   * sheets, 2,273 places, a large vector map). After its first visit, in the
   * window layout, it stays mounted and laid out *behind* the stage's scroller
   * (.kept-screen): the other workspaces cover it, it is inert, and it is told
   * it is not in front (ScreenActive), so it listens to nothing and animates
   * nothing. Returning uncovers a map that is already painted.
   *
   * It is covered rather than hidden with display: none (which is what React's
   * <Activity> does): un-hiding rebuilt and re-rasterised the whole map, a
   * stall of 0.4–1.8 s on the first frame back.
   *
   * Phones and low-power devices unmount it as before and give the memory back.
   */
  if (shown === 'atlas' && !lowPowerDevice() && typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches) keepAtlas.current = true
  const atlasKept = ready && keepAtlas.current
  const atlasInFront = atlasKept && shown === 'atlas'
  /**
   * Behind another workspace the Atlas must be out of the tab order. `inert`
   * on the whole of it restyles and repaints the vector map – measured at
   * about 1.2 s each way – so the map's own subtree is left alone (it is
   * covered, hidden from assistive technology by aria-hidden, and takes itself
   * out of the tab order), and everything *around* the map is made inert.
   */
  const kept = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const root = kept.current
    if (!root || atlasInFront) return
    const made: Element[] = []
    const map = root.querySelector('.atlas')
    if (!map) {
      // Not drawn yet (still loading): nothing heavy to protect.
      root.inert = true
      return () => {
        root.inert = false
      }
    }
    for (let el: Element | null = map; el && el !== root; el = el.parentElement) {
      for (const sibling of el.parentElement?.children ?? []) {
        if (sibling === el || (sibling as HTMLElement).inert) continue
        ;(sibling as HTMLElement).inert = true
        made.push(sibling)
      }
    }
    return () => {
      for (const el of made) (el as HTMLElement).inert = false
    }
  }, [atlasInFront, atlasKept])
  useEffect(() => (ready ? preloadRoutesWhenIdle() : undefined), [ready])
  // The review count and the action context use the gazetteer if it is there. It is fetched once the app has settled, not during start-up.
  useEffect(() => {
    if (!ready) return
    let cancel = () => {}
    const start = setTimeout(() => (cancel = whenIdle(() => void loadAtlas().catch(() => {}), 4000)), 2500)
    return () => {
      clearTimeout(start)
      cancel()
    }
  }, [ready])
  const scroll = stageScroll(shown)
  // Scrolling workspaces reserve room for their scrollbar.
  useLayoutEffect(() => {
    const el = stage.current
    if (!el || scroll !== 'page') return
    document.documentElement.style.setProperty('--stage-gutter', `${el.offsetWidth - el.clientWidth}px`)
  }, [scroll, ready])
  return (
    <>
      {ready && (
        <>
          <GlobalShortcuts />
          <RuntimeSync />
          <TarsContextBridge />
        </>
      )}
      <ShellSync route={route.name} />
      <TopBar route={route.name} />
      <div className="app-frame">
        <main className="stage" aria-busy={!ready || undefined}>
          {atlasKept && (
            <div ref={kept} className="kept-screen" data-kept="atlas" data-active={atlasInFront ? '' : undefined} aria-hidden={!atlasInFront || undefined}>
              <ScreenActive.Provider value={atlasInFront}>
                <RouteContext.Provider value={atlasRoute.current}>
                  <ErrorBoundary resetKey={atlasInFront ? 'front' : 'behind'} fallback={(error, retry) => <ScreenError error={error} retry={retry} />}>
                    <Suspense fallback={<ScreenSkeleton />}>
                      <Screen name="atlas" />
                    </Suspense>
                  </ErrorBoundary>
                </RouteContext.Provider>
              </ScreenActive.Provider>
            </div>
          )}
          <div ref={stage} className="stage-scroll" data-scroll={scroll} hidden={atlasInFront}>
            {ready ? (
              <>
                {!atlasInFront && (
                  // Enter-only transition: the old screen leaves at once (nothing can hold it on screen), the new one rises into place.
                  <motion.div key={shown} className={cn(scroll !== 'page' && 'md:h-full')} initial={firstScreen.current ? false : screenEnter.initial} animate={screenEnter.animate}>
                    {/* A screen that fails takes only the stage with it: the rail and the tab bar stay. */}
                    <ErrorBoundary resetKey={shown} fallback={(error, retry) => <ScreenError error={error} retry={retry} />}>
                      <Suspense fallback={<ScreenSkeleton />}>
                        <RouteContext.Provider value={shownRoute}>
                          <Screen name={shown} />
                        </RouteContext.Provider>
                      </Suspense>
                    </ErrorBoundary>
                  </motion.div>
                )}
              </>
            ) : (
              <div className="flex min-h-[60dvh] items-center justify-center md:h-full">
                <LogoMark className="size-9 animate-breathe text-accent" />
              </div>
            )}
          </div>
        </main>
      </div>

      {ready && (
        <OverlayBoundary>
          <Overlays />
          <ConfirmHost />
        </OverlayBoundary>
      )}
      <Toaster />
    </>
  )
}

function GlobalShortcuts() {
  useGlobalShortcuts()
  return null
}

/**
 * Mirrors shell state onto <html> for CSS: the rail width, hidden chrome for
 * the full-screen Atlas, while the Atlas fills the screen.
 */
function ShellSync({ route }: { route: RouteName }) {
  const atlasFullscreen = useUi((s) => s.atlasFullscreen)
  useEffect(() => {
    const root = document.documentElement.dataset
    const hide = atlasFullscreen && route === 'atlas'
    const set = () => {
      if (hide) root.chrome = 'hidden'
      else delete root.chrome
    }
    if ((root.chrome === 'hidden') === hide) set()
    else shiftStage(set)
  }, [atlasFullscreen, route])
  // Say when the connection comes and goes – nothing is lost either way.
  const online = useOnline()
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    toast(online ? { title: 'Back online', tone: 'success' } : { title: 'You’re offline', body: 'Tars keeps working – everything is saved on this device.' })
  }, [online])
  return null
}

/**
 * Around the app-wide dialogs and floating surfaces. If one of them throws
 * outside its own Sheet (which closes itself, see ui/Sheet.tsx), everything
 * that was open is closed and the surfaces are mounted again, so the screen
 * underneath is never lost. Repeated failures stop the retrying.
 */
function OverlayBoundary({ children }: { children: ReactNode }) {
  const [attempt, setAttempt] = useState(0)
  const failures = useRef<number[]>([])
  return (
    <ErrorBoundary
      resetKey={attempt}
      fallback={() => null}
      onError={() => {
        const ui = useUi.getState()
        ui.set({ paletteOpen: false, shortcutsOpen: false })
        toast({ title: 'That couldn’t open', body: 'Nothing was lost. Try it again.', tone: 'warning' })
        const now = Date.now()
        failures.current = [...failures.current.filter((t) => now - t < 10_000), now]
        if (failures.current.length <= 3) setAttempt((n) => n + 1)
      }}
    >
      {children}
    </ErrorBoundary>
  )
}

/** Placeholder while a screen's code loads (first visit only). */
function ScreenSkeleton() {
  return (
    <div className="pt-safe mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8" aria-busy="true" aria-label="Loading">
      <div className="flex h-14 items-center">
        <div className="skeleton h-6 w-36" />
      </div>
      <div className="mt-6 space-y-5">
        <div className="skeleton h-4 w-2/3" />
        <div className="skeleton h-4 w-1/2 opacity-80" />
        <div className="skeleton h-4 w-3/5 opacity-60" />
      </div>
    </div>
  )
}

function Screen({ name }: { name: RouteName }) {
  const Current = SCREENS[name]
  return <Current />
}

/** Shared device lifecycle and platform services. */
function RuntimeSync() {
  const settings = useSettings()
  useEffect(() => setHapticsEnabled(settings.haptics), [settings.haptics])
  useEffect(() => { document.title = 'Tars — Atlas & News' }, [])
  useEffect(() => {
    if (!isNative) return
    const back = CapApp.addListener('backButton', () => {
      if (useUi.getState().paletteOpen) { useUi.getState().set({ paletteOpen: false }); return }
      if (closeTopSurface()) return
      if (currentRoute().name !== 'atlas') navigate('#/atlas')
      else void CapApp.minimizeApp()
    })
    const open = (link: string) => {
      const match = link.match(/^(?:tars|lodestar):\/\/(.*)$/i)
      if (match) navigate('#/' + match[1])
    }
    const url = CapApp.addListener('appUrlOpen', ({ url }) => open(url))
    void CapApp.getLaunchUrl().then(r => r?.url && open(r.url))
    return () => { void back.then(h => h.remove()); void url.then(h => h.remove()) }
  }, [])
  useSwUpdates()
  return null
}

function useSwUpdates() {
  useEffect(() => {
    if (isNative || !('serviceWorker' in navigator) || import.meta.env.DEV) return
    let cancelled = false
    void import('virtual:pwa-register').then(({ registerSW }) => {
      if (cancelled) return
      const update = registerSW({
        onNeedRefresh() {
          toast({
            title: 'A new version is ready',
            body: 'Reload to update – your data is saved on this device.',
            duration: 0,
            action: { label: 'Reload', run: () => void update(true) },
          })
        },
        onOfflineReady() {
          toast({ title: 'Ready to work offline', body: 'Tars is installed on this device.', tone: 'success' })
        },
      })
    })
    return () => {
      cancelled = true
    }
  }, [])
}
