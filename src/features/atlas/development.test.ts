/** Learning in an accessible, untravelled unit must appear in its development bars. */
import { expect, it } from 'vitest'
import { computeMastery } from '@/atlas/mastery'
import type { Exploration } from '@/atlas/useExploration'
import type { RecallAttempt } from '@/data/types'
import { developmentOf } from './util'

it('counts learning independently while retaining historical expansion denominators', () => {
  const attempt = { id: 'r', placeId: 'learned', type: 'fact', correct: 1, at: 1000, date: '2026-10-01' } as RecallAttempt
  const ex = {
    atlas: { inUnit: new Map([['unit', [{ id: 'learned', added: 2 }, { id: 'untouched', added: 2 }, { id: 'original' }]]]) },
    state: { discovered: new Map(), explored: new Set() },
    mastery: computeMastery([attempt], '2026-10-01'),
  } as unknown as Exploration
  expect(developmentOf(ex, 'unit')).toEqual({ level: 'settled', total: 2, discovered: 0, familiar: 1, strong: 0, mastered: 0 })
})
