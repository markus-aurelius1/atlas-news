/** The gazetteer – a searchable index of every place, and the accessible alternative to the map. */
import { Search } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { placeSubtitle } from '@/atlas/data'
import { atLeast, MASTERY_LABEL } from '@/atlas/mastery'
import type { Place, PlaceKind, SheetId } from '@/atlas/types'
import type { Exploration } from '@/atlas/useExploration'
import { cn } from '@/lib/cn'
import { Chip, Segmented, TextInput, Toggle } from '@/ui/controls'
import { Sheet } from '@/ui/Sheet'
import { PLACE_GROUPS } from './groups'
import { BAND_CLASS, BAND_LABEL } from './PastPapers'
import { MASTERY_TEXT_COLOUR } from './style'
import { KIND_NAME } from './symbols'
import { masteryFn, PlaceIcon, TAG_LABEL } from './util'

const GROUPS: Array<{ id: string; label: string; kinds: PlaceKind[] }> = [{ id: 'all', label: 'All', kinds: [] }, ...PLACE_GROUPS]

const norm = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

interface Entry {
  p: Place
  name: string
  /** Aliases, the states or countries it lies in, its type and designations – searched after the name. */
  other: string
}

export function GazetteerSheet({ ex, open, onClose, onPick, sheet, initialQuery = '' }: { ex: Exploration; open: boolean; onClose: () => void; onPick: (id: string) => void; sheet: SheetId; initialQuery?: string }) {
  const [q, setQ] = useState(initialQuery)
  useEffect(() => { setQ(initialQuery) }, [initialQuery])
  const term = norm(useDeferredValue(q))
  const [group, setGroup] = useState('all')
  const [scope, setScope] = useState<SheetId>(sheet)
  const [onlyKnown, setOnlyKnown] = useState(false)
  // Study-priority order is offered once the gazetteer carries PYQ-based scores.
  const hasPriority = !!ex.atlas.yieldModel
  const [order, setOrder] = useState<'name' | 'priority'>('name')
  const byPriority = hasPriority && order === 'priority'
  const level = masteryFn(ex)

  // Search text for every place, built once per gazetteer.
  const index = useMemo<Entry[]>(
    () =>
      ex.atlas.places.map((p) => ({
        p,
        name: norm(p.name),
        other: norm(
          [
            ...(p.aka ?? []),
            ...(p.states ?? []).map((s) => ex.atlas.state(s)?.name ?? ''),
            ...(p.countries ?? []).map((c) => ex.atlas.country(c)?.name ?? ''),
            KIND_NAME[p.kind],
            p.subtitle ?? '',
            ...(p.tags ?? []).map((t) => TAG_LABEL[t] ?? ''),
          ].join(' | '),
        ),
      })),
    [ex.atlas],
  )

  const results = useMemo(() => {
    const kinds = GROUPS.find((g) => g.id === group)!.kinds
    const rank = (e: Entry) => {
      if (!term) return 0
      if (e.name.startsWith(term)) return 0
      if (e.name.includes(' ' + term)) return 1
      if (e.name.includes(term)) return 2
      if (e.other.includes(term)) return 3
      return -1
    }
    const prio = (p: Place) => (byPriority ? (p.yield?.score ?? 0) : 0)
    const out: Array<{ p: Place; r: number; other: boolean }> = []
    for (const e of index) {
      const p = e.p
      // Searching looks across both sheets; browsing stays on the chosen one.
      if (p.sheet !== scope && !term) continue
      if (kinds.length && !kinds.includes(p.kind)) continue
      if (onlyKnown && !ex.state.discovered.has(p.id)) continue
      const r = rank(e)
      if (r < 0) continue
      out.push({ p, r, other: p.sheet !== scope })
    }
    return out.sort((a, b) => Number(a.other) - Number(b.other) || a.r - b.r || prio(b.p) - prio(a.p) || a.p.level - b.p.level || a.p.name.localeCompare(b.p.name))
  }, [index, term, group, scope, onlyKnown, ex, byPriority])

  const inScope = results.filter((r) => !r.other)
  const known = inScope.filter((r) => ex.state.discovered.has(r.p.id)).length

  return (
    <Sheet open={open} onClose={onClose} title="Gazetteer" subtitle={`${known} of ${inScope.length} Familiar`} size="lg">
      <div className="sticky top-0 z-10 -mx-5 bg-surface px-5 pb-3">
        <label className="relative block">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
          <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search places, rivers, parks, Ramsar sites…" className="pl-10" aria-label="Search the gazetteer" data-autofocus />
        </label>
        <div className="mt-3 flex items-center justify-between gap-3">
          <Segmented value={scope} onChange={setScope} options={[{ value: 'india', label: 'India' }, { value: 'world', label: 'World' }]} />
          <label className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
            Familiar only <Toggle checked={onlyKnown} onChange={setOnlyKnown} label="Familiar only" />
          </label>
        </div>
        {hasPriority && (
          <div className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-ink-2">
            Order
            <Segmented
              size="sm"
              value={order}
              onChange={setOrder}
              options={[
                { value: 'name', label: 'A–Z' },
                { value: 'priority', label: 'Study priority' },
              ]}
            />
          </div>
        )}
        <div className="scrollbar-none -mx-5 mt-3 flex gap-1.5 overflow-x-auto px-5">
          {GROUPS.map((g) => (
            <Chip key={g.id} active={group === g.id} onClick={() => setGroup(g.id)} className="shrink-0">
              {g.label}
            </Chip>
          ))}
        </div>
      </div>
      <ul className="divide-y divide-line">
        {results.slice(0, 250).map(({ p, other }) => {
          const found = ex.state.discovered.has(p.id)
          const lvl = level(p.id)
          return (
            <li key={p.id}>
              <button type="button" onClick={() => onPick(p.id)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-surface-2/60">
                <PlaceIcon kind={p.kind} tags={p.tags} />
                <span className="min-w-0 flex-1">
                  <span className={cn('block truncate text-[15px] font-semibold', !found && 'text-ink-2')}>{p.name}</span>
                  <span className="block truncate text-[12.5px] text-ink-3">{placeSubtitle(p, ex.atlas, KIND_NAME[p.kind])}</span>
                </span>
                {other && <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[11px] font-bold text-ink-3">{p.sheet === 'india' ? 'India map' : 'World map'}</span>}
                {byPriority && p.yield && (
                  <span className={cn('tabular shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-bold', BAND_CLASS[p.yield.band])} title={BAND_LABEL[p.yield.band]}>
                    {p.yield.score}
                  </span>
                )}
                {found || atLeast(lvl, 'familiar') ? (
                  <span className="shrink-0 text-[12px] font-bold" style={{ color: lvl === 'discovered' ? 'var(--ink-3)' : MASTERY_TEXT_COLOUR[lvl] }}>
                    {found && lvl === 'discovered' ? 'Familiar' : MASTERY_LABEL[lvl]}
                  </span>
                ) : (
                  <span className="text-xs font-semibold text-ink-3">Accessible</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {results.length > 250 && <p className="py-3 text-center text-[13px] text-ink-3">Showing 250 of {results.length} – refine your search.</p>}
      {!results.length && <p className="py-10 text-center text-[14px] text-ink-2">No places match.</p>}
    </Sheet>
  )
}
