/** The unchanged sheet-space SVG reference layers: base and highlights. */
import { memo, useCallback, useMemo } from 'react'
import type { AreaFeature, MapFeature, Sheet } from '@/atlas/sheet'
import { HIGHLIGHT, POLITICAL } from '../style'
import { TONES } from './palette'
import type { Highlight, Plate, Tone } from './types'
const RIVER_WIDTH: Record<number, number> = { 1: 2.2, 2: 1.6, 3: 1.2, 4: 0.85 }
const ns = { vectorEffect: 'non-scaling-stroke' as const }

/** Group features that share a style into one path each: a few dozen nodes to paint instead of hundreds. */
function joinBy<T>(items: readonly T[], key: (item: T) => string | undefined, d: (item: T) => string): Array<[string, string]> {
  const m = new Map<string, string[]>()
  for (const it of items) {
    const k = key(it)
    if (k === undefined) continue
    const list = m.get(k)
    if (list) list.push(d(it))
    else m.set(k, [d(it)])
  }
  return [...m].map(([k, ds]) => [k, ds.join('')])
}

const riverRanks = new WeakMap<Sheet, Array<[string, string]>>()
const lakeGroups = new WeakMap<Sheet, Array<[string, string]>>()
const areaGroups = new WeakMap<Sheet, Record<AreaFeature['kind'], string>>()

/** Everything drawn in sheet coordinates. Memoised: only re-renders when data changes, and only repaints when the view settles. */
export const BaseMap = memo(function BaseMap({ sheet, plate, tone: toneId, colours, explored, showAreas }: { sheet: Sheet; plate: Plate; tone: Tone; colours: Map<string, string>; explored: Set<string> | null; showAreas: boolean }) {
  const isIndia = sheet.states.length > 0
  const tone = TONES[toneId]
  // The night chart is always drawn in flat colours.
  const physical = plate === 'physical' && !tone.political
  const fill = useCallback(
    (id: string) => {
      const c = colours.get(id)
      if (!c || !tone.political) return c
      return tone.political[POLITICAL.indexOf(c) % tone.political.length] ?? tone.political[0]
    },
    [colours, tone],
  )
  const fills = useMemo(() => {
    if (physical) return null
    return {
      countries: joinBy(sheet.countries, (c) => (isIndia ? tone.neighbour : (fill(c.id) ?? tone.neighbour)), (c) => c.d),
      states: joinBy(sheet.states, (s) => fill(s.id) ?? '#eee', (s) => s.d),
    }
  }, [physical, sheet, isIndia, tone, fill])
  const rivers = useMemo(() => {
    let r = riverRanks.get(sheet)
    if (!r) riverRanks.set(sheet, (r = joinBy(sheet.rivers, (x) => String(RIVER_WIDTH[x.rank] ?? 0.85), (x) => x.d)))
    return r
  }, [sheet])
  const lakes = useMemo(() => {
    let l = lakeGroups.get(sheet)
    // Only lakes big enough to read get an outline; tiny ones stay a quiet fill.
    if (!l) lakeGroups.set(sheet, (l = joinBy(sheet.lakes, (x) => (Math.max(x.bbox[2] - x.bbox[0], x.bbox[3] - x.bbox[1]) > (isIndia ? 10 : 6) ? 'big' : 'small'), (x) => x.d)))
    return l
  }, [sheet, isIndia])
  const areas = useMemo(() => {
    let a = areaGroups.get(sheet)
    if (!a) {
      a = { park: '', water: '', region: '', land: '' }
      for (const f of sheet.areas) a[f.kind] += f.d
      areaGroups.set(sheet, a)
    }
    return a
  }, [sheet])
  /** States (India) or countries (World) the learner has studied. With no travel record (`null`) nothing is marked. */
  const studied = useMemo(() => {
    const units: MapFeature[] = isIndia ? sheet.states : sheet.countries
    return explored ? units.filter((u) => explored.has(u.id)).map((u) => u.d).join('') : ''
  }, [sheet, isIndia, explored])

  return (
    <g>
      {physical ? (
        <image href={sheet.reliefUrl} width={sheet.width} height={sheet.height} preserveAspectRatio="none" style={tone.imageFilter ? { filter: tone.imageFilter } : undefined} />
      ) : (
        <>
          <rect width={sheet.width} height={sheet.height} fill={tone.sea} />
          {fills!.countries.map(([c, d]) => (
            <path key={c} d={d} fill={c} />
          ))}
          {fills!.states.map(([c, d]) => (
            <path key={c} d={d} fill={c} />
          ))}
          <image href={sheet.shadeUrl} width={sheet.width} height={sheet.height} preserveAspectRatio="none" style={{ mixBlendMode: tone.political ? 'soft-light' : 'multiply' }} opacity={tone.political ? 0.55 : 0.22} />
        </>
      )}

      {/* Rivers and lakes */}
      <g fill="none" stroke={tone.river} strokeLinecap="round" strokeLinejoin="round">
        {rivers.map(([w, d]) => (
          <path key={w} d={d} strokeWidth={Number(w)} {...ns} />
        ))}
      </g>
      {lakes.map(([size, d]) => (
        <path key={size} d={d} fill={tone.lake} stroke={size === 'big' ? tone.lakeStroke : 'none'} strokeWidth={0.7} {...ns} />
      ))}
      {/* Overlay outlines: lakes and wetlands always; protected areas close up; disputed regions. */}
      {areas.water && <path d={areas.water} fill={tone.lake} stroke={tone.lakeStroke} strokeWidth={0.6} {...ns} />}
      {showAreas && areas.park && (
        <g className="atlas-parks">
          <path d={areas.park} fill={tone.park} fillOpacity={0.16} stroke={tone.parkLine} strokeWidth={0.9} strokeDasharray="3 2" strokeOpacity={0.85} {...ns} />
        </g>
      )}

      {/* Studied areas: a faint warm wash. The rest of the map is never veiled, greyed or hatched. */}
      {studied && <path d={studied} fill={tone.studied} fillOpacity={physical ? 0.07 : 0.1} />}

      <path d={sheet.lines.graticule} fill="none" stroke={tone.graticule} strokeWidth={0.6} opacity={0.45} {...ns} />

      {/* Coasts */}
      <path d={sheet.lines.coasts} fill="none" stroke={tone.coast} strokeWidth={0.9} {...ns} />
      {isIndia && <path d={sheet.lines.indiaCoast} fill="none" stroke={tone.indiaCoast} strokeWidth={1} {...ns} />}

      {/* State boundaries: fine dashed line. */}
      {isIndia && (
        <>
          <path d={sheet.lines.stateBorders} fill="none" stroke={tone.halo} strokeWidth={2.6} opacity={0.55} {...ns} />
          <path d={sheet.lines.stateBorders} fill="none" stroke={tone.stateBorder} strokeWidth={1.15} strokeDasharray="5 2.5" {...ns} />
        </>
      )}

      {/* …and a warm edge over the state boundaries. */}
      {studied && <path d={studied} fill="none" stroke={tone.studied} strokeWidth={1.7} strokeOpacity={0.8} strokeLinejoin="round" {...ns} />}

      {showAreas && areas.region && <path d={areas.region} fill={tone.dispute} fillOpacity={0.07} stroke={tone.dispute} strokeWidth={1.1} strokeDasharray="5 3" {...ns} />}

      {/* International boundaries: bold dash-dot, on a light halo. */}
      <path d={sheet.lines.intlBorders} fill="none" stroke={tone.halo} strokeWidth={isIndia ? 3.6 : 2.4} opacity={0.7} {...ns} />
      <path d={sheet.lines.intlBorders} fill="none" stroke={tone.border} strokeWidth={isIndia ? 1.6 : 0.9} strokeDasharray={isIndia ? '8 2.5 2 2.5' : '4 2'} {...ns} />
      {isIndia && (
        <>
          <path d={sheet.lines.indiaBorder} fill="none" stroke={tone.halo} strokeWidth={4.6} opacity={0.75} {...ns} />
          <path d={sheet.lines.indiaBorder} fill="none" stroke={tone.indiaBorder} strokeWidth={2.2} strokeDasharray="9 3 2.5 3" {...ns} />
        </>
      )}
    </g>
  )
})

/** Selected entities and question feedback share the existing sheet-space highlight layer. */
export const Highlights = memo(function Highlights({ sheet, highlights }: { sheet: Sheet; highlights?: Highlight[] }) {
  if (!highlights?.length) return null
  const colour = (h: Highlight) => (h.tone === 'correct' ? '#2e8b57' : h.tone === 'wrong' ? '#c1121f' : HIGHLIGHT)
  return (
    <g>
      {(highlights ?? []).map((h, i) => {
        const c = colour(h)
        if (h.kind === 'state' || h.kind === 'country') {
          const f = (h.kind === 'state' ? sheet.states : sheet.countries).find((x) => x.id === h.id)
          if (!f) return null
          return (
            <g key={i}>
              <path d={f.d} fill={c} opacity={0.14} />
              <path d={f.d} fill="none" stroke="#fff" strokeWidth={5} {...ns} />
              <path d={f.d} fill="none" stroke={c} strokeWidth={2.6} {...ns} />
            </g>
          )
        }
        if (h.kind === 'river') {
          const r = sheet.rivers.find((x) => x.id === h.id)
          if (!r) return null
          return (
            <g key={i} fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d={r.d} stroke="#fff" strokeWidth={7} {...ns} />
              <path d={r.d} stroke={c} strokeWidth={3.4} {...ns} />
            </g>
          )
        }
        if (h.kind === 'region' || h.kind === 'marine' || h.kind === 'lake' || h.kind === 'area') {
          const f = (h.kind === 'region' ? sheet.regions : h.kind === 'marine' ? sheet.marine : h.kind === 'area' ? sheet.areas : sheet.lakes).find((x) => x.id === h.id)
          if (!f) return null
          return (
            <g key={i}>
              <path d={f.d} fill={c} opacity={0.18} />
              <path d={f.d} fill="none" stroke={c} strokeWidth={2.2} strokeDasharray="6 3" {...ns} />
            </g>
          )
        }
        return null
      })}
    </g>
  )
})
