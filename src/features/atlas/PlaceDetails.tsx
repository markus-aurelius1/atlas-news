/** Freely accessible place knowledge; recall establishes mastery. */
import { GraduationCap, LocateFixed } from 'lucide-react'
import type { ReactNode } from 'react'
import { placeSubtitle } from '@/atlas/data'
import { MASTERY_LABEL, type PlaceMastery } from '@/atlas/mastery'
import type { Place, PlaceRelations } from '@/atlas/types'
import type { Exploration } from '@/atlas/useExploration'
import { relativeDayLabel, todayKey } from '@/lib/time'
import { Button } from '@/ui/controls'
import type { MapTarget } from './AtlasMap'
import { PlaceQuestions } from './PlaceQuestions'
import { PlaceSources } from './PlaceSources'
import { MASTERY_COLOUR } from './style'
import { KIND_NAME } from './symbols'
import { breadcrumb, masteryFn, PlaceIcon, TAG_LABEL } from './util'

const REL_LABEL: Record<keyof PlaceRelations, string> = {
  tributaryOf: 'Tributary of',
  bank: 'Bank',
  distributaryOf: 'Distributary of',
  flowsInto: 'Flows into',
  onRiver: 'On the river',
  range: 'Range',
  border: 'Borders',
  connects: 'Connects',
  source: 'Source',
  within: 'Within',
  near: 'Near',
  famousFor: 'Known for',
}
const BACK_LABEL: Partial<Record<keyof PlaceRelations, string>> = {
  tributaryOf: 'Tributaries',
  distributaryOf: 'Distributaries',
  onRiver: 'On its banks',
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
  const crumbs = breadcrumb(atlas, p).filter((c) => c.target)
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
        if (target) return <PlaceLink key={id} place={target} onClick={() => onSelect({ type: 'place', id })} />
        return <span key={id} className="place-plain">{atlas.country(id)?.name ?? id}</span>
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
  for (const [label, list] of back) rels.push({ label, items: list.map((q) => <PlaceLink key={q.id} place={q} onClick={() => onSelect({ type: 'place', id: q.id })} />) })

  return (
    <article className="place" key={p.id}>
      <header className="place-head">
        <p className="eyebrow place-kind">
          <PlaceIcon kind={p.kind} tags={p.tags} size={16} />
          {KIND_NAME[p.kind]}
        </p>
        <h2 className="place-name">{p.name}</h2>
        <p className="place-sub">{placeSubtitle(p, atlas, KIND_NAME[p.kind])}</p>
        {p.aka?.length ? <p className="place-aka">Also {p.aka.join(', ')}</p> : null}
        {(crumbs.length > 0 || tags.length > 0) && (
          <ul className="place-tags" aria-label="Where and designations">
            {crumbs.map((c) => (
              <li key={c.label}>
                <button type="button" className="place-breadcrumb place-tag place-tag-link" onClick={() => onSelect(c.target!)}>
                  {c.label}
                </button>
              </li>
            ))}
            {tags.map((t) => (
              <li key={t} className="place-tag" data-signal={t === 'current-affairs' || t === 'strategic' || undefined}>
                {TAG_LABEL[t]}
              </li>
            ))}
          </ul>
        )}
      </header>

      <div className="place-actions">
        <Button variant="primary" size="sm" icon={<GraduationCap className="size-4" />} onClick={() => onTest(p.id)}>
          Test me
        </Button>
        {onShow && (
          <Button variant="ghost" size="sm" icon={<LocateFixed className="size-4" />} onClick={() => onShow(p)}>
            Show on the map
          </Button>
        )}
        <Mastery level={level} m={m} />
      </div>

      {p.facts.length > 0 && (
        <ul className="place-facts">
          {p.facts.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      )}

      {rels.length > 0 && (
        <dl className="place-rels">
          {rels.map((r, i) => (
            <div key={i}>
              <dt>{r.label}</dt>
              <dd>{r.items}</dd>
            </div>
          ))}
        </dl>
      )}

      <PlaceQuestions placeId={p.id} onOpen={onPyq} />
      <MasteryRow level={level} m={m} />
      <PlaceSources place={p} />
    </article>
  )
}

function PlaceLink({ place, onClick }: { place: Place; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="place-link">
      <PlaceIcon kind={place.kind} tags={place.tags} size={14} />
      {place.name}
    </button>
  )
}

type Level = ReturnType<ReturnType<typeof masteryFn>>
const STEPS = ['familiar', 'strong', 'mastered'] as const
const levelName = (level: Level, m?: PlaceMastery) => (level === 'unknown' || level === 'discovered' ? (m?.attempts ? 'Recall started' : 'Not yet tested') : MASTERY_LABEL[level])

/** Three pips beside the actions: where recall of this place stands, at a glance. */
function Mastery({ level, m }: { level: Level; m?: PlaceMastery }) {
  const idx = STEPS.indexOf(level as (typeof STEPS)[number])
  return (
    <span className="place-pips" title={levelName(level, m)} aria-label={`Recall: ${levelName(level, m)}`}>
      {STEPS.map((s, i) => (
        <span key={s} style={i <= idx ? { background: MASTERY_COLOUR[s] } : undefined} />
      ))}
    </span>
  )
}

export function MasteryRow({ level, m }: { level: Level; m?: PlaceMastery }) {
  let hint = 'Answer one question to make it Familiar.'
  if (m) {
    if (m.level === 'familiar') hint = `For Strong: 3 correct answers (${m.correct}), 2 question types (${m.types.size}), on 2 days.`
    else if (m.level === 'strong') hint = 'For Mastered: 5 correct over a week or more, including a map or ordering question, 85% recent accuracy.'
    else if (m.level === 'mastered') hint = 'Mastered – keep it fresh with spaced reviews.'
  }
  return (
    <section className="place-section place-mastery" aria-label="Recall">
      <h3 className="eyebrow">Recall</h3>
      <p className="place-mastery-level">
        <b>{levelName(level, m)}</b>
        {m?.due && <span>Review {m.due <= todayKey() ? 'due now' : relativeDayLabel(m.due).toLowerCase()}</span>}
      </p>
      <p className="place-hint">{hint}</p>
    </section>
  )
}
