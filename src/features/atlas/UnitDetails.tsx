/** State and country cards. */
import { Anchor, Landmark } from 'lucide-react'
import type { Exploration } from '@/atlas/useExploration'
import { MASTERY_COLOUR } from './style'
import { DEVELOPMENT_HINT, DEVELOPMENT_LABEL, developmentOf, masteryFn, PlaceIcon } from './util'
import type { MapTarget } from './AtlasMap'

export function UnitDetails({ ex, unit, onSelect }: { ex: Exploration; unit: { type: 'state' | 'country'; id: string }; onSelect: (t: MapTarget) => void }) {
  const { atlas } = ex
  const state = unit.type === 'state' ? atlas.state(unit.id) : undefined
  const country = unit.type === 'country' ? (atlas.countries.find((c) => c.id === unit.id) ?? atlas.country(unit.id)) : undefined
  const key = state ? state.id : (country?.iso ?? unit.id)
  const dev = developmentOf(ex, key)
  const level = masteryFn(ex)
  const places = [...(atlas.inUnit.get(key) ?? [])].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  const name = state?.name ?? country?.name ?? unit.id
  const bar = (n: number, colour: string, label: string) => (
    <div className="flex items-center gap-2 text-[12px] font-semibold text-ink-2">
      <span className="w-20 shrink-0">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
        <span className="block h-full rounded-full" style={{ width: `${dev.total ? (n / dev.total) * 100 : 0}%`, background: colour }} />
      </span>
      <span className="tabular w-12 shrink-0 text-right">
        {n}/{dev.total}
      </span>
    </div>
  )
  return (
    <div>
      <p className="t-label text-[12px] text-ink-3">
        {state ? (state.type === 'ut' ? 'Union Territory' : 'State') : (country?.continent ?? 'Country')}
      </p>
      <h2 className="font-display text-[26px] leading-tight font-medium tracking-tight">{name}</h2>
      {state && (
        <p className="mt-1 flex items-center gap-1.5 text-[14px] font-semibold text-ink-2">
          <Landmark className="size-3.5" /> {state.capital}
          {state.coastal && (
            <>
              <span className="text-ink-3">·</span> <Anchor className="size-3.5" /> Coastal
            </>
          )}
        </p>
      )}
      {state?.fact && <p className="mt-3 text-[15px] leading-relaxed">{state.fact}</p>}

      <div className="mt-4 rounded-2xl bg-surface-2 p-3.5">
        <p className="flex items-baseline justify-between">
          <span className="text-[14px] font-bold">{DEVELOPMENT_LABEL[dev.level]}</span>
          <span className="text-[12px] text-ink-3">{DEVELOPMENT_HINT[dev.level]}</span>
        </p>
        <div className="mt-2.5 space-y-1.5">
                    {bar(dev.familiar, MASTERY_COLOUR.familiar, 'Familiar')}
          {bar(dev.strong, MASTERY_COLOUR.strong, 'Strong')}
          {bar(dev.mastered, MASTERY_COLOUR.mastered, 'Mastered')}
        </div>
      </div>

      {(state?.neighbours.length || country?.neighbours.length) ? (
        <div className="mt-4">
          <p className="t-label text-[12px] text-ink-3">Neighbours</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {state?.neighbours.map((n) => (
              <button key={n} type="button" onClick={() => onSelect({ type: 'state', id: n })} className="rounded-full border border-line px-2.5 py-1 text-[13px] font-semibold hover:bg-surface-2">
                {atlas.state(n)?.name ?? n}
              </button>
            ))}
            {(state?.borderCountries ?? country?.neighbours ?? []).map((iso) => {
              const c = atlas.country(iso)
              return (
                <button key={iso} type="button" onClick={() => c && onSelect({ type: 'country', id: c.id })} className="rounded-full border border-dashed border-line-strong px-2.5 py-1 text-[13px] font-semibold hover:bg-surface-2">
                  {c?.name ?? iso}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <p className="t-label text-[12px] text-ink-3">
          Accessible here · {places.length} places
        </p>
        {places.length ? (
          <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
            {places.map((p) => {
              const l = level(p.id)
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => onSelect({ type: 'place', id: p.id })} className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-[14px] font-semibold hover:bg-surface-2">
                    <PlaceIcon kind={p.kind} tags={p.tags} size={18} />
                    <span className="flex-1 truncate">{p.name}</span>
                    {l !== 'discovered' && <span className="size-2 rounded-full" style={{ background: MASTERY_COLOUR[l] }} />}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-1.5 text-[14px] text-ink-2">No gazetteer places recorded here.</p>
        )}
      </div>
    </div>
  )
}
