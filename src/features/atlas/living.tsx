/** Drawing for the living world: routes, ships and wildlife, in screen space. */
import type { LivingRoute, Species } from '@/atlas/living'

const ROUTE_STYLE: Record<LivingRoute['kind'], { color: string; width: number; dash?: string }> = {
  road: { color: '#8a4b12', width: 2, dash: '8 3' },
  rail: { color: '#262626', width: 2.2, dash: '1.5 3' },
  trade: { color: '#b3261e', width: 2.2, dash: '6 3 1.5 3' },
  sea: { color: '#1f3a64', width: 1.8, dash: '2 5' },
}

export function RoutePath({ route, d }: { route: LivingRoute; d: string }) {
  const s = ROUTE_STYLE[route.kind]
  return (
    <g>
      <title>{route.name}</title>
      <path d={d} fill="none" stroke="#fff" strokeWidth={s.width + 2.6} strokeLinecap="round" strokeLinejoin="round" opacity={0.75} />
      <path d={d} fill="none" stroke={s.color} strokeWidth={s.width} strokeDasharray={s.dash} strokeLinecap="round" strokeLinejoin="round" />
    </g>
  )
}

const HALO = { stroke: '#fff', strokeWidth: 2.4, paintOrder: 'stroke' as const, strokeLinejoin: 'round' as const }
const INK = '#3a2a1a'

const CAT = 'M-13,-1 C-11,-4 -6,-5 0,-5 L5,-5 C6,-8 9,-9 11,-8 L13,-6 L12,-3 C11,-1 9,0 8,0 L8,5 L6,5 L6,1 L-6,1 L-7,5 L-9,5 L-8,0 C-10,0 -12,-1 -14,-5 C-15,-6 -16,-4 -13,-1Z'

/** Small engraved animal silhouettes (about 30×16 px). */
export function Animal({ species }: { species: Species }) {
  switch (species) {
    case 'tiger':
    case 'lion':
    case 'snow-leopard':
    case 'cheetah':
      return (
        <g>
          <path d={CAT} fill={species === 'lion' ? '#9a6a1c' : species === 'snow-leopard' ? '#7f8488' : '#b8651b'} {...HALO} />
          {species === 'tiger' && <path d="M-6,-5 L-5,-1 M-2,-5 L-1,-1 M2,-5 L3,-1" stroke={INK} strokeWidth={1.1} />}
          {species === 'lion' && <circle cx={9} cy={-5} r={4.2} fill="#6b4410" />}
          {(species === 'snow-leopard' || species === 'cheetah') && <path d="M-5,-3 h0.1 M-1,-4 h0.1 M3,-3 h0.1 M-3,-1 h0.1 M1,-2 h0.1" stroke={INK} strokeWidth={1.6} strokeLinecap="round" />}
        </g>
      )
    case 'rhino':
      return <path d="M-13,3 C-14,-4 -7,-7 0,-7 C6,-7 9,-5 11,-3 L15,-7 L13,-1 C14,1 13,3 11,3 L11,7 L8,7 L8,3 L-6,3 L-6,7 L-9,7 L-9,3Z" fill="#6f6a63" {...HALO} />
    case 'elephant':
      return <path d="M-11,5 C-13,-4 -7,-9 1,-9 C8,-9 12,-6 12,-1 C14,1 14,6 12,9 L10,9 C11,6 10,3 9,2 L9,7 L6,7 L6,4 L-5,4 L-5,7 L-8,7 L-8,5Z" fill="#7b7b80" {...HALO} />
    case 'deer':
      return (
        <g>
          <path d="M-10,0 C-9,-4 -3,-4 4,-4 L6,-7 L9,-7 L9,-4 C9,-2 7,-1 6,-1 L6,6 L4,6 L4,1 L-6,1 L-6,6 L-8,6 L-8,1 C-9,1 -10,0 -10,0Z" fill="#9b6b3a" {...HALO} />
          <path d="M7,-7 L5,-11 M7,-7 L9,-11 M5,-11 L3,-12 M9,-11 L11,-12" stroke={INK} strokeWidth={1.1} fill="none" />
        </g>
      )
    case 'crane':
      return <path d="M1,-9 L4,-8 L2,-6 C5,-3 7,1 4,3 L1,3 M1,3 L1,9 M-1,3 L-1,9 M-7,0 C-3,-3 0,-2 2,1" fill="none" stroke={INK} strokeWidth={1.4} strokeLinecap="round" {...{ paintOrder: 'stroke' }} />
    case 'turtle':
      return (
        <g>
          <ellipse rx={8} ry={5.5} fill="#4f7a3a" {...HALO} />
          <circle cx={9.5} cy={0} r={2.4} fill="#4f7a3a" />
          <path d="M-4,-5 L-7,-8 M4,-5 L7,-8 M-4,5 L-7,8 M4,5 L7,8" stroke="#4f7a3a" strokeWidth={2.2} strokeLinecap="round" />
        </g>
      )
  }
}

export function ShipGlyph() {
  return (
    <g>
      <path d="M-7,2 L7,2 L5,6 L-5,6Z M0,2 L0,-8 L6,0Z" fill="#1f3a64" {...HALO} />
    </g>
  )
}
