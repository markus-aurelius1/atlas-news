/** Quiz history carries canonical identities; only explicit primary-stem evidence can affect a place. */
import type { AtlasPyqQuestion, AtlasPyqAnswer, OptionKey, ExamFamily, PlaceMention } from './types'
import type { RecallAttempt } from '@/data/types'

export const meaningfulRelations = (relations: PlaceMention[]) => relations.filter((r) => r.semanticRole !== 'distractor' && r.semanticRole !== 'incidental')
export const eligiblePlaceIds = (q: AtlasPyqQuestion) => [...new Set(q.relations.filter((r) => r.masteryEligible && r.quizIncluded && r.semanticRole === 'primary' && r.locationInQuestion === 'stem' && r.relevance !== 'incidental' && r.relevance !== 'none').map((r) => r.placeId))].sort()
export const familySummary = (counts: Partial<Record<ExamFamily, number>>) => (['CSE', 'PCS', 'CDS'] as const).filter((f) => counts[f]).map((f) => `${f} ×${counts[f]}`).join(' · ')
export function pyqAttempt(q: AtlasPyqQuestion, answer: AtlasPyqAnswer, selected: OptionKey, at: number, date: RecallAttempt['date']) {
  if (answer.questionId !== q.id || answer.id !== q.answerId || answer.status !== 'final' || !answer.correctOptions.length || !['A', 'B', 'C', 'D'].includes(selected)) throw new Error('Invalid canonical answer')
  const places = eligiblePlaceIds(q)
  return {
    placeId: places[0] ?? '', type: 'pyq' as const, correct: (answer.correctOptions.includes(selected) ? 1 : 0) as 0 | 1, at, date, source: 'card' as const,
    pyq: { canonicalQuestionId: q.id, baseQuestionHash: q.baseQuestionHash, suppliedAnswerHash: answer.suppliedAnswerHash, selectedAnswer: selected, acceptedAnswers: [...answer.correctOptions], eligiblePlaceIds: places },
  }
}
