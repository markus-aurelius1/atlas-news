import { create } from '@/data/repo'
import type { QuestionType, RecallSource } from '@/data/types'
import { dayKey } from '@/lib/time'
/** Durable Atlas recall writes. */
export async function recordRecall(placeId: string, type: QuestionType, correct: boolean, source: RecallSource): Promise<void> {
  const at = Date.now()
  await create('recalls', { placeId, type, correct: correct ? 1 : 0, at, date: dayKey(at), source })
}
