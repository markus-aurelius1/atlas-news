/** The existing map palettes, kept identical across the SVG reference and future tile renderer. */
import { INK, INK_SOFT, NEIGHBOUR_FILL, PHYSICAL, SEA_FLAT, STUDIED, WATER, WATER_LINE } from '../style'
import type { Tone } from './types'
interface TonePalette {
  /** The page around the map sheet. */
  paper: string
  neatline: string
  sea: string
  neighbour: string
  /** Studied states and countries: a warm edge and the faintest wash. Places not yet studied are drawn exactly like the rest of the map. */
  studied: string
  river: string
  lake: string
  lakeStroke: string
  coast: string
  indiaCoast: string
  border: string
  indiaBorder: string
  stateBorder: string
  halo: string
  graticule: string
  /** Protected areas: tint and edge. */
  park: string
  parkLine: string
  /** Disputed and conflict regions: edge. */
  dispute: string
  political?: string[]
  imageFilter?: string
  /** Multiplied over the relief after it is drawn (works without canvas filters, so it is identical in every engine). */
  reliefDim?: string
  text: { state: string; stateMuted: string; country: string; water: string; physical: string; place: string }
}

const DAY: TonePalette = {
  paper: 'var(--bg)',
  neatline: '#5f584c',
  sea: SEA_FLAT,
  neighbour: NEIGHBOUR_FILL,
  studied: STUDIED,
  river: WATER_LINE,
  lake: '#8ec3ea',
  lakeStroke: WATER,
  coast: '#2c5f8c',
  indiaCoast: '#2a6292',
  border: '#3d3833',
  indiaBorder: '#231f1b',
  stateBorder: '#4d4740',
  halo: '#fff',
  graticule: '#3f6f96',
  park: '#3f8f46',
  parkLine: '#2e6b33',
  dispute: '#8b1e3f',
  text: { state: INK, stateMuted: '#6b6a66', country: INK_SOFT, water: WATER, physical: PHYSICAL, place: INK },
}

export const TONES: Record<Tone, TonePalette> = {
  day: DAY,
  dusk: {
    ...DAY,
    paper: '#111215',
    neatline: '#3b3e46',
    reliefDim: '#666c7a',
    river: '#5f9fdc',
    lake: '#2f5f90',
    lakeStroke: '#6aa8e0',
    coast: '#8fb4d6',
    indiaCoast: '#a9c8e4',
    border: '#d8d2c6',
    indiaBorder: '#f1ece0',
    stateBorder: '#c9c3b6',
    halo: '#0d0e11',
    graticule: '#8fb4d6',
    park: '#5fae68',
    parkLine: '#8fd097',
    dispute: '#e58aa3',
    text: { state: '#f2efe6', stateMuted: '#9a978e', country: '#cfccc3', water: '#a5d0f7', physical: '#ebc8a2', place: '#f6f3ec' },
  },
  night: {
    ...DAY,
    paper: '#070d19',
    neatline: '#b8964c',
    sea: '#0c1930',
    neighbour: '#16243b',
    studied: '#f0cf7a',
    river: '#4f8fd0',
    lake: '#1d3f6a',
    lakeStroke: '#4f8fd0',
    coast: '#b8964c',
    indiaCoast: '#d9b45f',
    border: '#d2ad5a',
    indiaBorder: '#f0cf7a',
    stateBorder: '#a98a4a',
    halo: '#0c1930',
    graticule: '#b8964c',
    park: '#4f9a5a',
    parkLine: '#7cc187',
    dispute: '#e0708f',
    political: ['#1f3558', '#253d63', '#1b2f4f', '#2b4468', '#22385b', '#29416b', '#1e3354'],
    text: { state: '#f1d58a', stateMuted: '#8f8a78', country: '#c9c3b3', water: '#8cc2f2', physical: '#e4b98b', place: '#f3ead3' },
  },
  antique: {
    ...DAY,
    paper: '#e8dcc0',
    neatline: '#4d3b27',
    sea: '#d9d0b5',
    neighbour: '#efe4c8',
    studied: '#9a5b14',
    river: '#4d6f8a',
    lake: '#b9c4b4',
    lakeStroke: '#4d6f8a',
    coast: '#5e4a33',
    indiaCoast: '#4d3b27',
    border: '#3d2c1a',
    indiaBorder: '#2b1d10',
    stateBorder: '#5a4630',
    halo: '#f4ead3',
    graticule: '#8a7556',
    park: '#6b7d3a',
    parkLine: '#55632c',
    dispute: '#7a2233',
    imageFilter: 'sepia(0.72) saturate(0.7) contrast(1.06) brightness(1.03)',
    text: { state: '#3a2412', stateMuted: '#7a6a55', country: '#5b4430', water: '#2f4f6a', physical: '#6b3a17', place: '#2e1d0e' },
  },
}
