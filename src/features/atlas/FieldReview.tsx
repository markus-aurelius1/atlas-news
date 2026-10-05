/**
 * Field Review: a short run of recall questions. Used for the daily review,
 * "Test me" on a place card and spaced reviews.
 */
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Check, RotateCcw, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { recordRecall } from '@/atlas/actions'
import { useSheet } from '@/atlas/sheet'
import { isCorrect, makeQuestion, TYPE_LABEL, type Question } from '@/atlas/questions'
import { MASTERY_LABEL, MASTERY_ORDER, type MasteryLevel } from '@/atlas/mastery'
import { useExploration, type Exploration } from '@/atlas/useExploration'
import type { RecallSource } from '@/data/types'
import { RECALL_XP_DAILY_CAP } from '@/game/progression'
import { cn } from '@/lib/cn'
import { haptics } from '@/services/haptics'
import { Button } from '@/ui/controls'
import { QuestionSurface } from '@/ui/patterns/question/QuestionSurface'
import { AnswerTile } from '@/ui/patterns/question/AnswerTile'
import { AtlasMap, type MapPin } from './AtlasMap'
import { MASTERY_TEXT_COLOUR } from './style'
import { labelKeyOf } from './labels'
import { masteryFn } from './util'

export interface ReviewRequest {
  placeIds: string[]
  source: RecallSource
  title?: string
}

export function FieldReviewSheet({ request, onClose }: { request: ReviewRequest | null; onClose: () => void }) {
  const ex = useExploration()
  return (
    <QuestionSurface open={!!request && !!ex} onClose={onClose} bare label={request?.title ?? 'Field review'}>
      {request && ex && <Review key={request.placeIds.join()} ex={ex} request={request} onClose={onClose} />}
    </QuestionSurface>
  )
}

interface Result {
  q: Question
  correct: boolean
  given: string
}

export function Review({ ex, request, onClose, compact }: { ex: Exploration; request: ReviewRequest; onClose: () => void; compact?: boolean }) {
  // Questions are fixed when the review opens; mastery keeps updating live.
  const [start] = useState(() => ({ levels: new Map(request.placeIds.map((id) => [id, masteryFn(ex)(id)])), today: ex.today, seed: `${ex.today}:${Date.now()}` }))
  const questions = useMemo(
    () =>
      request.placeIds
        .map((id, i) => {
          const p = ex.atlas.byId.get(id)
          return p ? makeQuestion(ex.atlas, p, ex.mastery, `${start.seed}:${i}`) : null
        })
        .filter((q): q is Question => !!q),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<Result[]>([])
  const pending = useRef(false)
  const saved = useRef(new Set<string>())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const q = questions[index]
  const answered = results[index]
  const done = index >= questions.length

  const answer = async (given: string) => {
    if (!q || answered || pending.current || saved.current.has(q.key)) return
    pending.current = true
    setSaving(true)
    setError(null)
    const correct = isCorrect(q, given)
    try {
      await recordRecall(q.placeId, q.type, correct, request.source)
      saved.current.add(q.key)
      correct ? haptics.success() : haptics.warning()
      setResults((r) => [...r, { q, correct, given }])
    } catch {
      setError('Your answer could not be saved. Try again.')
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  if (!questions.length) {
    return (
      <div className="p-6 text-center">
        <p className="font-display text-xl">Nothing to review yet</p>
        <p className="mt-2 text-sm text-ink-2">Choose any place to test your recall.</p>
        <Button className="mt-5" onClick={onClose}>
          Close
        </Button>
      </div>
    )
  }

  if (done) return <Summary ex={ex} results={results} before={start.levels} onClose={onClose} />

  return (
    <div className={cn('flex flex-col', compact ? '' : 'px-5 pt-3 pb-5 sm:pt-5')} onKeyDown={e => {
      if (e.ctrlKey || e.metaKey || e.altKey || saving || (e.target as HTMLElement).closest('input, textarea, select, button:not([role="radio"]), a')) return
      if (e.key === 'Enter' && answered) { e.preventDefault(); setIndex(i => i + 1) }
      if (!answered && !q.order) { const i = /^[1-4]$/.test(e.key) ? Number(e.key) - 1 : ['a', 'b', 'c', 'd'].indexOf(e.key.toLowerCase()); if (i >= 0 && q.options[i]) { e.preventDefault(); void answer(q.options[i].id) } }
    }}>
      <div className="flex items-center gap-3">
        <div className="flex flex-1 gap-1" aria-label={`Question ${index + 1} of ${questions.length}`}>
          {questions.map((_, i) => (
            <span key={i} className={cn('h-1.5 flex-1 rounded-full transition-colors', i < results.length ? (results[i].correct ? 'bg-success' : 'bg-danger') : i === index ? 'bg-ink-2' : 'bg-line')} />
          ))}
        </div>
        {!compact && (
          <button type="button" onClick={onClose} className="flex size-11 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2" aria-label="Close review">
            <X className="size-4.5" />
          </button>
        )}
      </div>
      <p className="mt-4 t-label text-[12px] text-ink-3">
        {request.title ?? 'Field review'} · {TYPE_LABEL[q.type]}
      </p>
      <AnimatePresence mode="wait">
        <motion.div key={q.key} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
          <h3 className="mt-1.5 font-display text-[22px] leading-snug font-medium tracking-tight">{q.prompt}</h3>
          {q.clue && <p className="mt-2 rounded-2xl bg-surface-2 px-4 py-3 text-[15px] leading-relaxed italic">“{q.clue}”</p>}
          <fieldset disabled={saving} className="min-w-0" aria-label="Recall answer">
            {q.map && <QuestionMap ex={ex} q={q} result={answered} onPin={answer} />}
            {q.order ? <OrderInput q={q} result={answered} onSubmit={answer} /> : <Choices q={q} result={answered} onPick={answer} />}
          </fieldset>
          {saving && <p role="status" className="mt-3 text-sm text-ink-2">Saving answer…</p>}
          {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
          {answered && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={cn('mt-4 rounded-2xl p-4', answered.correct ? 'bg-success/10' : 'bg-danger/10')}>
              <p className={cn('flex items-center gap-2 text-[15px] font-bold', answered.correct ? 'text-success' : 'text-danger')}>
                {answered.correct ? <Check className="size-4.5" /> : <X className="size-4.5" />}
                {answered.correct ? 'Correct' : 'Not quite'}
              </p>
              <p className="mt-1.5 text-[14px] leading-relaxed">{q.explain}</p>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
      {answered && (
        <Button variant="primary" className="mt-4" block data-autofocus icon={<ArrowRight className="size-4" />} onClick={() => setIndex((i) => i + 1)}>
          {index + 1 < questions.length ? 'Next question' : 'See results'}
        </Button>
      )}
    </div>
  )
}

function Choices({ q, result, onPick }: { q: Question; result?: Result; onPick: (id: string) => void }) {
  return <div className="mt-4 grid gap-2" role="radiogroup" aria-label="Recall choices">{q.options.map((o, i) => <AnswerTile key={o.id} letter={String.fromCharCode(65 + i)} selected={result?.given === o.id} disabled={!!result} state={result ? o.id === q.answer ? 'correct' : result.given === o.id ? 'incorrect' : 'idle' : 'idle'} onSelect={() => onPick(o.id)}>{o.label}</AnswerTile>)}</div>
}

function OrderInput({ q, result, onSubmit }: { q: Question; result?: Result; onSubmit: (answer: string) => void }) {
  const [seq, setSeq] = useState<string[]>([])
  const label = (id: string) => q.options.find((o) => o.id === id)?.label ?? id
  useEffect(() => setSeq([]), [q.key])
  const full = seq.length === q.options.length
  return (
    <div className="mt-4">
      {q.orderHint && (
        <p className="mb-2 flex justify-between t-label text-[12px] text-ink-3">
          <span>{q.orderHint[0]}</span>
          <span>{q.orderHint[1]}</span>
        </p>
      )}
      <ol className="flex min-h-12 flex-wrap items-center gap-1.5 rounded-2xl border border-dashed border-line-strong p-2">
        {seq.length === 0 && <li className="px-2 text-[14px] text-ink-3">Tap the items below in order</li>}
        {seq.map((id, i) => {
          const right = result && q.order![i] === id
          return (
            <li key={id} className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[14px] font-semibold', result ? (right ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger') : 'bg-surface-2')}>
              <span className="tabular text-ink-3">{i + 1}</span> {label(id)}
            </li>
          )
        })}
      </ol>
      {!result && (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {q.options
              .filter((o) => !seq.includes(o.id))
              .map((o) => (
                <button key={o.id} type="button" onClick={() => setSeq((s) => [...s, o.id])} className="rounded-full border border-line bg-surface px-4 py-2 text-[15px] font-semibold hover:bg-surface-2">
                  {o.label}
                </button>
              ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="ghost" icon={<RotateCcw className="size-3.5" />} onClick={() => setSeq([])} disabled={!seq.length}>
              Reset
            </Button>
            <Button size="sm" variant="primary" disabled={!full} onClick={() => onSubmit(seq.join(','))}>
              Check order
            </Button>
          </div>
        </>
      )}
      {result && !result.correct && <p className="mt-2 text-[13px] font-semibold text-ink-2">Correct order: {q.order!.map(label).join(' → ')}</p>}
    </div>
  )
}

function QuestionMap({ ex, q, result, onPin }: { ex: Exploration; q: Question; result?: Result; onPin: (id: string) => void }) {
  const { sheet } = useSheet(q.map!.sheet)
  const hidden = useMemo(() => {
    // Don't let the map's own names give the answer away.
    const ids = [q.placeId, ...q.options.map((o) => o.id)]
    const keys = new Set<string>()
    for (const id of ids) {
      const g = ex.atlas.byId.get(id)?.geom
      if (g) keys.add(g)
    }
    if (sheet) for (const l of sheet.labels) if (ids.some((id) => ex.atlas.byId.get(id)?.name === l.name)) keys.add(labelKeyOf(l))
    return keys
  }, [q, sheet, ex])
  const pins: MapPin[] = q.map!.pins.map((p) => ({
    ...p,
    tone: !result ? 'accent' : p.id === q.answer ? 'correct' : p.id === result.given ? 'wrong' : 'muted',
  }))
  return (
    <div className="mt-3 h-[230px] overflow-hidden rounded-2xl border border-line sm:h-[300px]">
      {sheet ? (
        <AtlasMap
          key={q.key}
          sheet={sheet}
          plate="physical"
          explored={null}
          places={[]}
          showPlaces={false}
          pins={pins}
          hiddenLabels={hidden}
          initialFocus={q.map!.focus}
          onSelect={(t) => t.type === 'pin' && q.type === 'locate' && onPin(t.id)}
        />
      ) : (
        <div className="size-full animate-pulse bg-surface-2" />
      )}
    </div>
  )
}

function Summary({ ex, results, before, onClose }: { ex: Exploration; results: Result[]; before: Map<string, MasteryLevel>; onClose: () => void }) {
  const right = results.filter((r) => r.correct).length
  const changes = [...new Set(results.map((r) => r.q.placeId))]
    .map((id) => ({ id, from: before.get(id) ?? 'discovered', to: masteryFn(ex)(id) }))
    .filter((c) => MASTERY_ORDER.indexOf(c.to) > MASTERY_ORDER.indexOf(c.from))
  return (
    <div className="px-6 pt-4 pb-6 text-center sm:pt-8">
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mx-auto flex size-16 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Sparkles className="size-7" />
      </motion.div>
      <h2 className="mt-4 font-display text-2xl font-medium tracking-tight">
        {right} of {results.length} correct
      </h2>
      <p className="mt-1 text-[15px] text-ink-2">+{right} XP · recall XP is capped at {RECALL_XP_DAILY_CAP} a day</p>
      {changes.length > 0 && (
        <ul className="mx-auto mt-5 max-w-sm space-y-2 text-left">
          {changes.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-2xl bg-surface-2 px-4 py-2.5 text-[14px]">
              <span className="font-semibold">{ex.atlas.byId.get(c.id)?.name}</span>
              <span className="font-bold" style={{ color: MASTERY_TEXT_COLOUR[c.to] }}>
                {MASTERY_LABEL[c.to]}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Button variant="primary" className="mt-6" block onClick={onClose} data-autofocus>
        Done
      </Button>
    </div>
  )
}
