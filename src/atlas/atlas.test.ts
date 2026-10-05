import { describe, expect, it } from 'vitest'
import type { RecallAttempt } from '@/data/types'
import { recallXp, levelInfo } from '@/game/progression'
import { indexAtlas } from './data'
import { explore } from './explore'
import { computeMastery, dueForReview } from './mastery'
import { isCorrect, makeQuestion } from './questions'
import type { Place, PlacesFile } from './types'

const place = (id: string, kind: Place['kind'], x: number, y: number, extra: Partial<Place> = {}): Place => ({
  id,
  name: id.split('.').pop()!.replace(/-/g, ' '),
  kind,
  sheet: 'india',
  x,
  y,
  lon: 70 + x / 100,
  lat: 30 - y / 100,
  facts: [`${id} fact about somewhere.`],
  level: 2,
  unit: extra.unit ?? 'a',
  states: [extra.unit ?? 'a'],
  ...extra,
})

const FILE: PlacesFile = {
  version: 1,
  places: [
    place('in.pass.one', 'pass', 10, 10, { elevation: 4000, rel: { border: ['CHN'] } }),
    place('in.pass.two', 'pass', 20, 10, { elevation: 4500 }),
    place('in.pass.three', 'pass', 30, 12, { elevation: 5000 }),
    place('in.pass.four', 'pass', 40, 15, { unit: 'b', elevation: 3000 }),
    place('in.pass.five', 'pass', 50, 18, { unit: 'b', elevation: 3500 }),
    place('in.river.big', 'river', 60, 30, { states: ['a', 'b', 'c'], unit: 'b' }),
    place('in.river.small', 'river', 65, 35, { unit: 'c', rel: { tributaryOf: 'in.river.big' } }),
    place('in.river.other', 'river', 90, 35, { unit: 'c' }),
    place('in.river.fourth', 'river', 95, 45, { unit: 'c' }),
    place('in.dam.d', 'dam', 70, 40, { unit: 'c', rel: { onRiver: ['in.river.small'] } }),
  ],
  states: [
    { id: 'a', name: 'A', type: 'state', capital: '', region: '', fact: '', neighbours: ['b'], borderCountries: [], coastal: false },
    { id: 'b', name: 'B', type: 'state', capital: '', region: '', fact: '', neighbours: ['a', 'c'], borderCountries: [], coastal: false },
    { id: 'c', name: 'C', type: 'state', capital: '', region: '', fact: '', neighbours: ['b'], borderCountries: [], coastal: false },
    { id: 'delhi', name: 'Delhi', type: 'ut', capital: '', region: '', fact: '', neighbours: [], borderCountries: [], coastal: false },
  ],
  regions: [],
  countries: [{ id: 'chn', name: 'China', iso: 'CHN', continent: 'Asia', neighbours: [] }],
}
const atlas = indexAtlas(FILE)

const recall = (placeId: string, day: number, correct: boolean, type: RecallAttempt['type'] = 'state'): RecallAttempt => {
  const at = Date.parse('2026-09-01T12:00:00') + day * 86_400_000
  return { id: placeId + day + type + Math.random(), createdAt: 0, updatedAt: 0, placeId, type, correct: correct ? 1 : 0, at, date: new Date(at).toISOString().slice(0, 10), source: 'review' }
}
describe('progression', () => {
  it('caps recall XP per day', () => {
    const many = Array.from({ length: 40 }, () => recall('in.pass.one', 0, true))
    expect(recallXp([...many, recall('in.pass.one', 1, true)])).toBe(31)
  })
  it('maps XP to levels and explorer ranks', () => {
    expect(levelInfo(0).level).toBe(1)
    expect(levelInfo(120).level).toBe(3)
    expect(levelInfo(6000).rank.title).toBe('Navigator')
  })
})

describe('mastery', () => {
  it('climbs from familiar to strong to mastered only through recall', () => {
    let m = computeMastery([recall('p', 0, true)], '2026-09-01').get('p')!
    expect(m.level).toBe('familiar')
    m = computeMastery([recall('p', 0, true), recall('p', 0, true, 'fact'), recall('p', 0, true)], '2026-09-01').get('p')!
    expect(m.level).toBe('familiar') // all on one day
    m = computeMastery([recall('p', 0, true), recall('p', 1, true, 'fact'), recall('p', 3, true)], '2026-09-04').get('p')!
    expect(m.level).toBe('strong')
    const five = [recall('p', 0, true), recall('p', 1, true, 'fact'), recall('p', 3, true), recall('p', 6, true, 'locate'), recall('p', 9, true)]
    expect(computeMastery(five, '2026-09-10').get('p')!.level).toBe('mastered')
    expect(computeMastery([...five, recall('p', 10, false), recall('p', 10, false)], '2026-09-11').get('p')!.level).toBe('strong')
  })
  it('schedules reviews on 1/3/7 day boxes and resets on a miss', () => {
    const m = computeMastery([recall('p', 0, true), recall('p', 1, true)], '2026-09-02').get('p')!
    expect(m.box).toBe(2)
    expect(m.due).toBe('2026-09-05')
    const miss = computeMastery([recall('p', 0, true), recall('p', 1, false)], '2026-09-02').get('p')!
    expect(miss.box).toBe(0)
    expect(miss.due).toBe('2026-09-03')
  })
  it('queues overdue reviews before untested discoveries', () => {
    const mastery = computeMastery([recall('p', 0, true)], '2026-09-10')
    const due = dueForReview(new Map([['p', { at: 1 }], ['q', { at: 2 }]]), mastery, '2026-09-10')
    expect(due.map((d) => d.id)).toEqual(['p', 'q'])
  })
  it('introduces new places by study priority when scores exist, else most recent first', () => {
    const found = new Map([['a', { at: 1 }], ['b', { at: 2 }], ['c', { at: 3 }]])
    const none = computeMastery([], '2026-09-10')
    expect(dueForReview(found, none, '2026-09-10').map((d) => d.id)).toEqual(['c', 'b', 'a'])
    const score: Record<string, number> = { a: 80, b: 20 }
    expect(dueForReview(found, none, '2026-09-10', (id) => score[id] ?? 0).map((d) => d.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('recall coverage', () => {
  it('starts with no earned progress and learns only known recalled places', () => {
    expect(explore({ atlas, familiarAt: new Map() }).discovered.size).toBe(0)
    const state = explore({ atlas, familiarAt: new Map([['in.pass.one', 10], ['missing', 20]]) })
    expect([...state.discovered]).toEqual([['in.pass.one', { at: 10, via: 'recall' }]])
    expect([...state.explored]).toEqual(['a'])
  })
})

describe('questions', () => {
  it('builds answerable questions with plausible options', () => {
    const m = computeMastery([], '2026-09-01')
    for (const id of ['in.pass.one', 'in.river.small', 'in.dam.d', 'in.river.big']) {
      const q = makeQuestion(atlas, atlas.byId.get(id)!, m, 'seed')
      expect(q).not.toBeNull()
      if (q!.order) expect(isCorrect(q!, q!.order)).toBe(true)
      else {
        expect(q!.options.some((o) => o.id === q!.answer)).toBe(true)
        expect(new Set(q!.options.map((o) => o.id)).size).toBe(q!.options.length)
      }
    }
    const border = makeQuestion(atlas, atlas.byId.get('in.pass.one')!, m, 's', 'border')!
    expect(border.type).toBe('border')
    expect(border.answer).toBe('CHN')
    const river = makeQuestion(atlas, atlas.byId.get('in.dam.d')!, m, 's', 'river')!
    expect(river.answer).toBe('in.river.small')
    const order = makeQuestion(atlas, atlas.byId.get('in.river.big')!, m, 's', 'order')!
    expect(order.order).toEqual(['a', 'b', 'c'])
  })
})
