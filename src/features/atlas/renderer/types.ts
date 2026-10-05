/** The public Atlas map contract and settled label frame, shared by renderer modules. */
import type { ReactNode } from 'react'
import type { Sheet } from '@/atlas/sheet'
import type { LivingWorld } from '@/atlas/living'
import type { Place, PlaceKind } from '@/atlas/types'
import type { MasteryLevel } from '../style'
import type { Transform } from '../labels'
export type Plate = 'physical' | 'political'
/** `dusk` is the physical plate for the dark theme: the same relief, dimmed, with light lettering. */
export type Tone = 'day' | 'dusk' | 'night' | 'antique'

export type MapTarget =
  | { type: 'place'; id: string }
  | { type: 'state'; id: string }
  | { type: 'country'; id: string }
  | { type: 'point'; x: number; y: number }
  | { type: 'pin'; id: string }

export interface MapPin {
  id: string
  x: number
  y: number
  label?: string
  tone?: 'accent' | 'correct' | 'wrong' | 'muted'
}

export interface Highlight {
  /** Outline a state/country, or glow a river/region/sea shape. */
  kind: 'state' | 'country' | 'river' | 'region' | 'marine' | 'lake' | 'area' | 'point'
  id?: string
  x?: number
  y?: number
  tone?: 'accent' | 'correct' | 'wrong'
}

/** Screen space covered by overlays (px from each edge of the map). */
export interface MapInsets {
  top?: number
  bottom?: number
  left?: number
  right?: number
}

export interface AtlasMapHandle {
  /** Fly to a point (sheet px) at `zoom` × the fitted scale, centred in the part of the map not covered by `insets`. */
  flyTo: (x: number, y: number, zoom?: number, insets?: MapInsets) => void
  /** Pan just far enough that a point (sheet px) is clear of `insets`; does nothing when it already is. The zoom is kept. */
  reveal: (x: number, y: number, insets?: MapInsets) => void
  fitFocus: () => void
  zoomBy: (f: number) => void
}

export interface AtlasMapProps {
  sheet: Sheet
  plate: Plate
  tone?: Tone
  /** Lettered pins (recall questions). Tapping one selects `{ type: 'pin' }`. */
  pins?: MapPin[]
  /** State/country ids that are explored. `null` = everything explored. */
  explored: Set<string> | null
  places: Place[]
  mastery?: (id: string) => MasteryLevel
  newIds?: Set<string>
  pyqPlaceIds?: ReadonlySet<string> | null
  selectedId?: string
  highlights?: Highlight[]
  /** Sheet labels to render muted (their place isn't discovered yet), keyed like `river:ganges`. */
  mutedLabels?: Set<string>
  /** Discovered places linked to sheet features (`river:ganges` → place id). */
  linkedLabels?: Map<string, string>
  /** Sheet labels to hide entirely. */
  hiddenLabels?: Set<string>
  onSelect?: (target: MapTarget) => void
  /** Show place symbols (off during "locate" questions). */
  showPlaces?: boolean
  className?: string
  children?: ReactNode
  initialFocus?: [number, number, number, number]
  /** Routes, ships and wildlife driven by recall mastery. */
  living?: LivingWorld | null
  /** Screen space covered by overlays, kept clear when fitting (px). */
  insets?: MapInsets
  /** Places that are discovered; the rest are drawn muted. Omit to draw every place as discovered. */
  discovered?: ReadonlySet<string> | ReadonlyMap<string, unknown>
  /** Draw places not yet discovered (muted). */
  showUndiscovered?: boolean
  /** Only these kinds of place (null or omitted: all). */
  kinds?: ReadonlySet<PlaceKind> | null
  /**
   * A tap on a place selects it at once. Leave it off where selecting opens something modal over the map:
   * there a tap waits a moment, so that a double tap on a place can still zoom.
   */
  instantSelect?: boolean
  /** Draw overlay outlines (protected areas, disputed regions). Lakes and wetlands are always drawn. */
  showAreas?: boolean
  /** Sheet feature key (`river:…`, `area:…`, `region:…`) → place id, for every place: tapping a name, course or outline opens it. */
  featurePlaces?: Map<string, string>
}

export interface Layout extends Transform {
  w: number
  h: number
  /** Names are laid out this far beyond the view on every side. */
  o: number
  /** Frame origin: a sheet point p is drawn at p·k + (fx, fy). */
  fx: number
  fy: number
}
