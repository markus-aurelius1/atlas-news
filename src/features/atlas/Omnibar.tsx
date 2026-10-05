/**
 * The Atlas omnibar: one field that searches every place (and is the accessible
 * alternative to the map), switches between India and the World, and filters
 * the map by category. Results appear in place – nothing modal covers the map.
 */
import { Search, X } from 'lucide-react'
import { forwardRef, useDeferredValue, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { placeSubtitle } from '@/atlas/data'
import { MASTERY_LABEL } from '@/atlas/mastery'
import type { Place, SheetId } from '@/atlas/types'
import type { Exploration } from '@/atlas/useExploration'
import { PLACE_GROUPS } from './groups'
import { MASTERY_COLOUR } from './style'
import { KIND_NAME } from './symbols'
import { masteryFn, PlaceIcon, TAG_LABEL } from './util'

export interface OmnibarHandle {
  open: (query?: string) => void
}

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
const LIMIT = 80
const SHEETS: Array<{ id: SheetId; label: string }> = [
  { id: 'india', label: 'India' },
  { id: 'world', label: 'World' },
]

export const Omnibar = forwardRef<OmnibarHandle, { ex: Exploration; sheet: SheetId; onSheet: (id: SheetId) => void; groups: string[]; onGroups: (groups: string[]) => void; onPick: (id: string) => void }>(function Omnibar({ ex, sheet, onSheet, groups, onGroups, onPick }, ref) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  // The search index is built the first time the field is used, then kept.
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (open) setArmed(true)
  }, [open])
  const root = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const term = norm(useDeferredValue(q))
  const level = useMemo(() => masteryFn(ex), [ex])

  useImperativeHandle(ref, () => ({
    open: (query) => {
      if (query !== undefined) setQ(query)
      setOpen(true)
      input.current?.focus()
      input.current?.select()
    },
  }))

  // Search text for every place, built once per gazetteer.
  const index = useMemo<Entry[] | null>(
    () =>
      armed
        ? ex.atlas.places.map((p) => ({
            p,
            name: norm(p.name),
            other: norm([...(p.aka ?? []), ...(p.states ?? []).map((s) => ex.atlas.state(s)?.name ?? ''), ...(p.countries ?? []).map((c) => ex.atlas.country(c)?.name ?? ''), KIND_NAME[p.kind], p.subtitle ?? '', ...(p.tags ?? []).map((t) => TAG_LABEL[t] ?? '')].join(' | ')),
          }))
        : null,
    [ex.atlas, armed],
  )

  const kinds = useMemo(() => (groups.length ? new Set(PLACE_GROUPS.filter((g) => groups.includes(g.id)).flatMap((g) => g.kinds)) : null), [groups])
  const { rows, total } = useMemo(() => {
    if (!index || (!term && !kinds)) return { rows: [] as Array<{ p: Place; other: boolean }>, total: 0 }
    const rank = (e: Entry) => {
      if (!term) return 0
      if (e.name.startsWith(term)) return 0
      if (e.name.includes(' ' + term)) return 1
      if (e.name.includes(term)) return 2
      if (e.other.includes(term)) return 3
      return -1
    }
    const out: Array<{ p: Place; r: number; other: boolean }> = []
    for (const e of index) {
      const p = e.p
      // Searching looks across both sheets; browsing a category stays on the one in view.
      if (!term && p.sheet !== sheet) continue
      if (kinds && !kinds.has(p.kind)) continue
      const r = rank(e)
      if (r >= 0) out.push({ p, r, other: p.sheet !== sheet })
    }
    out.sort((a, b) => Number(a.other) - Number(b.other) || a.r - b.r || (b.p.yield?.score ?? 0) - (a.p.yield?.score ?? 0) || a.p.level - b.p.level || a.p.name.localeCompare(b.p.name))
    return { rows: out.slice(0, LIMIT), total: out.length }
  }, [index, term, kinds, sheet])

  useEffect(() => setCursor(0), [term, groups, sheet])
  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[data-active]')?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  // A press anywhere else puts the panel away; the query is kept for the next time.
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [open])

  const pick = (id: string) => {
    setOpen(false)
    setQ('')
    input.current?.blur()
    onPick(id)
  }
  const toggle = (id: string) => onGroups(groups.includes(id) ? groups.filter((g) => g !== id) : [...groups, id])
  const listId = 'atlas-search-results'

  return (
    <div ref={root} className="omnibar" data-open={open || undefined}>
      <div className="omnibar-bar">
        <Search className="omnibar-icon" aria-hidden="true" />
        <input
          ref={input}
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && rows[cursor] ? `atlas-result-${rows[cursor].p.id}` : undefined}
          aria-label="Search places"
          placeholder="Search places"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
              setCursor((c) => Math.min(rows.length - 1, c + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setCursor((c) => Math.max(0, c - 1))
            } else if (e.key === 'Enter' && rows[cursor]) {
              e.preventDefault()
              pick(rows[cursor].p.id)
            } else if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              if (q) setQ('')
              else {
                setOpen(false)
                input.current?.blur()
              }
            }
          }}
        />
        {q ? (
          <button type="button" className="tool omnibar-clear" aria-label="Clear search" onClick={() => { setQ(''); input.current?.focus() }}>
            <X />
          </button>
        ) : (
          <span className="kbd-hint" aria-hidden="true">/</span>
        )}
        <div className="sheet-switch" role="radiogroup" aria-label="Map region" data-value={sheet}>
          <span className="sheet-switch-thumb" aria-hidden="true" />
          {SHEETS.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={sheet === s.id} onClick={() => onSheet(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>
      {open && (
        <div className="omnibar-panel">
          <div className="omnibar-chips scrollbar-none" role="group" aria-label="Show on the map">
            <button type="button" className="pill" aria-pressed={!groups.length} onClick={() => onGroups([])}>
              All
            </button>
            {PLACE_GROUPS.map((g) => (
              <button key={g.id} type="button" className="pill" aria-pressed={groups.includes(g.id)} onClick={() => toggle(g.id)}>
                {g.label}
              </button>
            ))}
          </div>
          {rows.length > 0 ? (
            <ul ref={list} id={listId} role="listbox" aria-label="Places" className="omnibar-results scrollbar-thin">
              {rows.map(({ p, other }, i) => {
                const lvl = level(p.id)
                const known = lvl === 'familiar' || lvl === 'strong' || lvl === 'mastered'
                return (
                  <li key={p.id} id={`atlas-result-${p.id}`} role="option" aria-selected={i === cursor} data-active={i === cursor || undefined} className="omnibar-row" onPointerMove={() => i !== cursor && setCursor(i)} onClick={() => pick(p.id)}>
                    <PlaceIcon kind={p.kind} tags={p.tags} size={18} />
                    <span className="omnibar-row-text">
                      <span className="omnibar-row-name">{p.name}</span>
                      <span className="omnibar-row-sub">{placeSubtitle(p, ex.atlas, KIND_NAME[p.kind])}</span>
                    </span>
                    {other && <span className="omnibar-row-tag">{p.sheet === 'india' ? 'India' : 'World'}</span>}
                    {known && <span className="omnibar-row-level" style={{ background: MASTERY_COLOUR[lvl] }} title={MASTERY_LABEL[lvl]} aria-label={MASTERY_LABEL[lvl]} />}
                  </li>
                )
              })}
              {total > rows.length && <li className="omnibar-more" role="presentation">{total - rows.length} more – keep typing to narrow</li>}
            </ul>
          ) : (
            <p id={listId} className="omnibar-empty" role="status">
              {term ? 'No places match.' : groups.length ? 'Nothing in this category on this map.' : `Search ${ex.atlas.places.length.toLocaleString('en-IN')} places, or pick a category to filter the map.`}
            </p>
          )}
        </div>
      )}
    </div>
  )
})
