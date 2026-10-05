/** The offline Atlas: freely accessible places, canonical PYQs and recall-based mastery. */
import { useHotspots } from '@/atlas/useHotspots'
import { AnimatePresence, motion } from 'motion/react'
import { BookOpen, Check, ChevronUp, Crosshair, GraduationCap, Info, Lock, Maximize2, Minimize2, Minus, MoreHorizontal, PanelRightClose, PanelRightOpen, Plus, Search } from 'lucide-react'
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { consumeParams, currentRoute, useRoute, type Route } from '@/app/router'
import { isTyping } from '@/app/shortcuts'
import { useUi } from '@/app/ui-store'
import { useSheet, type Sheet as MapSheet } from '@/atlas/sheet'
import { livingWorld } from '@/atlas/living'
import type { Place, SheetId } from '@/atlas/types'
import { useExploration, type Exploration } from '@/atlas/useExploration'
import { updateSettings, useSettings } from '@/data/hooks'
import { DEFAULT_SETTINGS } from '@/data/seed'
import type { AtlasLayers } from '@/data/types'
import { MAP_STYLES, RANKS } from '@/game/progression'
import { cn } from '@/lib/cn'
import { prefersReducedMotion } from '@/lib/motion'
import { KEYS, migrateLegacyKeys } from '@/lib/storage'
import { enterFullscreen, exitFullscreen, isFullscreen, onFullscreenExit } from '@/services/fullscreen'
import { haptics } from '@/services/haptics'
import { Button, Chip, IconButton, Segmented, Toggle } from '@/ui/controls'
import { anyLayerOpen, Sheet } from '@/ui/Sheet'
import { useIsDesktop } from '@/ui/useMedia'
import { AtlasMap, type AtlasMapHandle, type Highlight, type MapInsets, type MapTarget, setAtlasMapAwake } from './AtlasMap'
import { AtlasPanel } from './AtlasPanel'
import { FieldReviewSheet, type ReviewRequest } from './FieldReview'
import { GazetteerSheet } from './Gazetteer'
import { kindsFor, PLACE_GROUPS } from './groups'
import { LegendSheet } from './Legend'
import { PyqBrowser } from './PyqBrowser'
import { OfflineAtlas } from './OfflineAtlas'
import { BottomSheet } from '@/ui/surface/BottomSheet'
import { useSurface } from '@/ui/surface/core'
import './presentation.css'
import type { PyqFilter } from '@/atlas/pyq/browse'
import { useTarsSelection } from '@/tars/selection'
import { CanonicalQuiz } from './CanonicalQuiz'
import { PlaceDetails } from './PlaceDetails'
import { UnitDetails } from './UnitDetails'
import { masteryFn, viewFor } from './util'
import { onRouteReset, useRouteState } from '@/app/routeState'
import { useScreenActive } from '@/app/screenActive'

type Selection = { type: 'place'; id: string } | { type: 'state'; id: string } | { type: 'country'; id: string }
type Panel = 'gazetteer' | 'legend' | 'more' | null

const VISIT_KEY = KEYS.atlasVisit
const readVisit = () => {
  migrateLegacyKeys()
  try {
    return Number(localStorage.getItem(VISIT_KEY)) || 0
  } catch {
    return 0
  }
}
const writeVisit = (t: number) => {
  try {
    localStorage.setItem(VISIT_KEY, String(t))
  } catch {
    /* storage unavailable */
  }
}

/** The desktop inspector: its width plus the gaps either side, kept clear when a place is brought into view. */
const INSPECTOR_W = 432
const INSPECTOR_CLEAR = INSPECTOR_W + 48

/** How close to fly in for a place: big features stay wide, points come close. */
const WIDE = new Set(['sea', 'gulf', 'desert', 'plateau', 'plain', 'region', 'range', 'coast', 'grassland'])
const zoomFor = (p: Place) => (WIDE.has(p.kind) ? 1.4 : p.kind === 'river' || p.kind === 'canal' || p.kind === 'strait' || p.kind === 'delta' ? 1.8 : p.shape === 'area' ? 2.6 : 3)

export default function AtlasScreen() {
  const ex = useExploration()
  if (!ex) return <MapLoading />
  return <Atlas ex={ex} />
}

/** The Atlas fills the stage: the page minus the tab bar on a phone, the whole stage in the window (and all of the screen in full screen, when the chrome steps aside). */
const MAP_HEIGHT = 'h-full'

function MapLoading({ error }: { error?: boolean }) {
  return (
    <div className={cn('flex items-center justify-center bg-[#c6e1f2]', MAP_HEIGHT)}>
      <p className="rounded-full bg-white/80 px-4 py-2 text-sm font-semibold text-[#1f3a64] shadow-soft">{error ? 'The bundled map couldn’t load. Reload Atlas and try again.' : 'Unrolling the map…'}</p>
    </div>
  )
}

function Atlas({ ex }: { ex: Exploration }) {
  const settings = useSettings()
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
  const [sel, setSel] = useState<Selection | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [detent, setDetent] = useState(1)
  const [sheetHeight, setSheetHeight] = useState(0)
  const [browserFilter, setBrowserFilter] = useState<PyqFilter | null>(null)
  const [showHotspots, setShowHotspots] = useState(false)
  const hotspotIds = useHotspots(showHotspots)
  const [searchQuery, setSearchQuery] = useState('')
  const [pyqId, setPyqId] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>(null)
  const [review, setReview] = useState<ReviewRequest | null>(null)
  const [lastVisit] = useState(readVisit)
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
    writeVisit(Date.now())
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
  // Place knowledge and recall are freely accessible.

  const view = viewFor(settings.atlasStyle, ex.level.rankIndex)
  const mastery = useMemo(() => masteryFn(ex), [ex])
  const shownId: SheetId = sheet?.id ?? sheetId

  const places = ex.atlas.bySheet[shownId]
  const discovered = ex.state.discovered
  const newIds = useMemo(() => {
    if (!lastVisit) return new Set<string>()
    const fresh = places.filter((p) => (discovered.get(p.id)?.at ?? 0) > lastVisit)
    fresh.sort((a, b) => (discovered.get(b.id)?.at ?? 0) - (discovered.get(a.id)?.at ?? 0))
    return new Set(fresh.slice(0, 12).map((p) => p.id))
  }, [places, discovered, lastVisit])
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

  const living = useMemo(() => livingWorld(ex, shownId), [ex, shownId])
  const selectedPlace = sel?.type === 'place' ? ex.atlas.byId.get(sel.id) : undefined
  // What is selected is context for Tars only while the Atlas is the screen in front.
  const selection = useRef({ place: selectedPlace?.id ?? null, pyq: pyqId })
  selection.current = { place: selectedPlace?.id ?? null, pyq: pyqId }
  useEffect(() => { if (front.current) useTarsSelection.getState().set(selectedPlace?.id ?? null, pyqId) }, [selectedPlace?.id, pyqId])
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
    [shownId, sheet, desktop],
  )
  useEffect(() => {
    if (!sheet || !pendingFly.current || pendingFly.current.sheet !== shownId) return
    const p = pendingFly.current
    pendingFly.current = null
    // Let the new sheet fit and paint first, then travel from the overview.
    const id = setTimeout(() => {
      map.current?.flyTo(p.x, p.y, zoomFor(p), pendingInsets.current)
    }, prefersReducedMotion() ? 0 : 280)
    return () => clearTimeout(id)
  }, [sheet, shownId])

  const select = useCallback(
    (t: MapTarget) => {
      if (t.type === 'point' || t.type === 'pin') return setSel(null)
      haptics.tap()
      if (t.type === 'place') {
        const p = ex.atlas.byId.get(t.id)
        if (p && p.sheet !== shownId) flyToPlace(p, { sheetOpen: true })
        // The card is about to cover part of the map: make sure it doesn't cover the place itself.
        else if (p) map.current?.reveal(p.x, p.y, coveredBy(desktop, true))
      }
      if (t.type === 'country' && shownId === 'india' && t.id === 'ind') return
      setSel(t)
      setDetent(1)
      setInspectorOpen(true)
    },
    [ex, shownId, flyToPlace, desktop],
  )

  /** From a card (a related place, a place listed in a state): select it and bring it into view. */
  const selectAndShow = useCallback(
    (t: MapTarget) => {
      select(t)
      const p = t.type === 'place' ? ex.atlas.byId.get(t.id) : undefined
      if (p) flyToPlace(p, { sheetOpen: true })
    },
    [select, ex, shownId, flyToPlace],
  )

  // Deep links: #/atlas?place=…, ?review=1. Called by <AtlasPresence> with each address the Atlas is opened on.
  const onLink = (route: Route) => {
    // The Atlas may already be open on another sheet when a link names one.
    const wanted = route.params.get('sheet')
    if (wanted === 'world' || wanted === 'india') setSheetId(wanted)
    const id = route.params.get('place')
    if (id && ex.atlas.byId.get(id)) {
      const p = ex.atlas.byId.get(id)!
      setSel({ type: 'place', id })
      setInspectorOpen(true)
      flyToPlace(p, { sheetOpen: true })
    }
    if (route.params.get('review') && ex.due.length) setReview({ placeIds: ex.due.slice(0, 8).map((d) => d.id), source: 'review' })
    if (route.params.get('search')) { setSearchQuery(route.params.get('search')!); setPanel('gazetteer') }
    if (route.params.get('test') && ex.atlas.byId.has(route.params.get('test')!)) setReview({ placeIds: [route.params.get('test')!], source: 'card' })
    if (route.params.get('questions')) setBrowserFilter({ placeId: route.params.get('placeId') ?? undefined, family: route.params.get('family') ?? undefined, year: route.params.get('year') ? Number(route.params.get('year')) : undefined, kind: route.params.get('kind') ?? undefined, mode: route.params.get('mode') ?? undefined })
    if (route.params.get('pyq')) setPyqId(route.params.get('pyq'))
    consumeParams('place', 'review', 'sheet', 'pyq', 'search', 'test', 'questions', 'placeId', 'family', 'year', 'kind', 'mode')
  }

  const startReview = () => {
    const ids = ex.due.slice(0, 8).map((d) => d.id)
    if (ids.length) setReview({ placeIds: ids, source: 'review' })
  }
  const actions = {
    startReview,
    pickState: (id: string) => {
      setPanel(null)
      if (sheetId !== 'india') setSheetId('india')
      setSel({ type: 'state', id })
    },
  }

  const details = sel ? (
    sel.type === 'place' && selectedPlace ? (
      <PlaceDetails
        ex={ex}
        place={selectedPlace}
        onPyq={setPyqId}
        onSelect={selectAndShow}
        onTest={(id) => setReview({ placeIds: [id], source: 'card', title: 'Test me' })}
        onShow={(p) => {
          if (!desktop) setInspectorOpen(false)
          flyToPlace(p)
        }}
      />
    ) : sel.type !== 'place' ? (
      <UnitDetails ex={ex} unit={sel} onSelect={selectAndShow} />
    ) : null
  ) : null

  // Stable while nothing about it changes, so the (memoised) map is not re-rendered by the screen around it.
  const mapInsets = useMemo<MapInsets>(() => (desktop ? { top: 60, bottom: 0, right: inspectorOpen && sel ? INSPECTOR_CLEAR : 0 } : { top: 60, bottom: sheetHeight || 24 }), [desktop, inspectorOpen, sel, sheetHeight])
  const setLayers = (patch: Partial<AtlasLayers>) => void updateSettings({ atlasLayers: { ...layers, ...patch } })

  return (
    <div data-atlas-surface className={cn('relative flex', MAP_HEIGHT)}>
      <AtlasPresence onFront={onFront} onLeave={onLeave} onLink={onLink} toggleFullscreen={full.toggle} />
      <div className="relative min-w-0 flex-1 overflow-hidden">
        {sheet ? (
          <AnimatePresence initial={false}>
            <motion.div key={sheet.id} className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: prefersReducedMotion() ? 0 : 0.26, ease: 'easeOut' }}>
              <AtlasMap
                ref={setMap}
                sheet={sheet}
                plate={view.plate}
                tone={view.tone}
                explored={explored}
                places={places}
                discovered={discovered}
                showUndiscovered={true}
                kinds={kinds}
                showAreas={layers.areas}
                featurePlaces={features}
                mastery={mastery}
                newIds={newIds}
                pyqPlaceIds={hotspotIds}
                selectedId={sel?.type === 'place' ? sel.id : undefined}
                highlights={highlights}
                mutedLabels={muted}
                linkedLabels={linked}
                living={living}
                onSelect={select}
                instantSelect={desktop}
                insets={mapInsets}
              />
            </motion.div>
          </AnimatePresence>
        ) : (
          <MapLoading error={!!error} />
        )}

        <div data-map-ui className="atlas-top-controls">
          <Segmented label="Map region" value={sheetId} onChange={v => { setSel(null); setInspectorOpen(false); setSheetId(v) }} options={[{ value: 'world', label: 'World' }, { value: 'india', label: 'India' }]} className="atlas-region" />
          <button type="button" className="atlas-search press" aria-label="Search places" title="Search places" onClick={() => { setSearchQuery(''); setPanel('gazetteer') }}><Search className="size-[18px]" /></button>
          <LayersMenu current={view.style} rankIndex={ex.level.rankIndex} layers={layers} onLayers={setLayers} actions={[
            { label: 'Fit the map', icon: <Crosshair className="size-4" />, run: () => map.current?.fitFocus() },
            { label: 'Legend', icon: <Info className="size-4" />, run: () => setPanel('legend') },
            { label: 'PYQ hotspots', icon: <BookOpen className="size-4" />, pressed: showHotspots, run: () => setShowHotspots(v => !v) },
            { label: full.on ? 'Exit full screen (Esc)' : 'Full-screen map (Shift+F)', icon: <Maximize2 className="size-4" />, run: full.toggle },
            { label: `Review${ex.due.length ? ' · ' + Math.min(ex.due.length, 99) : ''}`, icon: <GraduationCap className="size-4" />, disabled: !ex.due.length, run: startReview },
            { label: 'Atlas tools', icon: <BookOpen className="size-4" />, run: () => setPanel('more') },
          ]} />
          {full.on && <MapButton label="Exit full screen (Esc)" onClick={full.toggle}><Minimize2 className="size-[18px]" /></MapButton>}
        </div>
        {(
          <div data-map-ui className={cn('absolute flex-col', TOOLBAR, desktop ? 'atlas-zoom' : 'atlas-zoom-mobile')}>
            <MapButton label="Zoom in" onClick={() => map.current?.zoomBy(1.6)}>
              <Plus className="size-[18px]" />
            </MapButton>
            <MapButton label="Zoom out" onClick={() => map.current?.zoomBy(1 / 1.6)}>
              <Minus className="size-[18px]" />
            </MapButton>
          </div>
        )}

      </div>
      <PlaceInspector open={desktop && !!details && inspectorOpen && !pyqId && !review} onClose={() => setInspectorOpen(false)}>
        <div className="atlas-inspector-head"><p className="t-label">Place knowledge</p><IconButton label="Collapse Atlas inspector" onClick={() => setInspectorOpen(false)}><PanelRightClose className="size-4" /></IconButton></div>
        {details}
      </PlaceInspector>
      {details && !inspectorOpen && <button data-map-ui type="button" className="atlas-reopen press" onClick={() => setInspectorOpen(true)} aria-label={desktop ? 'Open Atlas inspector' : 'Reopen place inspector'}><PanelRightOpen className="size-4" />Place details</button>}
      {!desktop && <BottomSheet open={!!details && inspectorOpen && !browserFilter && !pyqId && !review && !panel} onClose={() => setInspectorOpen(false)} label={selectedPlace?.name ?? 'Atlas details'} title="Place knowledge" detents={[144, 420, 1]} detent={detent} onDetentChange={setDetent} onHeight={setSheetHeight} modal={false} dismissible size="lg" className="atlas-place-sheet" headerAction={<button type="button" className="atlas-detent-control" aria-label={detent === 2 ? 'Peek place details' : 'Expand place details'} onClick={() => setDetent(v => v === 2 ? 0 : v + 1)}><ChevronUp className="size-4" /><span>{detent === 2 ? 'Peek' : detent === 0 ? 'Details' : 'Full'}</span></button>}>{details}</BottomSheet>}
      <PyqBrowser filter={browserFilter} atlas={ex.atlas} onClose={() => setBrowserFilter(null)} onOpen={(id) => { setBrowserFilter(null); setPyqId(id) }} onPlace={(id) => { setBrowserFilter(null); selectAndShow({ type: 'place', id }) }} />
      <CanonicalQuiz id={pyqId} atlas={ex.atlas} onClose={() => setPyqId(null)} onPlace={(id) => { setPyqId(null); selectAndShow({ type: 'place', id }); setInspectorOpen(true) }} />
      {(
        <Sheet open={panel === 'more'} onClose={() => setPanel(null)} title="Atlas" size="md">
          <Button onClick={() => { setPanel(null); setBrowserFilter({}) }}>Browse previous questions</Button>
          <AtlasPanel ex={ex} actions={actions} /><OfflineAtlas />
        </Sheet>
      )}
      <GazetteerSheet
        ex={ex}
        sheet={sheetId}
        initialQuery={searchQuery}
        open={panel === 'gazetteer'}
        onClose={() => setPanel(null)}
        onPick={(id) => {
          setPanel(null)
          const p = ex.atlas.byId.get(id)
          setSel({ type: 'place', id })
          setInspectorOpen(true)
          setDetent(1)
          if (p) flyToPlace(p, { sheetOpen: true })
        }}
      />
      <LegendSheet open={panel === 'legend'} onClose={() => setPanel(null)} />
      <FieldReviewSheet request={review} onClose={() => setReview(null)} />
    </div>
  )
}

/** Non-modal inspection shares Escape/Back ownership while leaving the map usable. */
function PlaceInspector({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  const id = useId()
  const panel = useRef<HTMLElement>(null)
  const active = useScreenActive()
  useSurface({ open: open && active, onClose, id, panel, modal: false, focusOnOpen: false, history: false })
  return open ? <aside ref={panel} data-inspector className="atlas-inspector scrollbar-thin" aria-label="Atlas inspector">{children}</aside> : null
}

/** What a place card covers once it is open: the inspector's side on desktop, the lower part of the screen on a phone. */
function coveredBy(desktop: boolean, cardOpen: boolean): MapInsets | undefined {
  if (!cardOpen) return undefined
  return desktop ? { right: INSPECTOR_CLEAR } : { bottom: Math.round(window.innerHeight * 0.55) }
}

/** A group of map controls: one raised capsule floating over the map. */
const TOOLBAR = 'atlas-toolbar'

function MapButton({ label, onClick, children, active, pressed }: { label: string; onClick: () => void; children: React.ReactNode; active?: boolean; pressed?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-expanded={active}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn('press atlas-map-button', (active || pressed) && 'bg-accent-soft text-accent hover:bg-accent-soft hover:text-accent')}
    >
      {children}
    </button>
  )
}

/**
 * Full-screen map: the app's chrome slides away (ShellSync sets data-chrome on
 * <html>) and, where the Fullscreen API exists, the browser goes full screen too.
 * Escape, the browser's own exit and leaving the Atlas all come back out; on
 * phones without the API (iPhone) it still fills the window.
 */
/**
 * Everything about the Atlas that depends on its being the screen in front, or
 * on the address: leaving and returning, deep links, the full-screen keys. A
 * component of its own, rendering nothing, so that these changes re-render it
 * and not the screen.
 */
function AtlasPresence({ onFront, onLeave, onLink, toggleFullscreen }: { onFront: () => void; onLeave: () => void; onLink: (route: Route) => void; toggleFullscreen: () => void }) {
  const active = useScreenActive()
  const route = useRoute()
  const link = useRef(onLink)
  link.current = onLink
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
      if (e.key === 'F' && e.shiftKey) {
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

/** Map style, what to show, and which kinds of place – one menu. */
function LayersMenu({ current, rankIndex, layers, onLayers, actions }: {
  current: string; rankIndex: number; layers: AtlasLayers; onLayers: (patch: Partial<AtlasLayers>) => void
  actions: { label: string; icon: ReactNode; run: () => void; pressed?: boolean; disabled?: boolean }[]
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()
  useSurface({ open, onClose: () => setOpen(false), id, panel, anchor: box, modal: false, focusOnOpen: true, history: false, dismissOnOutsidePress: true })
  const active = useScreenActive()
  useEffect(() => {
    if (!active) setOpen(false)
  }, [active])
  const toggleGroup = (id: string) => onLayers({ groups: layers.groups.includes(id) ? layers.groups.filter((g) => g !== id) : [...layers.groups, id] })
  return (
    <div className="relative atlas-layers" ref={box}>
      <MapButton label="Map options" onClick={() => setOpen((o) => !o)} active={open}>
        <MoreHorizontal className="size-[18px]" />
      </MapButton>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panel}
            role="dialog"
            aria-label="Map options"
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="scrollbar-thin absolute top-full right-0 z-40 mt-2 max-h-[min(70dvh,560px)] w-[min(18.5rem,calc(100vw-1.5rem))] origin-top-right overflow-y-auto rounded-2xl bg-surface p-1.5 shadow-[0_0_0_1px_var(--line),var(--shadow-lift-value)]"
          >
            <div className="atlas-menu-actions">{actions.map(action => <button key={action.label} type="button" aria-pressed={action.pressed} disabled={action.disabled} onClick={() => { setOpen(false); action.run() }} className="press">{action.icon}<span>{action.label}</span>{action.pressed && <Check className="size-4 text-accent" />}</button>)}</div>
            <div className="my-1.5 border-t border-line" />
            <p className="px-3 pt-2 pb-1 t-label text-[12px] text-ink-3">Study map style</p>
            <div role="group" aria-label="Study map style">{MAP_STYLES.map((s) => {
              const locked = s.minRank > rankIndex
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={current === s.id}
                  disabled={locked}
                  onClick={() => void updateSettings({ atlasStyle: s.id })}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left hover:bg-surface-2 disabled:opacity-60"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{s.name}</span>
                    <span className="block text-[12px] text-ink-2">{locked ? `Unlocks at ${RANKS[s.minRank].title}` : s.description}</span>
                  </span>
                  {locked ? <Lock className="size-4 text-ink-3" /> : current === s.id && <Check className="size-4 text-accent" />}
                </button>
              )
            })}</div>
            <div className="my-1.5 border-t border-line" />
            <p className="px-3 pt-1 pb-1 t-label text-[12px] text-ink-3">Show</p>
            <p className="px-3 py-2 text-xs text-ink-3">Every place is accessible. Recall builds familiarity and mastery.</p>
            <label className="flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-2">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Protected areas &amp; disputed regions</span>
                <span className="block text-[12px] text-ink-2">Park outlines appear as you zoom in</span>
              </span>
              <Toggle checked={layers.areas} onChange={(v) => onLayers({ areas: v })} label="Protected areas and disputed regions" />
            </label>
            <div className="my-1.5 border-t border-line" />
            <p className="px-3 pt-1 pb-1 t-label text-[12px] text-ink-3">Places</p>
            <div className="flex flex-wrap gap-1.5 px-3 pt-1 pb-2.5">
              <Chip active={!layers.groups.length} onClick={() => onLayers({ groups: [] })}>
                All
              </Chip>
              {PLACE_GROUPS.map((g) => (
                <Chip key={g.id} active={layers.groups.includes(g.id)} onClick={() => toggleGroup(g.id)}>
                  {g.label}
                </Chip>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
