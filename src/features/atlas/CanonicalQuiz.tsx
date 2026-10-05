/** Premium canonical questions, with supplied answers only and role-aware return paths to the map. */
import { useEffect, useRef, useState } from 'react'
import { getPyqCatalog, getPyqQuestion } from '@/atlas/pyq/catalog'
import { meaningfulRelations, pyqAttempt } from '@/atlas/pyq/experience'
import { AtlasPyqBody } from '@/atlas/pyq/QuestionBody'
import type { AtlasPyqQuestion, AtlasPyqAnswer, OptionKey } from '@/atlas/pyq/types'
import type { AtlasData } from '@/atlas/data'
import { create } from '@/data/repo'
import { todayKey } from '@/lib/time'
import { cn } from '@/lib/cn'
import { Button } from '@/ui/controls'
import { QuestionSurface } from '@/ui/patterns/question/QuestionSurface'
import { Check, X } from 'lucide-react'

export function CanonicalQuiz({ id, atlas, onClose, onPlace }: { id: string | null; atlas: AtlasData; onClose: () => void; onPlace: (id: string) => void }) {
  return <QuestionSurface open={!!id} onClose={onClose} title="Previous question" label="Previous question">{id && <Question key={id} id={id} atlas={atlas} onPlace={onPlace} />}</QuestionSurface>
}
function Question({ id, atlas, onPlace }: { id: string; atlas: AtlasData; onPlace: (id: string) => void }) {
  const [data, setData] = useState<{ question: AtlasPyqQuestion; answer: AtlasPyqAnswer }>()
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const [selected, setSelected] = useState<OptionKey | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const lock = useRef(false)
  const questionNode = useRef<HTMLElement>(null)
  useEffect(() => { if (data) questionNode.current?.querySelector<HTMLInputElement>('input')?.focus({ preventScroll: true }) }, [data])
  useEffect(() => { let live = true; setError(''); void getPyqCatalog().then(({ manifest }) => getPyqQuestion(id, manifest)).then((v) => { if (live) setData(v) }).catch(() => { if (live) setError('This verified question couldn’t load. Connect and try again.') }); return () => { live = false } }, [id, retry])
  if (error && !data) return <div role="alert"><p>{error}</p><Button className="mt-3" onClick={() => setRetry((n) => n + 1)}>Try again</Button></div>
  if (!data) return <p role="status">Loading the verified question…</p>
  const { question: q, answer } = data
  const correct = selected && answer.correctOptions.includes(selected)
  const submit = async () => {
    if (!selected || lock.current || submitted) return
    lock.current = true; setSaving(true); setError('')
    try { await create('recalls', pyqAttempt(q, answer, selected, Date.now(), todayKey())); setSubmitted(true) }
    catch { setError('Your answer couldn’t be saved. Try submitting again.'); lock.current = false }
    finally { setSaving(false) }
  }
  const related = [...new Map(meaningfulRelations(q.relations).map((r) => [r.placeId, r])).values()].filter((r) => atlas.byId.has(r.placeId))
  return <article ref={questionNode} className="canonical-quiz" data-question-id={q.id} data-question-type={q.question.type} onKeyDown={e => {
    if (e.ctrlKey || e.metaKey || e.altKey || submitted || saving || (e.target as HTMLElement).closest('button, a')) return
    const key = e.key.toUpperCase()
    const option = q.question.options.find((o, i) => o.key === key || String(i + 1) === key)
    if (option) { e.preventDefault(); setSelected(option.key) }
    if (e.key === 'Enter' && selected) { e.preventDefault(); void submit() }
  }}>
    <p className="mb-5 text-xs font-bold tracking-wide text-ink-3">{q.family} · {q.exam.year}{q.exam.cycle ? ` · ${q.exam.cycle}` : ''} · Question {q.question.number}{q.family === 'CDS' ? ' · Enrichment' : ''}</p>
    <AtlasPyqBody blocks={q.question.content} />
    <fieldset className="mt-7 min-w-0 space-y-3" disabled={submitted || saving}><legend className="sr-only">Choose your answer</legend>
      {q.question.options.map((option) => <label key={option.key} data-answer-state={submitted ? answer.correctOptions.includes(option.key) ? 'correct' : selected === option.key ? 'incorrect' : undefined : undefined} className={cn('quiz-option flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors', selected === option.key ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong hover:bg-surface-2', submitted && answer.correctOptions.includes(option.key) && 'border-success bg-success/10', submitted && selected === option.key && !correct && 'border-danger bg-danger/10')}>
        <input type="radio" name={`answer-${q.id}`} value={option.key} checked={selected === option.key} onChange={() => setSelected(option.key)} className="quiz-radio" />
        <span className="quiz-option-key">{submitted && answer.correctOptions.includes(option.key) ? <Check className="size-4" /> : submitted && selected === option.key && !correct ? <X className="size-4" /> : option.key}</span><span className="min-w-0 flex-1"><AtlasPyqBody blocks={option.content} />{submitted && answer.correctOptions.includes(option.key) && <span className="quiz-verdict text-success">Correct answer</span>}{submitted && selected === option.key && !correct && <span className="quiz-verdict text-danger">Your answer · Incorrect</span>}</span>
      </label>)}
    </fieldset>
    {!submitted && <Button variant="primary" className="mt-5 w-full" disabled={!selected || saving} onClick={() => void submit()}>{saving ? 'Saving…' : 'Submit answer'}</Button>}
    {error && <p className="mt-3 text-danger" role="alert">{error}</p>}
    {submitted && <section className="mt-6 border-t border-line pt-5" aria-live="polite"><h3 className={cn('font-bold', correct ? 'text-success' : 'text-danger')}>{correct ? 'Correct' : 'Incorrect'}</h3><p className="mt-2 text-sm">Your answer: {selected} · Accepted answer{answer.correctOptions.length > 1 ? 's' : ''}: {answer.correctOptions.join(' or ')}</p><p className="mt-2 text-xs text-ink-3">Saved to your quiz history.</p></section>}
    <section className="mt-7 border-t border-line pt-5"><h3 className="t-label text-ink-3">Related places · View on Atlas</h3><div className="mt-3 flex flex-wrap gap-2">{related.map((r) => <Button key={r.placeId} size="sm" onClick={() => onPlace(r.placeId)}>{atlas.byId.get(r.placeId)!.name} · {r.semanticRole === 'primary' ? 'Primary' : r.semanticRole === 'comparison' ? 'Comparison' : 'Supporting'}</Button>)}</div></section>
  </article>
}
