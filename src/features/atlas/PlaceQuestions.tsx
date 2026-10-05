/** Place summaries use canonical display families; reading a question grants no learning credit. */
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
    let live = true; setQuestions(undefined); setSummary(''); setError(false)
    void getPyqCatalog().then(async ({ manifest, index }) => {
      const ids = index.places[placeId]?.questionIds ?? []
      const papers = [...new Set(ids.map((id) => id.replace(/-Q\d+$/, '')))]
      const packs = await Promise.all(papers.map((paper) => loadAtlasPyqPaper(manifest, paper)))
      const qs = packs.flatMap((p) => p.paper.questions).filter((q) => ids.includes(q.id) && meaningfulRelations(q.relations).some((r) => r.placeId === placeId)).sort((a, b) => b.exam.year - a.exam.year || a.id.localeCompare(b.id))
      const counts = { CSE: 0, PCS: 0, CDS: 0 }; for (const q of qs) counts[q.family]++
      if (live) { setQuestions(qs); setSummary(familySummary(counts)) }
    }).catch(() => { if (live) setError(true) })
    return () => { live = false }
  }, [placeId, retry])
  return <section className="mt-7 border-t border-line pt-5" aria-label="Previous questions"><h3 className="t-label text-ink-3">Previous questions</h3>
    {summary && <p className="mt-2 text-sm font-bold">{summary}</p>}
    {error ? <div><p className="mt-2 text-sm text-ink-2">Questions couldn’t load. Let the initial offline download finish and try again.</p><Button size="sm" onClick={() => setRetry((n) => n + 1)}>Try again</Button></div> : !questions ? <p className="mt-2 text-sm text-ink-3" role="status">Loading linked questions…</p> : !questions.length ? <p className="mt-2 text-sm text-ink-3">No curated questions mapped as meaningful learning relations.</p> : <ul className="mt-2 divide-y divide-line">{questions.map((q) => <li key={q.id}><button type="button" className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm hover:text-accent" onClick={() => onOpen(q.id)}><span>{q.family} · {q.exam.year} · Question {q.question.number}</span><span className="text-xs text-ink-3">{q.question.type.replaceAll('-', ' ')} →</span></button></li>)}</ul>}
  </section>
}
