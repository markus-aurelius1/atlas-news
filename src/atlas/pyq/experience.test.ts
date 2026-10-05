/** Canonical quiz credit, all supplied structures and durable history without a schema migration. */
import 'fake-indexeddb/auto'
import { readFileSync, readdirSync } from 'node:fs'
import { describe, it, expect } from 'vitest'
import { db } from '@/data/db'
import { create, remove } from '@/data/repo'
import { createBackup, parseBackup, restoreBackup } from '@/data/backup'
import { applyChanges, changesSince } from '@/data/compatibility/merge'
import { computeMastery, dueForReview, levelOf, MASTERY_LABEL } from '@/atlas/mastery'
import { geographicSources } from '@/atlas/access'
import { eligiblePlaceIds, meaningfulRelations, familySummary, pyqAttempt } from './experience'
import { premiumRenderability } from './quality.mjs'
import { blockNodes } from './render.mjs'
import type { AtlasPyqPaper, AtlasPyqAnswers, AtlasPyqQuestion, PlaceMention } from './types'
import type { Place } from '@/atlas/types'

const root = new URL('../../../public/pyq-atlas/v1/', import.meta.url)
const papers = readdirSync(new URL('papers/', root)).map((file) => JSON.parse(readFileSync(new URL(`papers/${file}`, root), 'utf8')) as AtlasPyqPaper)
const questions = papers.flatMap((p) => p.questions)
const first = questions[0]
const answers = readdirSync(new URL('answers/', root)).flatMap((file) => (JSON.parse(readFileSync(new URL(`answers/${file}`, root), 'utf8')) as AtlasPyqAnswers).answers)
const answer = answers.find((a) => a.questionId === first.id)!
describe('Atlas learning access and canonical experience', () => {
  it('the full place inventory retains 2273 unique identities', () => {
    const places = JSON.parse(readFileSync(new URL('../../../public/atlas/v1/places.json', import.meta.url), 'utf8')).places as Place[]
    expect(places).toHaveLength(2273); expect(new Set(places.map(p=>p.id)).size).toBe(2273)
  })
  it('all 149 exact canonical bodies/options render and have final accepted answers', () => {
    expect(questions).toHaveLength(149)
    expect(new Set(questions.map((q) => q.question.type)).size).toBe(8)
    for (const q of questions) {
      expect(premiumRenderability(q.question).pass).toBe(true)
      expect(blockNodes(q.question.content).length).toBeGreaterThan(0)
      for (const o of q.question.options) expect(blockNodes(o.content).length).toBeGreaterThan(0)
      expect(answers.find((a) => a.questionId === q.id)?.status).toBe('final')
      expect(meaningfulRelations(q.relations).length).toBeGreaterThan(0)
    }
    expect(familySummary({ CSE: 72, PCS: 30, CDS: 47 })).toBe('CSE ×72 · PCS ×30 · CDS ×47')
  })
  it('neither distractors, incidental mentions nor comparison rows can earn mastery', () => {
    for (const role of ['distractor', 'incidental', 'comparison', 'supporting'] as const) {
      const r = { ...first.relations[0], placeId: 'bad', semanticRole: role, masteryEligible: true, locationInQuestion: 'stem' } as PlaceMention
      expect(eligiblePlaceIds({ ...first, relations: [r] })).toEqual([])
    }
    const q = { ...first, relations: [{ ...first.relations[0], placeId: 'good', semanticRole: 'primary', locationInQuestion: 'stem', masteryEligible: true, quizIncluded: true }] } as AtlasPyqQuestion
    const attempt = { ...pyqAttempt(q, answer, answer.correctOptions[0], 1000, '2026-10-01'), id: 'a', createdAt: 1000, updatedAt: 1000 }
    expect(computeMastery([attempt], '2026-10-01').get('good')?.level).toBe('familiar')
    expect(dueForReview(new Map(), computeMastery([attempt], '2026-10-01'), '2026-10-03').map((r) => r.id)).toEqual(['good'])
    expect(computeMastery([{ ...attempt, pyq: { ...attempt.pyq, eligiblePlaceIds: [] }, placeId: 'bad' }], '2026-10-01').size).toBe(0)
  })
  it('an unsuccessful first recall never claims travel', () => {
    const attempt = { ...pyqAttempt(first, answer, 'A', 1000, '2026-10-01'), correct: 0 as const, id: 'wrong', createdAt: 1000, updatedAt: 1000, pyq: { ...pyqAttempt(first, answer, 'A', 1000, '2026-10-01').pyq, eligiblePlaceIds: ['untravelled'] } }
    const mastery = computeMastery([attempt], '2026-10-01')
    expect(levelOf('untravelled', false, mastery)).toBe('discovered')
    expect(MASTERY_LABEL[levelOf('untravelled', false, mastery)]).toBe('Recall started')
  })
  it('correctness uses supplied alternatives and rejects an identity mismatch', () => {
    for (const key of ['A', 'B', 'C', 'D'] as const) expect(pyqAttempt(first, answer, key, 1, '2026-10-01').correct).toBe(answer.correctOptions.includes(key) ? 1 : 0)
    expect(() => pyqAttempt(first, { ...answer, questionId: 'wrong' }, 'A', 1, '2026-10-01')).toThrow()
  })
  it('an answer correction cannot reinterpret an existing attempt snapshot', () => {
    const supplied = { ...answer, correctOptions: [...answer.correctOptions] }
    const old = pyqAttempt(first, supplied, supplied.correctOptions[0], 1000, '2026-10-01')
    const before = structuredClone(old)
    supplied.correctOptions.splice(0, supplied.correctOptions.length, 'D')
    supplied.suppliedAnswerHash = 'corrected-hash'
    expect(old).toEqual(before)
    expect(old.correct).toBe(1)
  })
  it('publisher/PDF records and pages are absent from place references', () => {
    expect(geographicSources([{ title: 'UPPSC Question Papers pp. 3', url: 'pdf:book' }, { title: 'Workbook', url: 'https://example.com/book.pdf' }, { title: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Test', pages: [3] }])).toEqual([{ title: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Test' }])
  })
  it('v2 non-indexed attempts round-trip through backup, sync and tombstones without bodies', async () => {
    await db.delete(); await db.open()
    const r = await create('recalls', pyqAttempt(first, answer, 'A', Date.now(), '2026-10-01'))
    expect(db.verno).toBe(2)
    const backup = parseBackup(JSON.stringify(await createBackup()))
    await db.recalls.clear(); await restoreBackup(backup, 'replace')
    expect((await db.recalls.get(r.id))?.pyq).toEqual(r.pyq)
    expect((await changesSince(0)).records.recalls?.length).toBe(1)
    const changes = await changesSince(0)
    await db.recalls.clear()
    await applyChanges(changes)
    expect((await db.recalls.get(r.id))?.pyq).toEqual(r.pyq)
    await restoreBackup(backup, 'merge')
    expect(await db.recalls.count()).toBe(1)
    const legacy = await create('recalls', { placeId: 'legacy-place', type: 'fact', correct: 1, at: 1000, date: '2026-10-01', source: 'card' })
    expect(computeMastery([legacy], '2026-10-01').get('legacy-place')?.level).toBe('familiar')
    expect(JSON.stringify(r)).not.toContain('content')
    await remove('recalls', r.id)
    expect((await changesSince(0)).tombstones.some((t) => t.entityId === r.id)).toBe(true)
    await db.delete()
  })
})
