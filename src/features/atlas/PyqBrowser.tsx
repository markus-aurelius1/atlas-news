/** Curated question catalogue, opened explicitly; only matching paper packs are requested. */
import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AtlasData } from '@/atlas/data'
import { matchesPyq, type PyqFilter } from '@/atlas/pyq/browse'
import { getPyqCatalog } from '@/atlas/pyq/catalog'
import { meaningfulRelations } from '@/atlas/pyq/experience'
import { loadAtlasPyqPaper } from '@/atlas/pyq/loaders'
import type { AtlasPyqQuestion } from '@/atlas/pyq/types'
import { Button, Select } from '@/ui/controls'
import { Sheet } from '@/ui/Sheet'
import { KIND_NAME } from './symbols'
import { PlaceIcon } from './util'

const FAMILIES = [
  { id: '', label: 'All exams' },
  { id: 'CSE', label: 'CSE' },
  { id: 'PCS', label: 'PCS' },
  { id: 'CDS', label: 'CDS' },
]

export function PyqBrowser({ filter, atlas, onClose, onOpen, onPlace }: { filter: PyqFilter | null; atlas: AtlasData; onClose: () => void; onOpen: (id: string) => void; onPlace: (id: string) => void }) {
  return (
    <Sheet open={!!filter} onClose={onClose} title="Previous questions" subtitle="149 curated Atlas questions · CDS is enrichment evidence" size="lg">
      {filter && <Browse key={JSON.stringify(filter)} initial={filter} atlas={atlas} onOpen={onOpen} onPlace={onPlace} />}
    </Sheet>
  )
}

function Browse({ initial, atlas, onOpen, onPlace }: { initial: PyqFilter; atlas: AtlasData; onOpen: (id: string) => void; onPlace: (id: string) => void }) {
  const [filter, setFilter] = useState<PyqFilter>({ ...initial, family: initial.family ?? (initial.placeId ? '' : 'CSE') })
  const [questions, setQuestions] = useState<AtlasPyqQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  const [years, setYears] = useState<number[]>([])
  useEffect(() => {
    let live = true
    setLoading(true)
    setError(false)
    void (async () => {
      const { manifest, index } = await getPyqCatalog()
      if (live) setYears([...new Set(manifest.papers.map((p) => p.year))].sort((a, b) => b - a))
      const ids = filter.placeId ? new Set(index.places[filter.placeId]?.questionIds ?? []) : null
      const entries = manifest.papers.filter((p) => (!filter.family || p.family === filter.family) && (!filter.year || p.year === filter.year) && (!ids || [...ids].some((id) => id.startsWith(p.paperId + '-Q'))))
      const packs = await Promise.all(entries.map((p) => loadAtlasPyqPaper(manifest, p.paperId)))
      if (live) setQuestions(packs.flatMap((p) => p.paper.questions).filter((q) => matchesPyq(q, filter, atlas)).sort((a, b) => b.exam.year - a.exam.year || a.id.localeCompare(b.id)))
    })()
      .catch(() => {
        if (live) setError(true)
      })
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [filter, atlas, retry])
  const mapped = [...new Set(questions.flatMap((q) => meaningfulRelations(q.relations).map((r) => r.placeId)))]
    .map((id) => atlas.byId.get(id))
    .filter((p) => !!p)
    .sort((a, b) => a.name.localeCompare(b.name))
  const places = filter.mode === 'places'
  return (
    <div className="pyq">
      <div className="pyq-filters">
        <div role="group" aria-label="Question exam" className="pyq-pills">
          {FAMILIES.map((f) => (
            <button key={f.id} type="button" className="pill" aria-pressed={(filter.family ?? '') === f.id} onClick={() => setFilter({ ...filter, family: f.id })}>
              {f.label}
            </button>
          ))}
        </div>
        <Select compact aria-label="Question year" value={filter.year ?? ''} onChange={(e) => setFilter({ ...filter, year: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y}>{y}</option>
          ))}
        </Select>
        <Select compact aria-label="Catalogue view" value={filter.mode ?? 'questions'} onChange={(e) => setFilter({ ...filter, mode: e.target.value })}>
          <option value="questions">Questions</option>
          <option value="places">Mapped places</option>
        </Select>
      </div>
      {(filter.placeId || filter.kind) && (
        <p className="place-hint">
          {filter.placeId && atlas.byId.get(filter.placeId)?.name}
          {filter.kind && `Geographic type: ${filter.kind}`}
        </p>
      )}
      {loading ? (
        <p role="status" className="place-hint">
          Loading curated questions…
        </p>
      ) : error ? (
        <div role="alert">
          <p className="place-hint">These question packs couldn’t load. Try again after the offline download finishes.</p>
          <Button size="sm" className="mt-2" onClick={() => setRetry((r) => r + 1)}>
            Retry
          </Button>
        </div>
      ) : (
        <>
          <p className="eyebrow pyq-count">
            {questions.length} questions · {mapped.length} meaningful mapped places
          </p>
          {places ? (
            <ul className="pyq-rows">
              {mapped.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => onPlace(p.id)}>
                    <PlaceIcon kind={p.kind} tags={p.tags} size={18} />
                    <span className="pyq-text">
                      <b>{p.name}</b>
                      <small>{p.subtitle ?? KIND_NAME[p.kind]}</small>
                    </span>
                    <ChevronRight aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <ul className="pyq-rows">
              {questions.map((q) => (
                <li key={q.id}>
                  <button type="button" onClick={() => onOpen(q.id)}>
                    <span className="pyq-year type-numeric">{q.exam.year}</span>
                    <span className="pyq-text">
                      <small>
                        {q.family}
                        {q.exam.cycle ? ` · ${q.exam.cycle}` : ''} · Q{q.question.number}
                      </small>
                      <span>{q.question.content.find((b) => b.type === 'paragraph')?.text ?? `${q.question.type} question`}</span>
                    </span>
                    <ChevronRight aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!questions.length && <p className="place-hint py-6">No curated questions match these filters.</p>}
        </>
      )}
    </div>
  )
}
