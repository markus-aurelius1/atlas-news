/** Freely accessible place knowledge; recall establishes mastery. */
import { ChevronRight, Crosshair, GraduationCap } from 'lucide-react'
import { PlaceSources } from './PlaceSources'
import type { ReactNode } from 'react'
import { placeSubtitle } from '@/atlas/data'
import { MASTERY_LABEL, type PlaceMastery } from '@/atlas/mastery'
import type { Place, PlaceRelations } from '@/atlas/types'
import type { Exploration } from '@/atlas/useExploration'
import { todayKey, relativeDayLabel } from '@/lib/time'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/controls'
import { PlaceQuestions } from './PlaceQuestions'
import { MASTERY_COLOUR, MASTERY_TEXT_COLOUR } from './style'
import { KIND_NAME } from './symbols'
import { breadcrumb, masteryFn, PlaceIcon, TAG_LABEL } from './util'
import type { MapTarget } from './AtlasMap'

const REL_LABEL: Record<keyof PlaceRelations, string> = {
  tributaryOf: 'Tributary of',
  bank: 'Bank',
  distributaryOf: 'Distributary of',
  flowsInto: 'Flows into',
  onRiver: 'On the river',
  range: 'Range',
  border: 'Border with',
  connects: 'Connects',
  source: 'Source',
  within: 'Within',
  near: 'Near',
  famousFor: 'Famous for',
}
const BACK_LABEL: Partial<Record<keyof PlaceRelations, string>> = {
  tributaryOf: 'Tributaries',
  distributaryOf: 'Distributaries',
  onRiver: 'Along its banks',
  range: 'In this range',
  source: 'Rises here',
  within: 'Contains',
  flowsInto: 'Receives',
  connects: 'Connected by',
  near: 'Nearby',
}

export function PlaceDetails({ ex, place: p, onSelect, onTest, onShow, onPyq }: { ex: Exploration; place: Place; onSelect: (t: MapTarget) => void; onTest: (id: string) => void; onShow?: (p: Place) => void; onPyq: (id: string) => void }) {
  const { atlas } = ex
  const level = masteryFn(ex)(p.id)
  const m = ex.mastery.get(p.id)
  const crumbs = breadcrumb(atlas, p)
  // Designations first (Ramsar, tiger reserve…), then study tags; the capital star is already the symbol.
  const tags = (p.tags ?? []).filter((t) => TAG_LABEL[t] && t !== 'national')

  const rels: Array<{ label: string; items: ReactNode }> = []
  for (const [key, v] of Object.entries(p.rel ?? {}) as Array<[keyof PlaceRelations, unknown]>) {
    if (key === 'bank') continue
    const ids = (Array.isArray(v) ? v : [v]) as string[]
    const label = key === 'tributaryOf' && p.rel?.bank ? `Tributary (${p.rel.bank} bank) of` : REL_LABEL[key]
    rels.push({
      label,
      items: ids.map((id) => {
        const target = atlas.byId.get(id)
        if (target) return <LinkChip key={id} place={target} ex={ex} onClick={() => onSelect({ type: 'place', id })} />
        const c = atlas.country(id)
        return <span key={id} className="rounded-full border border-line px-2.5 py-1 text-[13px] font-semibold">{c?.name ?? id}</span>
      }),
    })
  }
  const back = new Map<string, Place[]>()
  for (const r of atlas.referencedBy.get(p.id) ?? []) {
    const label = BACK_LABEL[r.key as keyof PlaceRelations]
    if (!label) continue
    if (!back.has(label)) back.set(label, [])
    if (!back.get(label)!.includes(r.place)) back.get(label)!.push(r.place)
  }
  for (const [label, list] of back) rels.push({ label, items: list.map((q) => <LinkChip key={q.id} place={q} ex={ex} onClick={() => onSelect({ type: 'place', id: q.id })} />) })

  return (
    <div className="place-knowledge">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex size-10 items-center justify-center rounded-lg bg-knowledge-soft text-knowledge">
          <PlaceIcon kind={p.kind} tags={p.tags} size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[26px] leading-tight font-medium tracking-tight">{p.name}</h2>
          <p className="mt-0.5 text-[13px] font-semibold text-ink-2">{placeSubtitle(p, atlas, KIND_NAME[p.kind])}</p>
          {p.aka?.length ? <p className="mt-0.5 text-[13px] text-ink-3 italic">Also {p.aka.join(', ')}</p> : null}
        </div>
      </div>

      {tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Designations">
          {tags.map((t) => (
            <li key={t} className={cn('rounded-full px-2.5 py-0.5 text-[12px] font-bold', t === 'current-affairs' || t === 'strategic' ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink-2')}>
              {TAG_LABEL[t]}
            </li>
          ))}
        </ul>
      )}

      <nav aria-label="Where" className="mt-3 flex flex-wrap items-center gap-1 text-[12px] font-semibold text-ink-3">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <ChevronRight className="size-3" />}
            {c.target ? (
              <button type="button" className="place-breadcrumb rounded px-0.5 text-ink-2 underline-offset-2 hover:underline" onClick={() => onSelect(c.target!)}>
                {c.label}
              </button>
            ) : (
              <span>{c.label}</span>
            )}
          </span>
        ))}
      </nav>

      {(
        <>
          <ul className="mt-4 space-y-2">
            {p.facts.map((f, i) => (
              <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed">
                <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-knowledge" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          {rels.length > 0 && (
            <div className="mt-5 space-y-2.5">
              {rels.map((r, i) => (
                <div key={i}>
                  <p className="t-label text-[12px] text-ink-3">{r.label}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">{r.items}</div>
                </div>
              ))}
            </div>
          )}
          <PlaceQuestions placeId={p.id} onOpen={onPyq} />
          <MasteryRow level={level} m={m} />
          <div className="mt-6 flex flex-wrap gap-2">
            <Button variant="primary" icon={<GraduationCap className="size-4" />} onClick={() => onTest(p.id)}>
              Test me
            </Button>
            {onShow && (
              <Button className="col-span-2" variant="ghost" icon={<Crosshair className="size-4" />} onClick={() => onShow(p)}>
                Show on the map
              </Button>
            )}
          </div>
        </>
      )}

      <PlaceSources place={p} />
    </div>
  )
}

function LinkChip({ place, ex, onClick }: { place: Place; ex: Exploration; onClick: () => void }) {
  const known = ex.state.discovered.has(place.id)
  return (
    <button type="button" onClick={onClick} className={cn('flex min-h-11 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[13px] font-semibold transition-colors hover:bg-surface-2', known ? 'border-line-strong' : 'border-dashed border-line text-ink-2')}>
      <PlaceIcon kind={place.kind} tags={place.tags} size={16} />
      {place.name}
    </button>
  )
}

export function MasteryRow({ level, m }: { level: ReturnType<ReturnType<typeof masteryFn>>; m?: PlaceMastery }) {
  const steps = ['familiar', 'strong', 'mastered'] as const
  const idx = steps.indexOf(level as (typeof steps)[number])
  let hint = 'Answer one question to make it Familiar.'
  if (m) {
    if (m.level === 'familiar') hint = `For Strong: 3 correct answers (${m.correct}), 2 question types (${m.types.size}), on 2 days.`
    else if (m.level === 'strong') hint = 'For Mastered: 5 correct over a week or more, including a map or ordering question, 85% recent accuracy.'
    else if (m.level === 'mastered') hint = 'Mastered – keep it fresh with spaced reviews.'
  }
  return (
    <div className="place-mastery mt-4 bg-surface-2 p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-bold" style={{ color: MASTERY_TEXT_COLOUR[level] }}>
          {level === 'unknown' || level === 'discovered' ? m?.attempts ? 'Recall started' : 'Not yet tested' : MASTERY_LABEL[level]}
        </span>
        {m?.due && <span className="text-[12px] font-semibold text-ink-3">Review {m.due <= todayKey() ? 'due now' : relativeDayLabel(m.due).toLowerCase()}</span>}
      </div>
      <div className="mt-2 flex gap-1" aria-hidden="true">
        {steps.map((s, i) => (
          <span key={s} className="h-1.5 flex-1 rounded-full" style={{ background: i <= idx ? MASTERY_COLOUR[s] : 'var(--line)' }} />
        ))}
      </div>
      <p className="mt-2 text-[12px] leading-snug text-ink-2">{hint}</p>
    </div>
  )
}
