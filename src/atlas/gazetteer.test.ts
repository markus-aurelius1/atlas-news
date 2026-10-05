/** Integrity checks on the compiled gazetteer (public/atlas/v1/places.json). */
import { describe, expect, it } from 'vitest'
import { indexAtlas } from './data'
import { livingRefs } from './living'
import { computeMastery } from './mastery'
import { availableTypes, isCorrect, makeQuestion } from './questions'
import type { PlacesFile } from './types'
import raw from '../../public/atlas/v1/places.json?raw'

const file = JSON.parse(raw) as PlacesFile
const atlas = indexAtlas(file)

describe('gazetteer', () => {
  it('has the planned depth, with unique ids and facts for every place', () => {
    expect(atlas.bySheet.india.length).toBeGreaterThanOrEqual(450)
    expect(atlas.bySheet.world.length).toBeGreaterThanOrEqual(150)
    expect(new Set(file.places.map((p) => p.id)).size).toBe(file.places.length)
    for (const p of file.places) expect(p.facts.length, p.id).toBeGreaterThan(0)
    expect(file.states).toHaveLength(36)
  })

  it('covers every state and UT with places', () => {
    for (const s of file.states) expect(atlas.inUnit.get(s.id)?.length ?? 0, s.id).toBeGreaterThan(0)
  })

  it('refers only to places that exist', () => {
    for (const id of livingRefs()) expect(atlas.byId.has(id), id).toBe(true)
    for (const p of file.places)
      for (const v of Object.values(p.rel ?? {}))
        for (const ref of Array.isArray(v) ? v : [v]) if (typeof ref === 'string' && /^(in|w)\./.test(ref)) expect(atlas.byId.has(ref), `${p.id} → ${ref}`).toBe(true)
  })

  it('can ask a question about nearly every place, with a correct answer among the options', () => {
    const m = computeMastery([], '2026-09-24')
    let asked = 0
    for (const p of file.places) {
      const q = makeQuestion(atlas, p, m, 'test')
      if (!q) continue
      asked++
      if (q.order) expect(isCorrect(q, q.order)).toBe(true)
      else expect(q.options.map((o) => o.id)).toContain(q.answer)
    }
    expect(asked / file.places.length).toBeGreaterThan(0.97)
    // Most places support several kinds of question.
    const multi = file.places.filter((p) => availableTypes(atlas, p).length >= 3).length
    expect(multi / file.places.length).toBeGreaterThan(0.8)
  }, 30_000)
})
