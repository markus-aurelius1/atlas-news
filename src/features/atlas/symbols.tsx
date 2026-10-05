/**
 * Atlas point symbols, drawn at a fixed screen size around (0,0). Each has a
 * white outline so it reads on relief, water and political colours alike.
 */
import type { PlaceKind } from '@/atlas/types'
import { MASTERY_COLOUR, type MasteryLevel } from './style'

const HALO = { stroke: '#fff', strokeWidth: 2.4, paintOrder: 'stroke' as const, strokeLinejoin: 'round' as const }

export function Symbol({ kind, tags, national }: { kind: PlaceKind; tags?: string[]; national?: boolean }) {
  switch (kind) {
    case 'capital':
      return national ? (
        <g>
          <circle r={7} fill="#fff" />
          <path d="M0,-6 L1.6,-1.9 L6,-1.9 L2.4,0.8 L3.7,5.2 L0,2.6 L-3.7,5.2 L-2.4,0.8 L-6,-1.9 L-1.6,-1.9Z" fill="#c1121f" stroke="#fff" strokeWidth={0.6} />
        </g>
      ) : (
        <g>
          <circle r={5.2} fill="#fff" stroke="#161616" strokeWidth={1.6} />
          <circle r={2.2} fill="#161616" />
        </g>
      )
    case 'city':
      return <circle r={3.4} fill="#161616" stroke="#fff" strokeWidth={1.6} />
    case 'peak':
      return <path d="M0,-6.5 L6,4.5 L-6,4.5Z" fill="#5a2d0c" {...HALO} />
    case 'volcano':
      return <path d="M-6,4.5 L-1.8,-4.5 L1.8,-4.5 L6,4.5Z M-1.8,-4.5 L0,-7.5 L1.8,-4.5" fill="#b3261e" {...HALO} />
    case 'pass':
      return (
        <g fill="none" strokeLinecap="round">
          <path d="M-3.5,-6 Q-0.5,0 -3.5,6 M3.5,-6 Q0.5,0 3.5,6" stroke="#fff" strokeWidth={5} />
          <path d="M-3.5,-6 Q-0.5,0 -3.5,6 M3.5,-6 Q0.5,0 3.5,6" stroke="#b3261e" strokeWidth={2.2} />
        </g>
      )
    case 'glacier':
      return (
        <g>
          <path d="M0,-6.5 L6,4.5 L-6,4.5Z" fill="#eaf5ff" stroke="#fff" strokeWidth={2.6} strokeLinejoin="round" />
          <path d="M0,-6.5 L6,4.5 L-6,4.5Z M-3.2,-0.8 L3.2,-0.8" fill="none" stroke="#2f6fa8" strokeWidth={1.3} strokeLinejoin="round" />
        </g>
      )
    case 'lake':
      return <ellipse rx={6} ry={4} fill="#8ec3ea" stroke={WATER_STROKE} strokeWidth={1.3} {...{ paintOrder: 'stroke' }} />
    case 'wetland':
      return (
        <g>
          <ellipse rx={7} ry={5} fill="#fff" />
          <path d="M-5,2.5 Q-2.5,0.8 0,2.5 T5,2.5" fill="none" stroke={WATER_STROKE} strokeWidth={1.4} />
          <path d="M-3,0.5 V-4 M0,0 V-5 M3,0.5 V-4" stroke="#2e7d32" strokeWidth={1.4} strokeLinecap="round" />
        </g>
      )
    case 'river':
    case 'confluence':
      return (
        <g>
          <circle r={6} fill="#fff" />
          {kind === 'confluence' ? (
            <path d="M-4,-4.5 L0,0 L4,-4.5 M0,0 V5" fill="none" stroke={WATER_STROKE} strokeWidth={1.8} strokeLinecap="round" />
          ) : (
            <path d="M-4.5,-1.5 Q-2.2,-3.5 0,-1.5 T4.5,-1.5 M-4.5,2 Q-2.2,0 0,2 T4.5,2" fill="none" stroke={WATER_STROKE} strokeWidth={1.5} />
          )}
        </g>
      )
    case 'waterfall':
      return (
        <g>
          <circle r={6} fill="#fff" />
          <path d="M-2.5,-5 V3 M0,-5 V5 M2.5,-5 V3" stroke={WATER_STROKE} strokeWidth={1.6} strokeLinecap="round" />
        </g>
      )
    case 'park': {
      const tiger = tags?.includes('tiger-reserve')
      return (
        <g>
          <rect x={-6.5} y={-6.5} width={13} height={13} rx={2.5} fill={tiger ? '#e07a10' : '#2e7d32'} stroke="#fff" strokeWidth={1.6} />
          <path d="M0,-4.5 L3.6,1 H1.4 L3.6,4.2 H-3.6 L-1.4,1 H-3.6Z" fill="#fff" />
        </g>
      )
    }
    case 'grassland':
      return (
        <g>
          <circle r={6} fill="#fff" />
          <path d="M-4,4 L-2.5,-3 M0,4 V-5 M4,4 L2.5,-3" stroke="#4d8b2a" strokeWidth={1.6} strokeLinecap="round" />
        </g>
      )
    case 'port':
      return (
        <g>
          <circle r={7} fill="#fff" />
          <path d="M0,-5 V5 M-3,-2.5 H3 M-5,1 Q-4,5 0,5 Q4,5 5,1" fill="none" stroke="#1f3a64" strokeWidth={1.6} strokeLinecap="round" />
          <circle cy={-5.2} r={1.3} fill="none" stroke="#1f3a64" strokeWidth={1.2} />
        </g>
      )
    case 'dam':
      return (
        <g>
          <rect x={-7} y={-4} width={14} height={8} rx={1.5} fill="#fff" />
          <rect x={-5.5} y={-2.2} width={11} height={4.4} fill="#3d3d3d" />
          <path d="M-5.5,4 Q0,1 5.5,4" stroke={WATER_STROKE} strokeWidth={1.3} fill="none" />
        </g>
      )
    case 'island':
      return <circle r={4} fill="#9bc07a" stroke="#355e1f" strokeWidth={1.4} {...{ paintOrder: 'stroke' }} />
    case 'cape':
      return <path d="M-5,4 L0,-5 L5,4Z" fill="#161616" {...HALO} />
    case 'monument':
      return (
        <g>
          <rect x={-6.5} y={-6.5} width={13} height={13} rx={2.5} fill="#7b2d8e" stroke="#fff" strokeWidth={1.6} />
          <path d="M-4,3.8 H4 M-3.2,3.8 V-1 M0,3.8 V-1 M3.2,3.8 V-1 M-4.5,-1 H4.5 L0,-4.5Z" fill="none" stroke="#fff" strokeWidth={1.1} strokeLinejoin="round" />
        </g>
      )
    case 'strait':
    case 'gulf':
    case 'sea':
    case 'canal':
      return <circle r={4} fill="#fff" stroke={WATER_STROKE} strokeWidth={1.8} />
    case 'range':
    case 'plateau':
    case 'desert':
    case 'plain':
    case 'valley':
    case 'coast':
    case 'delta':
    case 'region':
      return <circle r={3.8} fill="#fff" stroke="#6e3a12" strokeWidth={1.8} />
    case 'state':
    case 'country':
      return <circle r={3.5} fill="#fff" stroke="#161616" strokeWidth={1.6} />
    case 'strategic':
      return (
        <g>
          <path d="M0,-7 L7,0 L0,7 L-7,0Z" fill="#8b1e3f" stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
          <circle r={1.9} fill="#fff" />
        </g>
      )
    case 'facility':
      return (
        <g>
          <rect x={-6} y={-6} width={12} height={12} rx={2} fill="#37474f" stroke="#fff" strokeWidth={1.6} />
          <path d="M-3.2,0 H3.2 M0,-3.2 V3.2" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" />
        </g>
      )
  }
}

const WATER_STROKE = '#1f5f9f'

/** Small badge showing recall mastery, top-right of a symbol. */
export function MasteryBadge({ level }: { level: MasteryLevel }) {
  if (level === 'unknown' || level === 'discovered') return null
  return (
    <g transform="translate(7,-7)">
      <circle r={4.2} fill={MASTERY_COLOUR[level]} stroke="#fff" strokeWidth={1.5} />
      {level === 'mastered' && <path d="M-2,0.2 L-0.6,1.6 L2.1,-1.2" fill="none" stroke="#fff" strokeWidth={1.3} strokeLinecap="round" strokeLinejoin="round" />}
    </g>
  )
}

export const KIND_NAME: Record<PlaceKind, string> = {
  state: 'State / UT',
  country: 'Country',
  capital: 'Capital',
  city: 'City',
  peak: 'Peak',
  pass: 'Mountain pass',
  range: 'Mountain range',
  glacier: 'Glacier',
  river: 'River',
  confluence: 'Confluence',
  lake: 'Lake',
  wetland: 'Wetland',
  park: 'Protected area',
  plateau: 'Plateau',
  desert: 'Desert',
  plain: 'Plain',
  valley: 'Valley',
  coast: 'Coast',
  delta: 'Delta',
  island: 'Island',
  port: 'Port',
  dam: 'Dam / reservoir',
  waterfall: 'Waterfall',
  cape: 'Cape / point',
  strait: 'Strait / channel',
  gulf: 'Gulf / bay',
  sea: 'Sea / ocean',
  canal: 'Canal',
  monument: 'Heritage site',
  grassland: 'Grassland',
  volcano: 'Volcano',
  region: 'Region',
  strategic: 'Strategic location',
  facility: 'Facility',
}
