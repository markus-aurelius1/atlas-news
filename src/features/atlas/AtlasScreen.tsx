/** The offline Atlas: a full-bleed physical map with a thin layer of floating instruments over it. */
import { AnimatePresence, motion } from 'motion/react'
import { BookOpenText, GraduationCap, Layers, Maximize2, Minimize2, Minus, Plus, Scan, X } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { consumeParams, currentRoute, useRoute, type Route } from '@/app/router'
import { onRouteReset, useRouteState } from '@/app/routeState'
import { useScreenActive } from '@/app/screenActive'
import { isTyping } from '@/app/shortcuts'
import { useResolvedDark } from '@/app/theme'
import { useUi } from '@/app/ui-store'
import type { PyqFilter } from '@/atlas/pyq/browse'
import { useSheet, type Sheet as MapSheet } from '@/atlas/sheet'
import type { Place, SheetId } from '@/atlas/types'
import { useExploration, type Exploration } from '@/atlas/useExploration'
import { useHotspots } from '@/atlas/useHotspots'
import { updateSettings, useSettings } from '@/data/hooks'
import { DEFAULT_SETTINGS } from '@/data/seed'
import type { AtlasLayers } from '@/data/types'
import { prefersReducedMotion } from '@/lib/motion'
import { enterFullscreen, exitFullscreen, isFullscreen, onFullscreenExit } from '@/services/fullscreen'
import { haptics } from '@/services/haptics'
import { useTarsSelection } from '@/tars/selection'
import { anyLayerOpen, Sheet } from '@/ui/Sheet'
import { BottomSheet } from '@/ui/surface/BottomSheet'
import { useSurface } from '@/ui/surface/core'
import { useIsDesktop } from '@/ui/useMedia'
import { AtlasMap, setAtlasMapAwake, type AtlasMapHandle, type Highlight, type MapInsets, type MapTarget, type Tone } from './AtlasMap'
import { AtlasPanel } from './AtlasPanel'
import { CanonicalQuiz } from './CanonicalQuiz'
import { FieldReviewSheet, type ReviewRequest } from './FieldReview'
import { kindsFor, PLACE_GROUPS } from './groups'
import { LegendSheet } from './Legend'
import { MapOptions } from './MapOptions'
import { Omnibar, type OmnibarHandle } from './Omnibar'
import { PlaceDetails } from './PlaceDetails'
import { PyqBrowser } from './PyqBrowser'
import { UnitDetails } from './UnitDetails'
import { masteryFn, viewFor } from './util'
import './atlas.css'

type Selection = { type: 'place'; id: string } | { type: 'state'; id: string } | { type: 'country'; id: string }
type Panel = 'legend' | 'recall' | null

/** The desktop inspector's width plus its margins, kept clear when a place is brought into view. */
const INSPECTOR_CLEAR = 380 + 36
const HUD_TOP = 64

/** How close to fly in for a place: big features stay wide, points come close. */
const WIDE = new Set(['sea', 'gulf', 'desert', 'plateau', 'plain', 'region', 'range', 'coast', 'grassland'])
const zoomFor = (p: Place) => (WIDE.has(p.kind) ? 1.4 : p.kind === 'river' || p.kind === 'canal' || p.kind === 'strait' || p.kind === 'delta' ? 1.8 : p.shape === 'area' ? 2.6 : 3)
const NO_IDS: Set<string> = new Set()

export default function AtlasScreen() {
  const ex = useExploration()
  if (!ex) return <MapLoading />
  return <Atlas ex={ex} />
}

function MapLoading({ error }: { error?: boolean }) {
  return (
    <div className="atlas-loading" role="status">
      <span className="atlas-loading-mark" aria-hidden="true" />
      <p>{error ? 'The bundled map couldn’t load. Reload and try again.' : 'Opening the Atlas'}</p>
    </div>
  )
}

function Atlas({ ex }: { ex: Exploration }) {
  const settings = useSettings()
  const dark = useResolvedDark(settings.theme)
  const desktop = useIsDesktop()
  // Kept for the session (app/routeState.ts): on devices where the Atlas is not kept alive, returning still opens the same sheet.
  const [sheetId, setSheetId] = useRouteState<SheetId>('atlas:sheet', () => (currentRoute().params.get('sheet') === 'world' ? 'world' : 'india'))
  const { sheet: loaded, error } = useSheet(sheetId)
  // Keep showing the previous sheet until the next one is ready, then cross-fade.
  const [sheet, setSheet] = useState<MapSheet | null>(loaded)
  useEffect(() => {
    if (loaded) setSheet(loaded)
  }, [loaded])
  const map = useRef<AtlasMapHandle | null>(null)
  const setMap = useCallback((h: AtlasMapHandle | null) => {
    if (h) map.current = h
  }, [])
  const search = useRef<OmnibarHandle>(null)
  const [sel, setSel] = useState<Selection | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [detent, setDetent] = useState(1)
  const [sheetHeight, setSheetHeight] = useState(0)
  const [browserFilter, setBrowserFilter] = useState<PyqFilter | null>(null)
  const [showHotspots, setShowHotspots] = useState(false)
  const hotspotIds = useHotspots(showHotspots)
  const [pyqId, setPyqId] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [review, setReview] = useState<ReviewRequest | null>(null)
  const pendingFly = useRef<Place | null>(null)
  const pendingInsets = useRef<MapInsets | undefined>(undefined)
  const layers: AtlasLayers = settings.atlasLayers ?? DEFAULT_SETTINGS.atlasLayers!
  /**
   * The Atlas stays mounted behind the other workspaces (App.tsx), so its
   * sheet, camera and selection – and the painted map itself – are there on
   * return. Whether it is in front, and the address it was opened with, are
   * read by a leaf (<AtlasPresence>), not here: coming back must not re-render
   * the whole screen. This component hears about it through these callbacks.
   */
  const front = useRef(true)
  const [, wake] = useState(0)
  const full = useAtlasFullscreen()
  const onLeave = useCallback(() => {
    front.current = false
    // Behind another screen the map ignores new props (theme, progress); see setAtlasMapAwake.
    setAtlasMapAwake(false)
    // Anything modal is closed, or it would be left without its backdrop and focus handling.
    setReview(null)
    setPanel(null)
    setBrowserFilter(null)
    setPyqId(null)
    useTarsSelection.getState().set(null, null)
  }, [])
  // Pressing Atlas while on the Atlas: back to the overview.
  useEffect(
    () =>
      onRouteReset((r) => {
        if (r !== 'atlas') return
        setSel(null)
        setInspectorOpen(false)
        map.current?.fitFocus()
      }),
    [],
  )

  // The physical and political plates follow the theme; the two earned styles keep their own look.
  const view = viewFor(settings.atlasStyle, ex.level.rankIndex)
  const tone: Tone = view.style === 'physical' && dark ? 'dusk' : view.style === 'political' && dark ? 'night' : view.tone
  const mastery = useMemo(() => masteryFn(ex), [ex])
  const shownId: SheetId = sheet?.id ?? sheetId

  const places = ex.atlas.bySheet[shownId]
  const discovered = ex.state.discovered
  const { muted, linked, features } = useMemo(() => {
    const muted = new Set<string>()
    const linked = new Map<string, string>()
    const features = new Map<string, string>()
    for (const p of places) {
      if (!p.geom) continue
      if (discovered.has(p.id)) {
        linked.set(p.geom, p.id)
        features.set(p.geom, p.id)
      } else {
        muted.add(p.geom)
        if (!features.has(p.geom)) features.set(p.geom, p.id)
      }
    }
    return { muted, linked, features }
  }, [places, discovered])
  const explored = useMemo(() => (shownId === 'world' ? new Set([...ex.state.explored].map((u) => u.toLowerCase())) : ex.state.explored), [ex, shownId])
  const kinds = useMemo(() => kindsFor(layers.groups), [layers.groups])

  const selectedPlace = sel?.type === 'place' ? ex.atlas.byId.get(sel.id) : undefined
  // What is selected is context for Tars only while the Atlas is the screen in front.
  const selection = useRef({ place: selectedPlace?.id ?? null, pyq: pyqId })
  selection.current = { place: selectedPlace?.id ?? null, pyq: pyqId }
  useEffect(() => {
    if (front.current) useTarsSelection.getState().set(selectedPlace?.id ?? null, pyqId)
  }, [selectedPlace?.id, pyqId])
  const onFront = useCallback(() => {
    setAtlasMapAwake(true)
    // Back in front: one render so the map takes up whatever changed while it was behind.
    if (!front.current) wake((n) => n + 1)
    front.current = true
    useTarsSelection.getState().set(selection.current.place, selection.current.pyq)
  }, [])
  useEffect(() => () => useTarsSelection.getState().set(null, null), [])
  const highlights = useMemo<Highlight[]>(() => {
    if (!sel) return []
    if (sel.type === 'state' || sel.type === 'country') return [{ kind: sel.type, id: sel.id }]
    const p = ex.atlas.byId.get(sel.id)
    if (!p?.geom || p.sheet !== shownId) return []
    const [layer, id] = p.geom.split(':')
    return [{ kind: layer as Highlight['kind'], id }]
  }, [sel, ex, shownId])

  /** Fly to a place (switching sheet first if needed), centred above whatever covers the map. */
  const flyToPlace = useCallback(
    (p: Place, opts: { sheetOpen?: boolean } = {}) => {
      const insets = coveredBy(desktop, !!opts.sheetOpen)
      if (p.sheet !== shownId || !sheet) {
        pendingFly.current = p
        setSheetId(p.sheet)
        pendingInsets.current = insets
        return
      }
      map.current?.flyTo(p.x, p.y, zoomFor(p), insets)
    },
    [shownId, sheet, desktop, setSheetId],
  )
  useEffect(() => {
    if (!sheet || !pendingFly.current || pendingFly.current.sheet !== shownId) return
    const p = pendingFly.current
    pendingFly.current = null
    // Let the new sheet fit and paint first, then travel from the overview.
    const id = setTimeout(
      () => {
        map.current?.flyTo(p.x, p.y, zoomFor(p), pendingInsets.current)
      },
      prefersReducedMotion() ? 0 : 280,
    )
    return () => clearTimeout(id)
  }, [sheet, shownId])

  const open = useCallback((t: Selection) => {
    setSel(t)
    setDetent(1)
    setInspectorOpen(true)
  }, [])

  const select = useCallback(
    (t: MapTarget) => {
      if (t.type === 'point' || t.type === 'pin') {
        setSel(null)
        setInspectorOpen(false)
        return
      }
      if (t.type === 'country' && shownId === 'india' && t.id === 'ind') return
      haptics.tap()
      if (t.type === 'place') {
        const p = ex.atlas.byId.get(t.id)
        if (p && p.sheet !== shownId) flyToPlace(p, { sheetOpen: true })
        // The card is about to cover part of the map: make sure it doesn't cover the place itself.
        else if (p) map.current?.reveal(p.x, p.y, coveredBy(desktop, true))
      }
      open(t)
    },
    [ex, shownId, flyToPlace, desktop, open],
  )

  /** From a card or a search result: select it and bring it into view. */
  const selectAndShow = useCallback(
    (t: MapTarget) => {
      select(t)
      const p = t.type === 'place' ? ex.atlas.byId.get(t.id) : undefined
      if (p) flyToPlace(p, { sheetOpen: true })
    },
    [select, ex, flyToPlace],
  )

  const switchSheet = useCallback(
    (id: SheetId) => {
      if (id === sheetId) return
      haptics.tap()
      setSel(null)
      setInspectorOpen(false)
      setSheetId(id)
    },
    [sheetId, setSheetId],
  )

  // Deep links: #/atlas?place=…, ?review=1. Called by <AtlasPresence> with each address the Atlas is opened on.
  const onLink = (route: Route) => {
    // The Atlas may already be open on another sheet when a link names one.
    const wanted = route.params.get('sheet')
    if (wanted === 'world' || wanted === 'india') setSheetId(wanted)
    const id = route.params.get('place')
    if (id && ex.atlas.byId.get(id)) {
      const p = ex.atlas.byId.get(id)!
      open({ type: 'place', id })
      flyToPlace(p, { sheetOpen: true })
    }
    if (route.params.get('review') && ex.due.length) setReview({ placeIds: ex.due.slice(0, 8).map((d) => d.id), source: 'review' })
    if (route.params.get('search')) search.current?.open(route.params.get('search')!)
    if (route.params.get('test') && ex.atlas.byId.has(route.params.get('test')!)) setReview({ placeIds: [route.params.get('test')!], source: 'card' })
    if (route.params.get('questions')) setBrowserFilter({ placeId: route.params.get('placeId') ?? undefined, family: route.params.get('family') ?? undefined, year: route.params.get('year') ? Number(route.params.get('year')) : undefined, kind: route.params.get('kind') ?? undefined, mode: route.params.get('mode') ?? undefined })
    if (route.params.get('pyq')) setPyqId(route.params.get('pyq'))
    consumeParams('place', 'review', 'sheet', 'pyq', 'search', 'test', 'questions', 'placeId', 'family', 'year', 'kind', 'mode')
  }

  const startReview = () => {
    const ids = ex.due.slice(0, 8).map((d) => d.id)
    if (ids.length) {
      setPanel(null)
      setReview({ placeIds: ids, source: 'review' })
    }
  }
  const actions = {
    startReview,
    pickState: (id: string) => {
      setPanel(null)
      if (sheetId !== 'india') setSheetId('india')
      open({ type: 'state', id })
    },
  }

  const closeInspector = useCallback(() => {
    setInspectorOpen(false)
    setSel(null)
  }, [])

  const details = sel ? (
    sel.type === 'place' && selectedPlace ? (
      <PlaceDetails
        ex={ex}
        place={selectedPlace}
        onPyq={setPyqId}
        onSelect={selectAndShow}
        onTest={(id) => setReview({ placeIds: [id], source: 'card', title: 'Recall' })}
        onShow={(p) => {
          if (!desktop) setDetent(0)
          flyToPlace(p, { sheetOpen: desktop })
        }}
      />
    ) : sel.type !== 'place' ? (
      <UnitDetails ex={ex} unit={sel} onSelect={selectAndShow} />
    ) : null
  ) : null

  // Stable while nothing about it changes, so the (memoised) map is not re-rendered by the screen around it.
  const showInspector = !!details && inspectorOpen
  const mapInsets = useMemo<MapInsets>(() => (desktop ? { top: HUD_TOP, bottom: 0, right: showInspector ? INSPECTOR_CLEAR : 0 } : { top: HUD_TOP, bottom: sheetHeight || 24 }), [desktop, showInspector, sheetHeight])
  const setLayers = (patch: Partial<AtlasLayers>) => void updateSettings({ atlasLayers: { ...layers, ...patch } })
  const activeGroups = PLACE_GROUPS.filter((g) => layers.groups.includes(g.id))
  const due = Math.min(ex.due.length, 99)
  const busy = !!pyqId || !!review

  return (
    <div data-atlas-surface className="atlas-screen">
      <AtlasPresence onFront={onFront} onLeave={onLeave} onLink={onLink} toggleFullscreen={full.toggle} focusSearch={() => search.current?.open()} />
      <div className="atlas-stage">
        {sheet ? (
          <AnimatePresence initial={false}>
            <motion.div key={sheet.id} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: prefersReducedMotion() ? 0 : 0.28, ease: 'easeOut' }}>
              <AtlasMap
                ref={setMap}
                sheet={sheet}
                plate={view.plate}
                tone={tone}
                explored={explored}
                places={places}
                discovered={discovered}
                showUndiscovered={true}
                kinds={kinds}
                showAreas={layers.areas}
                featurePlaces={features}
                mastery={mastery}
                newIds={NO_IDS}
                pyqPlaceIds={hotspotIds}
                selectedId={sel?.type === 'place' ? sel.id : undefined}
                highlights={highlights}
                mutedLabels={muted}
                linkedLabels={linked}
                living={null}
                onSelect={select}
                instantSelect={desktop}
                insets={mapInsets}
              />
            </motion.div>
          </AnimatePresence>
        ) : (
          <MapLoading error={!!error} />
        )}

        <div data-map-ui className="hud hud-top">
          <Omnibar ref={search} ex={ex} sheet={sheetId} onSheet={switchSheet} groups={layers.groups} onGroups={(groups) => setLayers({ groups })} onPick={(id) => selectAndShow({ type: 'place', id })} />
          <div className="hud-tools" role="toolbar" aria-label="Atlas tools">
            <MapOptions
              current={view.style}
              rankIndex={ex.level.rankIndex}
              layers={layers}
              onLayers={setLayers}
              hotspots={showHotspots}
              onHotspots={setShowHotspots}
              onLegend={() => setPanel('legend')}
              trigger={(props) => (
                <button type="button" className="tool" aria-label="Map layers" title="Map layers" {...props}>
                  <Layers />
                </button>
              )}
            />
            <button type="button" className="tool" aria-label="Previous questions" title="Previous questions" onClick={() => setBrowserFilter({})}>
              <BookOpenText />
            </button>
            <button type="button" className="tool" aria-label={due ? `Recall – ${due} due` : 'Recall'} title="Recall" onClick={() => setPanel('recall')}>
              <GraduationCap />
              {due > 0 && <span className="hud-count type-numeric">{due}</span>}
            </button>
          </div>
          {activeGroups.length > 0 && (
            <div className="hud-filters" aria-label="Active place filters">
              {activeGroups.map((g) => (
                <button key={g.id} type="button" className="hud-filter" onClick={() => setLayers({ groups: layers.groups.filter((id) => id !== g.id) })} aria-label={`Remove filter: ${g.label}`}>
                  {g.label}
                  <X aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div data-map-ui className="hud hud-zoom" role="group" aria-label="Map view">
          <button type="button" className="tool hud-zoom-step" aria-label="Zoom in" title="Zoom in" onClick={() => map.current?.zoomBy(1.6)}>
            <Plus />
          </button>
          <button type="button" className="tool hud-zoom-step" aria-label="Zoom out" title="Zoom out" onClick={() => map.current?.zoomBy(1 / 1.6)}>
            <Minus />
          </button>
          <button type="button" className="tool" aria-label="Fit the map" title="Fit the map" onClick={() => map.current?.fitFocus()}>
            <Scan />
          </button>
          <button type="button" className="tool" aria-label={full.on ? 'Exit full screen' : 'Full-screen map'} title={full.on ? 'Exit full screen (Esc)' : 'Full-screen map (Shift+F)'} aria-pressed={full.on} onClick={full.toggle}>
            {full.on ? <Minimize2 /> : <Maximize2 />}
          </button>
        </div>

        <Inspector open={desktop && showInspector && !busy} onClose={closeInspector} label={selectedPlace?.name ?? 'Place details'}>
          {details}
        </Inspector>
      </div>

      {!desktop && (
        <BottomSheet
          open={showInspector && !browserFilter && !busy && !panel}
          onClose={closeInspector}
          label={selectedPlace?.name ?? 'Place details'}
          detents={[132, 0.52, 1]}
          detent={detent}
          onDetentChange={setDetent}
          onHeight={setSheetHeight}
          modal={false}
          dismissible
          size="lg"
          bare
          className="atlas-place-sheet"
        >
          <div className="inspector-body">
            <button type="button" className="tool inspector-close" aria-label="Close place details" onClick={closeInspector}>
              <X />
            </button>
            {details}
          </div>
        </BottomSheet>
      )}
      <PyqBrowser filter={browserFilter} atlas={ex.atlas} onClose={() => setBrowserFilter(null)} onOpen={(id) => { setBrowserFilter(null); setPyqId(id) }} onPlace={(id) => { setBrowserFilter(null); selectAndShow({ type: 'place', id }) }} />
      <CanonicalQuiz id={pyqId} atlas={ex.atlas} onClose={() => setPyqId(null)} onPlace={(id) => { setPyqId(null); selectAndShow({ type: 'place', id }) }} />
      <Sheet open={panel === 'recall'} onClose={() => setPanel(null)} title="Recall" size="md">
        <AtlasPanel ex={ex} actions={actions} />
      </Sheet>
      <LegendSheet open={panel === 'legend'} onClose={() => setPanel(null)} />
      <FieldReviewSheet request={review} onClose={() => setReview(null)} />
    </div>
  )
}

/** Non-modal inspection shares Escape/Back ownership while leaving the map usable. */
function Inspector({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  const id = useId()
  const panel = useRef<HTMLElement>(null)
  const active = useScreenActive()
  useSurface({ open: open && active, onClose, id, panel, modal: false, focusOnOpen: false, history: false })
  if (!open) return null
  return (
    <aside ref={panel} data-inspector className="inspector" aria-label={label}>
      <button type="button" className="tool inspector-close" aria-label="Close place details" title="Close (Esc)" onClick={onClose}>
        <X />
      </button>
      <div className="inspector-body scrollbar-thin">{children}</div>
    </aside>
  )
}

/** What a place card covers once it is open: the inspector's side on desktop, the lower part of the screen on a phone. */
function coveredBy(desktop: boolean, cardOpen: boolean): MapInsets | undefined {
  if (!cardOpen) return undefined
  return desktop ? { top: HUD_TOP, right: INSPECTOR_CLEAR } : { top: HUD_TOP, bottom: Math.round(window.innerHeight * 0.52) }
}

/**
 * Everything about the Atlas that depends on its being the screen in front, or
 * on the address: leaving and returning, deep links, the keyboard. A component
 * of its own, rendering nothing, so that these changes re-render it and not the
 * screen.
 */
function AtlasPresence({ onFront, onLeave, onLink, toggleFullscreen, focusSearch }: { onFront: () => void; onLeave: () => void; onLink: (route: Route) => void; toggleFullscreen: () => void; focusSearch: () => void }) {
  const active = useScreenActive()
  const route = useRoute()
  const link = useRef(onLink)
  link.current = onLink
  const focus = useRef(focusSearch)
  focus.current = focusSearch
  useEffect(() => {
    if (!active) return
    onFront()
    return onLeave
  }, [active, onFront, onLeave])
  useEffect(() => {
    // Behind another screen the address belongs to that screen: its params are not ours to read or remove.
    if (active && route.name === 'atlas') link.current(route)
  }, [route, active])
  useEffect(() => {
    if (!active) return
    // The browser left full screen (Escape, F11, its own control): follow it.
    const off = onFullscreenExit(() => useUi.getState().set({ atlasFullscreen: false }))
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || anyLayerOpen()) return
      if (e.key === '/') {
        e.preventDefault()
        focus.current()
      } else if (e.key === 'F' && e.shiftKey) {
        e.preventDefault()
        toggleFullscreen()
      } else if (e.key === 'Escape' && useUi.getState().atlasFullscreen && !isFullscreen()) {
        // No browser full screen to leave (unsupported/denied): Escape exits our own.
        useUi.getState().set({ atlasFullscreen: false })
      }
    }
    const onCommand = () => toggleFullscreen()
    window.addEventListener('keydown', onKey)
    window.addEventListener('tars:atlas-fullscreen', onCommand)
    return () => {
      off()
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('tars:atlas-fullscreen', onCommand)
      // Leaving the Atlas always restores the app.
      if (useUi.getState().atlasFullscreen) {
        useUi.getState().set({ atlasFullscreen: false })
        void exitFullscreen()
      }
    }
  }, [toggleFullscreen, active])
  return null
}

/**
 * Full-screen map: the app's chrome slides away (ShellSync sets data-chrome on
 * <html>) and, where the Fullscreen API exists, the browser goes full screen too.
 */
function useAtlasFullscreen() {
  const on = useUi((s) => s.atlasFullscreen)
  const toggle = useCallback(() => {
    haptics.tap()
    const ui = useUi.getState()
    if (ui.atlasFullscreen) {
      ui.set({ atlasFullscreen: false })
      void exitFullscreen()
    } else {
      ui.set({ atlasFullscreen: true })
      void enterFullscreen()
    }
  }, [])
  return { on, toggle }
}
