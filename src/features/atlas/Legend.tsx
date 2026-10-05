import type { PlaceKind } from '@/atlas/types'
import { Sheet } from '@/ui/Sheet'
import { MASTERY_COLOUR, STUDIED } from './style'
import { KIND_NAME } from './symbols'
import { PlaceIcon } from './util'

const KINDS: PlaceKind[] = ['capital', 'city', 'port', 'peak', 'volcano', 'pass', 'glacier', 'lake', 'wetland', 'confluence', 'waterfall', 'dam', 'park', 'monument', 'island', 'range', 'strategic', 'facility']

function Line({ dash, width, color, halo }: { dash?: string; width: number; color: string; halo?: number }) {
  return (
    <svg width={44} height={12} aria-hidden="true" className="shrink-0">
      {halo && <line x1={2} y1={6} x2={42} y2={6} stroke="#fff" strokeWidth={halo} />}
      <line x1={2} y1={6} x2={42} y2={6} stroke={color} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" />
    </svg>
  )
}

export function LegendSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Legend" size="md">
      <p className="eyebrow">Boundaries and water</p>
      <ul className="mt-2 space-y-2 text-[14px]">
        <li className="flex items-center gap-3"><Line dash="9 3 2 3" width={1.5} color="#231f1b" halo={3.4} /> International boundary of India</li>
        <li className="flex items-center gap-3"><Line dash="7 2.5 1.5 2.5" width={1.1} color="#3d3833" halo={2.6} /> Other international boundary</li>
        <li className="flex items-center gap-3"><Line dash="4 2.5" width={0.8} color="#4d4740" halo={2} /> State / UT boundary</li>
        <li className="flex items-center gap-3"><Line width={2} color="#3a7fc1" /> River (width shows importance)</li>
        <li className="flex items-center gap-3">
          <svg width={44} height={14} aria-hidden="true"><rect x={3} y={2} width={38} height={10} rx={2} fill={STUDIED} fillOpacity={0.1} stroke={STUDIED} strokeWidth={1.7} strokeOpacity={0.8} /></svg>
          Studied – recall makes places Familiar
        </li>
        <li className="flex items-center gap-3">
          <svg width={44} height={14} aria-hidden="true"><rect x={3} y={2} width={38} height={10} rx={2} fill="#3f8f46" fillOpacity={0.16} stroke="#2e6b33" strokeDasharray="3 2" /></svg>
          Protected area (as you zoom in)
        </li>
        <li className="flex items-center gap-3">
          <svg width={44} height={14} aria-hidden="true"><rect x={3} y={2} width={38} height={10} rx={2} fill="#8b1e3f" fillOpacity={0.07} stroke="#8b1e3f" strokeDasharray="5 3" strokeWidth={1.1} /></svg>
          Disputed or conflict region
        </li>
      </ul>
      <p className="eyebrow mt-6">Lettering</p>
      <ul className="mt-2 space-y-1.5 text-[14px]">
        <li><span className="font-bold tracking-wider">UTTAR PRADESH</span> – states and countries</li>
        <li><span className="font-sans italic text-[#1f5f9f]">Ganga, Bay of Bengal</span> – water</li>
        <li><span className="font-sans italic text-[#6e3a12]">Satpura Range, Thar Desert</span> – physical features</li>
      </ul>
      <p className="eyebrow mt-6">Symbols</p>
      <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-[14px]">
        <li className="flex items-center gap-2.5"><PlaceIcon kind="capital" tags={['national']} /> National capital</li>
        {KINDS.map((k) => (
          <li key={k} className="flex items-center gap-2.5">
            <PlaceIcon kind={k} /> {KIND_NAME[k]}
          </li>
        ))}
        <li className="flex items-center gap-2.5"><PlaceIcon kind="park" tags={['tiger-reserve']} /> Tiger reserve</li>
        <li className="flex items-center gap-2.5">
          <span className="flex size-6 items-center justify-center rounded-full" style={{ boxShadow: `inset 0 0 0 1.3px ${STUDIED}`, background: `color-mix(in srgb, ${STUDIED} 14%, transparent)` }}><PlaceIcon kind="peak" /></span> Studied
        </li>
      </ul>
      <p className="eyebrow mt-6">Mastery</p>
      <ul className="mt-2 flex flex-wrap gap-3 text-[14px]">
        {(['familiar', 'strong', 'mastered'] as const).map((m) => (
          <li key={m} className="flex items-center gap-1.5 capitalize">
            <span className="size-3 rounded-full" style={{ background: MASTERY_COLOUR[m] }} /> {m}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-[12px] leading-relaxed text-ink-3">
        Boundaries follow Natural Earth’s depiction of India’s official view, and DataMeet for states. The Atlas is a study aid, not an authoritative map. Map data: Natural Earth (public domain), DataMeet (CC BY 4.0), AWS Terrain Tiles; outlines and some river courses © OpenStreetMap contributors (ODbL). Places: Wikipedia (CC BY-SA 4.0) and Wikidata (CC0); each place card lists its sources.
      </p>
    </Sheet>
  )
}
