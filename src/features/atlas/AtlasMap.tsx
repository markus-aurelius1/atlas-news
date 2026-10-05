/**
 * The Atlas map, built to stay smooth on phones.
 *
 * - The base map (relief or political colours, water, boundaries) is painted
 *   off the camera thread into cached tiles. While you pan, pinch or zoom that painted
 *   layer is only moved and scaled on the compositor (CSS transform), so no
 *   base vector is rasterised per frame. Visible tiles are requested outside
 *   the camera callback; an overview remains beneath every level.
 * - Input is batched: pointer and wheel events only record where the fingers
 *   are, and one requestAnimationFrame applies the result. No React render
 *   happens during a gesture.
 * - Names and symbols are laid out in screen space once the view settles, from
 *   a spatial index (only what is on screen is considered), so they stay
 *   crisp, upright and never overlap.
 * - Decorative motion (pulses and ships) runs on compositor
 *   layers and pauses while the map moves.
 */
import { forwardRef, memo, useCallback, useEffect, useId, useMemo, useRef } from 'react'
import { distanceToLines, featureAt, pointInGeometry, type Sheet } from '@/atlas/sheet'
import { GridIndex, viewRect } from '@/atlas/spatial'
import type { Place } from '@/atlas/types'
import { cn } from '@/lib/cn'
import { lowPowerDevice } from '@/lib/device'
import { labelIndexFor, labelKeyOf, FONT_SANS, type LayoutInput, type PlacedSymbol } from './labels'
import { colourAssignment, HIGHLIGHT } from './style'
import { Animal, RoutePath, ShipGlyph } from './living'
import { useScreenActive } from '@/app/screenActive'
import { TONES } from './renderer/palette'
import { Highlights } from './renderer/SvgLayers'
import { PlaceSymbol } from './renderer/glyphs'
import { BaseLayer } from './renderer/BaseLayer'
import { LabelLayer } from './renderer/LabelLayer'
import { useLabelLayout } from './renderer/useLabelLayout'
import { useMapCamera } from './renderer/useMapCamera'
import { attachGestures } from './renderer/gestures'
import type { AtlasMapHandle, AtlasMapProps, MapPin, MapTarget } from './renderer/types'
export type { AtlasMapHandle, AtlasMapProps, MapPin, MapTarget, MapInsets, Highlight, Plate, Tone } from './renderer/types'
export { TONES } from './renderer/palette'
const NO_STATES: Set<string> = new Set()
const r2 = (v: number) => Math.round(v * 100) / 100
/**
 * Stands the map down while its screen is behind another, and wakes it on
 * return. A component of its own so that reading the screen's state re-renders
 * this, not the map.
 */
function Sleep({ onChange }: { onChange: (active: boolean) => void }) {
  const active = useScreenActive()
  useEffect(() => onChange(active), [active, onChange])
  return null
}

/**
 * While the Atlas is kept behind another screen its map is not re-rendered at
 * all: a change of theme, or new progress when a session ends, would otherwise
 * repaint the whole vector map out of sight (about a second of main-thread
 * work, felt on whatever screen is in front). The screen sets this as it
 * leaves and returns (AtlasScreen.tsx), and re-renders on return so that
 * whatever changed meanwhile is taken up then.
 */
let awake = true
export function setAtlasMapAwake(value: boolean) {
  awake = value
}
const sameProps = (a: AtlasMapProps, b: AtlasMapProps) => {
  if (!awake) return true
  const keys = Object.keys(b) as Array<keyof AtlasMapProps>
  if (keys.length !== Object.keys(a).length) return false
  for (const key of keys) if (!Object.is(a[key], b[key])) return false
  return true
}

/** Memoised: the map only renders when its drawing props change. */
export const AtlasMap = memo(
  forwardRef<AtlasMapHandle, AtlasMapProps>(function AtlasMap(props, ref) {
    const { sheet, onSelect } = props
    const uid = useId().replace(/[^a-z0-9]/gi, '')
    const camera = useMapCamera(props, ref)
    const {
      container,
      basePort,
      labelPort,
      labelLayer,
      decorLayer,
      pinLayer,
      overlayLayer,
      overlayG,
      t,
      kFit,
      size,
      layoutT,
      namePositions,
      onActive,
      animateTo,
      cancelAnim,
      clampT,
      limits,
      nextFrame,
      setT,
      settle,
      softK,
    } = camera
    // Spatial indexes: built when the data changes, not on every layout.
    const placeIndex = useMemo(() => new GridIndex(props.places, (p) => [p.x, p.y, p.x, p.y], sheet.width, sheet.height), [props.places, sheet])
    const labelIndex = useMemo(() => labelIndexFor(sheet.labels, sheet.width, sheet.height), [sheet])
    const riversById = useMemo(() => new Map(sheet.rivers.map((r) => [`river:${r.id}`, r])), [sheet])
    /** Outlines smallest first, so a tap inside nested areas opens the innermost. */
    const areasBySize = useMemo(() => [...sheet.areas].sort((a, b) => (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]) - (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1])), [sheet])
    /** Sheet features whose own name already labels a place, so the place needs no symbol. */
    const labelled = useMemo(() => new Set(sheet.labels.map(labelKeyOf)), [sheet])
    const discovered = props.discovered
    const known = useCallback((id: string) => !discovered || discovered.has(id), [discovered])
    /** The symbols drawn at the last layout: taps and hovers only find what is on screen. */
    const drawn = useRef<Place[]>([])

    /** The drawn symbol nearest (wx, wy) sheet px, within a finger's reach. */
    const symbolAt = (wx: number, wy: number): string | null => {
      const k = t.current.k
      let best: Place | null = null
      let bestD = 18 / k
      for (const p of drawn.current) {
        const d = Math.hypot(p.x - wx, p.y - wy)
        if (d < bestD) {
          bestD = d
          best = p
        }
      }
      return best?.id ?? null
    }
    const symbolRef = useRef(symbolAt)
    symbolRef.current = (wx, wy) => (props.showPlaces === false ? null : symbolAt(wx, wy))

    /** The place a tap or hover at (wx, wy) sheet px points at: a symbol, a name, a course or an outline. */
    const placeAt = (wx: number, wy: number): string | null => {
      const k = t.current.k
      const sym = symbolAt(wx, wy)
      if (sym) return sym
      const features = props.featurePlaces ?? props.linkedLabels ?? new Map<string, string>()
      // Named features (ranges, seas, lakes…) by their name.
      const near = 34 / k
      for (const l of labelIndex.query([wx - near, wy - near, wx + near, wy + near])) {
        if (l.kind === 'river' || l.x === undefined || l.y === undefined) continue
        const placeId = features.get(labelKeyOf(l))
        if (placeId && Math.hypot(l.x - wx, l.y - wy) < near) return placeId
      }
      // Rivers along their course.
      for (const [key, placeId] of features) {
        if (!key.startsWith('river:')) continue
        const r = riversById.get(key)
        if (r && distanceToLines([wx, wy], r.coords) < 7 / k) return placeId
      }
      // Inside a drawn outline (a park, a wetland, a disputed region).
      const near2 = container.current?.classList.contains('atlas-near')
      for (const a of areasBySize) {
        if (a.kind === 'land' || (a.kind === 'park' && !(props.showAreas && near2)) || (a.kind === 'region' && !props.showAreas)) continue
        if (wx < a.bbox[0] || wx > a.bbox[2] || wy < a.bbox[1] || wy > a.bbox[3]) continue
        const placeId = features.get(`area:${a.id}`)
        if (placeId && pointInGeometry([wx, wy], a.geometry)) return placeId
      }
      return null
    }

    // Tap → a pin, else a place, else the state/country under the finger.
    const tapRef = useRef<(x: number, y: number) => MapTarget>(() => ({ type: 'point', x: 0, y: 0 }))
    tapRef.current = (wx: number, wy: number): MapTarget => {
      const k = t.current.k
      if (props.pins?.length) {
        let best: MapPin | null = null
        let bestD = 26 / k
        for (const p of props.pins) {
          const d = Math.hypot(p.x - wx, p.y - wy)
          if (d < bestD) {
            bestD = d
            best = p
          }
        }
        if (best) return { type: 'pin', id: best.id }
      }
      if (props.showPlaces !== false) {
        const id = placeAt(wx, wy)
        if (id) return { type: 'place', id }
      }
      const st = featureAt(sheet.states, [wx, wy])
      if (st) return { type: 'state', id: st.id }
      const c = featureAt(sheet.countries, [wx, wy])
      if (c) return { type: 'country', id: c.id }
      return { type: 'point', x: wx, y: wy }
    }
    const selectRef = useRef(onSelect)
    selectRef.current = onSelect
    const instantRef = useRef(props.instantSelect)
    instantRef.current = props.instantSelect

    // Hover (mouse): a pointer cursor and a lifted symbol over anything a click would open.
    const hovered = useRef<string | null>(null)
    const hoverRef = useRef<(sx: number, sy: number) => void>(() => {})
    hoverRef.current = (sx: number, sy: number) => {
      const el = container.current
      if (!el || props.showPlaces === false) return
      const cur = t.current
      const id = Number.isNaN(sx) ? null : placeAt((sx - cur.x) / cur.k, (sy - cur.y) / cur.k)
      if (id === hovered.current) return
      const layer = labelLayer.current
      if (hovered.current) layer?.querySelector(`[data-place="${CSS.escape(hovered.current)}"]`)?.classList.remove('is-hover')
      hovered.current = id
      if (id) layer?.querySelector(`[data-place="${CSS.escape(id)}"]`)?.classList.add('is-hover')
      el.style.cursor = id ? 'pointer' : ''
    }

    // Only camera callbacks change the listener lifetime; hit-test callbacks use stable refs.
    useEffect(() => {
      const el = container.current
      if (!el) return
      return attachGestures(el, camera, { symbolRef, tapRef, selectRef, instantRef, hoverRef })
    }, [animateTo, cancelAnim, clampT, limits, nextFrame, setT, settle, softK]) // eslint-disable-line react-hooks/exhaustive-deps

    // ── derived drawing data (recomputed only when the view settles) ────────
    const colours = useMemo(() => {
      const ids = sheet.states.length ? sheet.states.map((s) => s.id) : sheet.countries.map((c) => c.id)
      return colourAssignment(ids, sheet.stateNeighbours.size ? sheet.stateNeighbours : worldNeighbours(sheet))
    }, [sheet])

    /**
     * Which place symbols to draw at this zoom: capitals always, then more detail
     * as you zoom in, thinned so symbols never crowd. Discovered places come
     * first; places not yet discovered are drawn muted and a little later.
     * Places the base map already names (rivers, ranges, seas…) show through
     * that name instead.
     */
    const visible = useMemo<Place[]>(() => {
      if (!layoutT || props.showPlaces === false) return []
      const z = layoutT.k / kFit.current
      const { w, h, o } = layoutT
      const kinds = props.kinds
      const minZ = (p: Place) => (p.kind === 'capital' ? (p.tags?.includes('national') || p.level === 1 ? 0 : 1.4) : p.level === 1 ? 1.3 : p.level === 2 ? 2 : 2.9)
      const prio = (p: Place) =>
        (p.id === props.selectedId ? 1000 : 0) +
        (props.pyqPlaceIds?.has(p.id) ? 80 : 0) +
        (props.newIds?.has(p.id) ? 500 : 0) +
        (known(p.id) ? 200 : 0) +
        (p.kind === 'capital' ? 60 : 0) +
        (4 - p.level) * 20 +
        (p.yield?.score ?? 0) / 5
      const cand = placeIndex
        .query(viewRect(layoutT, w, h, 20 + o))
        .filter((p) => {
          if (p.id === props.selectedId || props.newIds?.has(p.id)) return true
          if (kinds && !kinds.has(p.kind)) return false
          const isKnown = known(p.id)
          if (!isKnown && !props.showUndiscovered) return false
          if (p.geom && labelled.has(p.geom) && !props.pyqPlaceIds?.has(p.id)) return false
          return z >= (props.pyqPlaceIds?.has(p.id) ? 0.9 : minZ(p) + (isKnown ? 0 : 0.35))
        })
        .map((p) => ({ p, sx: p.x * layoutT.k + layoutT.x, sy: p.y * layoutT.k + layoutT.y }))
        .filter(({ sx, sy }) => sx > -20 - o && sx < w + 20 + o && sy > -20 - o && sy < h + 20 + o)
        .sort((a, b) => prio(b.p) - prio(a.p))
      const taken: Array<[number, number]> = []
      const out: Place[] = []
      for (const c of cand) {
        if (taken.some(([x, y]) => Math.abs(x - c.sx) < 13 && Math.abs(y - c.sy) < 13) && c.p.id !== props.selectedId) continue
        taken.push([c.sx, c.sy])
        out.push(c.p)
      }
      return out
    }, [layoutT, kFit, placeIndex, props.showPlaces, props.selectedId, props.newIds, props.kinds, props.showUndiscovered, props.pyqPlaceIds, known, labelled])

    const labelInput = useMemo<LayoutInput | null>(() => {
      if (!layoutT) return null
      const symbols: PlacedSymbol[] = visible.map((p) => ({
        place: { id: p.id, name: p.name, kind: p.kind, level: p.level, elevation: p.elevation },
        x: p.x * layoutT.k + layoutT.x,
        y: p.y * layoutT.k + layoutT.y,
        mastery: props.mastery?.(p.id) ?? 'discovered',
        isNew: props.newIds?.has(p.id) ?? false,
        selected: props.selectedId === p.id,
        muted: !known(p.id),
      }))
      return {
        labels: sheet.labels,
        index: labelIndex,
        places: symbols,
        t: layoutT,
        kFit: kFit.current,
        width: layoutT.w,
        height: layoutT.h,
        mutedIds: props.mutedLabels ?? new Set(),
        linked: props.linkedLabels ?? new Map(),
        foggedStates: NO_STATES,
        selectedId: props.selectedId,
        sheetId: sheet.id,
        hidden: props.hiddenLabels,
        overscan: layoutT.o,
        prefer: namePositions.current,
      }
    }, [layoutT, kFit, namePositions, visible, labelIndex, props.mastery, props.newIds, props.selectedId, props.mutedLabels, props.linkedLabels, props.hiddenLabels, sheet, known])
    const { labels, layout: labelLayout, symbolIds } = useLabelLayout(sheet, labelInput, layoutT, namePositions, props.tone ?? 'day')

    const placeById = useMemo(() => new Map(props.places.map((p) => [p.id, p])), [props.places])
    const shown = useMemo(
      () =>
        symbolIds.flatMap((id) => {
          const p = placeById.get(id)
          return p ? [p] : []
        }),
      [symbolIds, placeById],
    )
    drawn.current = shown
    const symbols = useMemo(() => {
      if (!labelLayout) return []
      return shown.map((p) => ({ p, x: r2(p.x * labelLayout.k + labelLayout.fx), y: r2(p.y * labelLayout.k + labelLayout.fy), muted: !known(p.id) }))
    }, [labelLayout, shown, known])
    // The camera can request a layout before the worker commits it. Keep retained symbols in their own frame.
    const symbolScale = layoutT && labelLayout ? layoutT.k / labelLayout.k : 1
    const symbolTransform =
      layoutT && labelLayout ? 'translate(' + (layoutT.fx - labelLayout.fx * symbolScale) + ',' + (layoutT.fy - labelLayout.fy * symbolScale) + ') scale(' + symbolScale + ')' : undefined

    const livingScreen = useMemo(() => {
      const lw = props.living
      if (!layoutT || !lw) return null
      const S = (x: number, y: number) => [r2(x * layoutT.k + layoutT.fx), r2(y * layoutT.k + layoutT.fy)] as const
      const { w, h, o } = layoutT
      // Frame coordinates differ from the view's by the pan since the frame was set.
      const dx = layoutT.fx - layoutT.x
      const dy = layoutT.fy - layoutT.y
      const onScreen = (x: number, y: number) => x - dx > -30 - o && x - dx < w + 30 + o && y - dy > -30 - o && y - dy < h + 30 + o
      const z = layoutT.k / kFit.current
      return {
        routes: lw.routes.map((r) => ({
          r,
          d:
            'M' +
            r.points
              .map(([x, y]) =>
                S(x, y)
                  .map((v) => v.toFixed(1))
                  .join(','),
              )
              .join('L'),
        })),
        ships: lw.ships.map((sh) => ({ ...sh, s: S(sh.x, sh.y) })).filter(({ s }) => onScreen(s[0], s[1])),
        wildlife: z >= 1.2 ? lw.wildlife.map((a) => ({ ...a, s: S(a.x, a.y) })).filter(({ s }) => onScreen(s[0], s[1])) : [],
      }
    }, [layoutT, kFit, props.living])

    const pinScreen = useMemo(() => {
      if (!layoutT || !props.pins) return []
      return props.pins.map((p) => ({ ...p, sx: r2(p.x * layoutT.k + layoutT.fx), sy: r2(p.y * layoutT.k + layoutT.fy) }))
    }, [layoutT, props.pins])

    const highlightScreen = useMemo(() => {
      if (!layoutT) return []
      return (props.highlights ?? []).filter((h) => h.kind === 'point' && h.x !== undefined).map((h) => ({ ...h, sx: r2(h.x! * layoutT.k + layoutT.fx), sy: r2(h.y! * layoutT.k + layoutT.fy) }))
    }, [layoutT, props.highlights])

    /**
     * The laid-out area in the frame's coordinates. The names layer has no box of
     * its own to clip to (its coordinates stay put while the map is panned), so
     * anything that can reach far beyond the view – a route across the whole
     * sheet, a pin elsewhere – is drawn inside a nested <svg> of this size.
     * Unclipped, one long line makes the layer as large as the sheet, and every
     * small change to it rasterises all of that.
     */
    const area = useMemo(() => {
      if (!layoutT) return null
      const pad = layoutT.o + 60
      const x = Math.round(layoutT.fx - layoutT.x - pad)
      const y = Math.round(layoutT.fy - layoutT.y - pad)
      const width = Math.round(layoutT.w + 2 * pad)
      const height = Math.round(layoutT.h + 2 * pad)
      return { x, y, width, height, viewBox: `${x} ${y} ${width} ${height}`, overflow: 'hidden' as const, has: (px: number, py: number) => px >= x && py >= y && px <= x + width && py <= y + height }
    }, [layoutT])
    const clip = area ? { x: area.x, y: area.y, width: area.width, height: area.height, viewBox: area.viewBox, overflow: area.overflow } : null

    const toneId = props.tone ?? 'day'
    const tileStyle = useMemo(
      () => ({ plate: props.plate, tone: toneId, colours: [...colours] as Array<[string, string]>, explored: props.explored ? [...props.explored] : null, showAreas: props.showAreas ?? false }),
      [props.plate, toneId, colours, props.explored, props.showAreas],
    )
    const tone = TONES[toneId]
    const calm = useMemo(() => lowPowerDevice(), [])
    const ids = { clip: `sheet-clip-${uid}`, glow: `city-glow-${uid}` }
    return (
      <div
        ref={container}
        className={cn('atlas relative size-full touch-none overflow-hidden outline-none select-none', calm && 'atlas-calm', props.className)}
        style={{ background: tone.paper, contain: 'layout paint' }}
        role="application"
        aria-label={`${sheet.title} map. Drag to pan, scroll or pinch to zoom, arrow keys to move, plus and minus to zoom.`}
        tabIndex={0}
      >
        <Sleep onChange={onActive} />
        <BaseLayer
          sheet={sheet}
          style={tileStyle}
          port={basePort}
          initial={() => ({ view: t.current, width: size.current.w, height: size.current.h, rest: true, near: container.current?.classList.contains('atlas-near') ?? false })}
        />
        <svg className="absolute size-0" aria-hidden="true">
          <defs>
            <clipPath id={ids.clip}>
              <rect width={sheet.width} height={sheet.height} />
            </clipPath>
          </defs>
        </svg>

        {/* What is selected or asked about: a layer of its own, a handful of paths, so choosing a place costs the base map nothing. */}
        <div ref={overlayLayer} className="atlas-layer" aria-hidden="true">
          <svg className="absolute inset-0 size-full">
            <g ref={overlayG}>
              <g clipPath={`url(#${ids.clip})`}>
                <Highlights sheet={sheet} highlights={props.highlights} />
              </g>
            </g>
          </svg>
        </div>

        {/* Screen-space layer: route, symbols, names – laid out when the view settles. */}
        <div
          ref={(node) => {
            decorLayer.current = node
            labelLayer.current = node
          }}
          className="atlas-labels"
          aria-hidden="true"
        >
          <svg className="absolute inset-0 size-full overflow-visible">
            <defs>
              <radialGradient id={ids.glow}>
                <stop offset="0%" stopColor="#ffd98a" stopOpacity={0.85} />
                <stop offset="100%" stopColor="#ffd98a" stopOpacity={0} />
              </radialGradient>
            </defs>
            {livingScreen && clip && (
              <svg {...clip}>
                {livingScreen.routes.map(({ r, d }) => (
                  <RoutePath key={r.id} route={r} d={d} />
                ))}
              </svg>
            )}
            {livingScreen && (
              <g>
                {livingScreen.wildlife.map((a) => (
                  <g key={a.id} transform={`translate(${a.s[0] + 16},${a.s[1] + 14})`}>
                    <title>{`${a.name}: ${a.species.replace('-', ' ')}`}</title>
                    <Animal species={a.species} />
                  </g>
                ))}
              </g>
            )}
            <g transform={symbolTransform}>
              {symbols.map(({ p, x, y, muted }) => (
                <g key={p.id} transform={`translate(${x},${y})`}>
                  <PlaceSymbol
                    place={p}
                    studied={!!discovered && !muted}
                    pyq={props.pyqPlaceIds?.has(p.id)}
                    selected={props.selectedId === p.id}
                    mastery={props.mastery?.(p.id) ?? 'discovered'}
                    glowId={toneId === 'night' && props.living?.lights.has(p.id) ? ids.glow : undefined}
                  />
                </g>
              ))}
            </g>{' '}
          </svg>
          {/* Motion as HTML on compositor layers: animating these never repaints the names. */}
          {symbols.map(
            ({ p, x, y }) =>
              props.newIds?.has(p.id) && (
                <span
                  key={p.id}
                  className="atlas-ring"
                  style={{
                    left: x * symbolScale + (layoutT?.fx ?? 0) - (labelLayout?.fx ?? 0) * symbolScale,
                    top: y * symbolScale + (layoutT?.fy ?? 0) - (labelLayout?.fy ?? 0) * symbolScale,
                    color: HIGHLIGHT,
                  }}
                />
              ),
          )}
          {livingScreen?.ships.map((sh) => {
            const angle = Math.atan2(sh.dy, sh.dx)
            return (
              <span key={sh.id} className="atlas-ship-at" style={{ left: sh.s[0] + sh.dx * 16, top: sh.s[1] + sh.dy * 16, transform: `rotate(${angle}rad)` }}>
                <span className="atlas-ship">
                  <svg width={20} height={20} viewBox="-10 -10 20 20" style={{ transform: `rotate(${-angle}rad)` }}>
                    <ShipGlyph />
                  </svg>
                </span>
              </span>
            )
          })}
        </div>
        <LabelLayer labels={labels} layout={labelLayout ?? layoutT} tone={toneId} sheet={sheet} places={props.places} port={labelPort} current={() => t.current} />
        <div ref={pinLayer} className="atlas-labels" aria-hidden="true">
          <svg className="absolute inset-0 size-full overflow-visible">
            <svg {...(clip ?? {})}>
              {pinScreen.map((p) => {
                const c = p.tone === 'correct' ? '#2e8b57' : p.tone === 'wrong' ? '#c1121f' : p.tone === 'muted' ? '#8a8a8a' : HIGHLIGHT
                return (
                  <g key={p.id} transform={`translate(${p.sx},${p.sy})`}>
                    <path d="M0,0 C-3,-7 -11,-11 -11,-20 A11,11 0 1 1 11,-20 C11,-11 3,-7 0,0Z" fill={c} stroke="#fff" strokeWidth={2} />
                    {p.label && (
                      <text y={-16} textAnchor="middle" fill="#fff" fontFamily={FONT_SANS} fontWeight={800} fontSize={12}>
                        {p.label}
                      </text>
                    )}
                  </g>
                )
              })}
              {highlightScreen.map((h, i) => (
                <g key={i} transform={`translate(${h.sx},${h.sy})`}>
                  <circle r={14} fill="none" stroke={h.tone === 'wrong' ? '#c1121f' : h.tone === 'correct' ? '#2e8b57' : HIGHLIGHT} strokeWidth={3} />
                  <circle r={3} fill={h.tone === 'wrong' ? '#c1121f' : h.tone === 'correct' ? '#2e8b57' : HIGHLIGHT} />
                </g>
              ))}
            </svg>
          </svg>
        </div>
        {props.children}
      </div>
    )
  }),
  sameProps,
)

function worldNeighbours(sheet: Sheet): Map<string, string[]> {
  // Approximate adjacency for colouring: bounding boxes that touch.
  const m = new Map<string, string[]>()
  for (const a of sheet.countries) {
    m.set(
      a.id,
      sheet.countries.filter((b) => b.id !== a.id && a.bbox[0] <= b.bbox[2] + 2 && a.bbox[2] >= b.bbox[0] - 2 && a.bbox[1] <= b.bbox[3] + 2 && a.bbox[3] >= b.bbox[1] - 2).map((b) => b.id),
    )
  }
  return m
}
