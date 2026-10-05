/** Place summaries use canonical display families; reading a question grants no learning credit. */
import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getPyqCatalog } from '@/atlas/pyq/catalog'
import { familySummary, meaningfulRelations } from '@/atlas/pyq/experience'
import { loadAtlasPyqPaper } from '@/atlas/pyq/loaders'
import type { AtlasPyqQuestion } from '@/atlas/pyq/types'
import { Button } from '@/ui/controls'

export function PlaceQuestions({ placeId, onOpen }: { placeId: string; onOpen: (id: string) => void }) {
  const [questions, setQuestions] = useState<AtlasPyqQuestion[]>()
  const [summary, setSummary] = useState('')
  const [error, setError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let live = true
    setQuestions(undefined)
    setSummary('')
    setError(false)
    void getPyqCatalog()
      .then(async ({ manifest, index }) => {
        const ids = index.places[placeId]?.questionIds ?? []
        const papers = [...new Set(ids.map((id) => id.replace(/-Q\d+$/, '')))]
        const packs = await Promise.all(papers.map((paper) => loadAtlasPyqPaper(manifest, paper)))
        const qs = packs
          .flatMap((p) => p.paper.questions)
          .filter((q) => ids.includes(q.id) && meaningfulRelations(q.relations).some((r) => r.placeId === placeId))
          .sort((a, b) => b.exam.year - a.exam.year || a.id.localeCompare(b.id))
        const counts = { CSE: 0, PCS: 0, CDS: 0 }
        for (const q of qs) counts[q.family]++
        if (live) {
          setQuestions(qs)
          setSummary(familySummary(counts))
        }
      })
      .catch(() => {
        if (live) setError(true)
      })
    return () => {
      live = false
    }
  }, [placeId, retry])
  return (
    <section className="place-section" aria-label="Previous questions">
      <h3 className="eyebrow">
        Previous questions{summary && <span className="place-section-meta"> · {summary}</span>}
      </h3>
      {error ? (
        <div>
          <p className="place-hint">Questions couldn’t load. Let the initial offline download finish and try again.</p>
          <Button size="sm" className="mt-2" onClick={() => setRetry((n) => n + 1)}>
            Try again
          </Button>
        </div>
      ) : !questions ? (
        <p className="place-hint" role="status">
          Loading linked questions…
        </p>
      ) : !questions.length ? (
        <p className="place-hint">No curated questions mapped as meaningful learning relations.</p>
      ) : (
        <ul className="place-pyqs">
          {questions.map((q) => (
            <li key={q.id}>
              <button type="button" onClick={() => onOpen(q.id)}>
                <span className="place-pyq-year type-numeric">{q.exam.year}</span>
                <span className="place-pyq-title">
                  {q.family} · Question {q.question.number}
                </span>
                <span className="place-pyq-type">{q.question.type.replaceAll('-', ' ')}</span>
                <ChevronRight aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
