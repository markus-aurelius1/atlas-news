/**
 * Atlas types. Geographic data (sheets and places) is static and
 * versioned under public/atlas; user progress lives in IndexedDB and refers to
 * places only by their stable ids.
 */
import type { Topology } from 'topojson-specification'

export type SheetId = 'india' | 'world'

export type LabelKind =
  | 'state'
  | 'country'
  | 'river'
  | 'lake'
  | 'range'
  | 'plateau'
  | 'desert'
  | 'delta'
  | 'coast'
  | 'plain'
  | 'basin'
  | 'valley'
  | 'peninsula'
  | 'isthmus'
  | 'island'
  | 'gorge'
  | 'region'
  | 'ocean'
  | 'sea'
  | 'bay'
  | 'gulf'
  | 'strait'

export interface MapLabel {
  id: string
  kind: LabelKind
  name: string
  x?: number
  y?: number
  /** River labels follow this polyline. */
  path?: Array<[number, number]>
  size: number
  rank?: number
  radius?: number
  /** Short form used when the full name does not fit (states). */
  abbr?: string
}

export interface SheetFile {
  version: number
  sheet: SheetId
  title: string
  width: number
  height: number
  bbox: [number, number, number, number]
  topology: Topology
  shapes: Topology
  lines: Topology
  labels: MapLabel[]
}

export type PlaceKind =
  | 'state'
  | 'country'
  | 'capital'
  | 'city'
  | 'peak'
  | 'pass'
  | 'range'
  | 'glacier'
  | 'river'
  | 'confluence'
  | 'lake'
  | 'wetland'
  | 'park'
  | 'plateau'
  | 'desert'
  | 'plain'
  | 'valley'
  | 'coast'
  | 'delta'
  | 'island'
  | 'port'
  | 'dam'
  | 'waterfall'
  | 'cape'
  | 'strait'
  | 'gulf'
  | 'sea'
  | 'canal'
  | 'monument'
  | 'grassland'
  | 'volcano'
  | 'region'
  /** Borders, corridors, disputed and conflict areas. */
  | 'strategic'
  /** Defence, space and nuclear sites. */
  | 'facility'

/** A place in the gazetteer, as compiled by tools/atlas-build. */
export interface Place {
  id: string
  name: string
  aka?: string[]
  kind: PlaceKind
  sheet: SheetId
  /** Position on its sheet (pre-projected pixels). */
  x: number
  y: number
  lon: number
  lat: number
  /** Linked vector feature on the sheet, e.g. `river:ganga`, `region:thar-desert`, `area:kaziranga-national-park`. */
  geom?: string
  /** How the feature is drawn: a symbol at a point, a course (rivers, canals, boundaries) or an outline (parks, lakes, regions). */
  shape?: 'point' | 'line' | 'area'
  /** India: state/UT ids (source → mouth for rivers). World: ISO3 country codes. */
  states?: string[]
  countries?: string[]
  /** NCERT physiographic division (e.g. `the-himalaya`). */
  region?: string
  /** Fog unit the place lies in: a state id (India sheet) or ISO3 country code. */
  unit?: string
  facts: string[]
  rel?: PlaceRelations
  tags?: string[]
  /** 1 = core, 2 = standard, 3 = advanced. */
  level: 1 | 2 | 3
  elevation?: number
  /** Short descriptor shown under the name, e.g. "Mountain pass · 4,310 m". */
  subtitle?: string
  /** Where the place, its position and its facts come from. */
  sources?: SourceRef[]
  /** Wikidata item, the place's stable identity across sources. */
  wikidata?: string
  /**
   * Atlas data version that added the place (absent = version 1). Later places
   * join the free survey from that version's release on and count towards a
   * state's development only once discovered, so existing progress never shifts.
   */
  added?: number
  /** Previous-year question history, from the PYQ ledger (tools/atlas-build/content/pyq). */
  pyq?: PyqHistory
  /** Study priority built from past papers and the syllabus: a heuristic, not a prediction. */
  yield?: StudyPriority
}

export interface SourceRef {
  title: string
  /** A web link, or `pdf:<file>#p<page>` for a question paper (`pdf:<file>` with `pages` in PYQ history). */
  url: string
  /** PDF pages cited, when one source groups several pages of the same file. */
  pages?: number[]
}

export interface PyqHistory {
  /** Distinct questions that name this place. */
  count: number
  years: number[]
  exams: string[]
  topics: string[]
  sources: SourceRef[]
}

export type PriorityBand = 'core' | 'high' | 'medium' | 'low'

export interface StudyPriority {
  /** 0–100. */
  score: number
  band: PriorityBand
  /** Each part is 0–1; the score is their weighted sum (weights in `PlacesFile.yieldModel`). */
  parts: Record<'frequency' | 'recurrence' | 'recency' | 'importance' | 'density' | 'gap', number>
  /** Plain-language reasons, most important first. */
  reasons: string[]
}

export interface PlaceRelations {
  tributaryOf?: string
  bank?: 'left' | 'right'
  distributaryOf?: string
  flowsInto?: string
  onRiver?: string[]
  range?: string
  border?: string[]
  connects?: [string, string]
  source?: string
  within?: string
  near?: string[]
  famousFor?: string[]
}

export interface StateInfo {
  id: string
  name: string
  type: 'state' | 'ut'
  capital: string
  region: string
  fact: string
  neighbours: string[]
  borderCountries: string[]
  coastal: boolean
}

export interface RegionInfo {
  id: string
  name: string
}

export interface CountryInfo {
  id: string
  name: string
  iso: string
  continent: string
  neighbours: string[]
}

export interface PlacesFile {
  version: number
  places: Place[]
  states: StateInfo[]
  regions: RegionInfo[]
  countries: CountryInfo[]
  /** How study priorities were computed (present once the PYQ ledger has entries). */
  yieldModel?: { weights: Record<string, number>; note: string; refYear: number; recencyHalfLifeYears: number }
}
