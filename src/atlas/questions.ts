/**
 * Recall questions, generated from the gazetteer's structure – positions,
 * states, rivers, ranges, borders and facts. Wrong options are plausible: the
 * same kind of feature, nearby or easily confused (Shipki La vs Lipulekh).
 */
import type { QuestionType } from '@/data/types'
import { hashString, seededRandom, shuffle } from '@/lib/random'
import type { AtlasData } from './data'
import type { MasteryMap } from './mastery'
import type { Place, PlaceKind, SheetId } from './types'

export interface Option {
  id: string
  label: string
}

export interface MapPin {
  id: string
  x: number
  y: number
  label?: string
}

export interface Question {
  key: string
  placeId: string
  type: QuestionType
  prompt: string
  /** Fact questions: the fact with the name masked. */
  clue?: string
  /** Choice questions. */
  options: Option[]
  answer: string
  /** Ordering questions: `options` are shown shuffled; `order` is the right sequence. */
  order?: string[]
  orderHint?: [string, string]
  map?: { sheet: SheetId; pins: MapPin[]; highlight?: string; focus: [number, number, number, number] }
  /** Shown after answering. */
  explain: string
}

export const TYPE_LABEL: Record<QuestionType, string> = {
  locate: 'Locate on the map',
  identify: 'Identify the place',
  state: 'State / country',
  river: 'River',
  relation: 'Connections',
  border: 'Borders',
  order: 'Put in order',
  fact: 'Fact recall',
}

const GROUPS: PlaceKind[][] = [
  ['peak', 'volcano'],
  ['lake', 'wetland'],
  ['capital', 'city'],
  ['island', 'cape'],
  ['strait', 'gulf', 'sea', 'canal'],
  ['plateau', 'plain', 'desert', 'valley', 'region', 'coast', 'delta', 'grassland'],
]
const groupOf = (k: PlaceKind) => GROUPS.find((g) => g.includes(k)) ?? [k]

const KIND_WORD: Partial<Record<PlaceKind, string>> = {
  pass: 'mountain pass',
  peak: 'peak',
  volcano: 'volcano',
  range: 'range',
  glacier: 'glacier',
  river: 'river',
  confluence: 'confluence',
  lake: 'lake',
  wetland: 'wetland',
  park: 'protected area',
  plateau: 'plateau',
  desert: 'desert',
  plain: 'plain',
  valley: 'valley',
  coast: 'coast',
  delta: 'delta',
  island: 'island',
  port: 'port',
  dam: 'dam',
  waterfall: 'waterfall',
  cape: 'cape',
  strait: 'strait',
  gulf: 'gulf or bay',
  sea: 'sea',
  canal: 'canal',
  monument: 'heritage site',
  grassland: 'grassland',
  capital: 'capital',
  city: 'city',
  region: 'region',
  strategic: 'strategic location',
  facility: 'facility',
}
export const kindWord = (k: PlaceKind) => KIND_WORD[k] ?? 'place'

const dist = (a: Place, b: Place) => Math.hypot(a.x - b.x, a.y - b.y)

/** Same-kind places near `p` (falls back to the kind's group), nearest first. */
function neighboursOfKind(atlas: AtlasData, p: Place, n: number, pool?: Place[]): Place[] {
  const same = (pool ?? atlas.bySheet[p.sheet]).filter((q) => q.id !== p.id && q.kind === p.kind && q.name !== p.name)
  const group = groupOf(p.kind)
  const wider = same.length >= n ? same : [...same, ...(pool ?? atlas.bySheet[p.sheet]).filter((q) => q.id !== p.id && q.kind !== p.kind && group.includes(q.kind) && q.name !== p.name)]
  return wider.sort((a, b) => dist(a, p) - dist(b, p)).slice(0, n)
}

/** Pick `k` distractors from the nearest `span`, deterministically for this key. */
function distractors(atlas: AtlasData, p: Place, k: number, rand: () => number, span = 9): Place[] {
  return shuffle(rand, neighboursOfKind(atlas, p, span)).slice(0, k)
}

function bounds(pins: MapPin[], pad: number): [number, number, number, number] {
  const xs = pins.map((p) => p.x)
  const ys = pins.map((p) => p.y)
  return [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad]
}

const LETTERS = ['A', 'B', 'C', 'D']
const where = (atlas: AtlasData, p: Place) =>
  p.states?.length ? p.states.map((s) => atlas.state(s)?.name ?? s).join(', ') : (p.countries ?? []).map((c) => atlas.country(c)?.name ?? c).join(', ')
const firstFact = (p: Place) => p.facts[0] ?? ''

type Gen = (atlas: AtlasData, p: Place, rand: () => number) => Omit<Question, 'key' | 'placeId' | 'type'> | null

const GENERATORS: Record<QuestionType, Gen> = {
  locate(atlas, p, rand) {
    const others = distractors(atlas, p, 3, rand, 8)
    if (others.length < 3) return null
    const pins = shuffle(rand, [p, ...others]).map((q, i) => ({ id: q.id, x: q.x, y: q.y, label: LETTERS[i] }))
    return {
      prompt: `Where is ${p.name}?`,
      options: pins.map((pin) => ({ id: pin.id, label: pin.label! })),
      answer: p.id,
      map: { sheet: p.sheet, pins, focus: bounds(pins, p.sheet === 'india' ? 70 : 90) },
      explain: `${p.name} is marked ${pins.find((x) => x.id === p.id)!.label}. ${firstFact(p)}`,
    }
  },
  identify(atlas, p, rand) {
    const others = distractors(atlas, p, 3, rand)
    if (others.length < 3) return null
    const opts = shuffle(rand, [p, ...others])
    const near = neighboursOfKind(atlas, p, 3)
    const pins = [{ id: p.id, x: p.x, y: p.y }]
    return {
      prompt: `Which ${kindWord(p.kind)} is marked on the map?`,
      options: opts.map((q) => ({ id: q.id, label: q.name })),
      answer: p.id,
      map: { sheet: p.sheet, pins, highlight: p.id, focus: bounds([...pins, ...near.map((q) => ({ id: q.id, x: q.x, y: q.y }))], 60) },
      explain: `It is ${p.name}. ${firstFact(p)}`,
    }
  },
  state(atlas, p, rand) {
    if (p.sheet === 'india' && p.states?.length) {
      const own = new Set(p.states)
      if (p.states.length === 1) {
        const s = p.states[0]
        const nb = (atlas.state(s)?.neighbours ?? []).filter((x) => !own.has(x))
        const pool = [...shuffle(rand, nb), ...shuffle(rand, atlas.states.map((x) => x.id).filter((x) => !own.has(x) && !nb.includes(x)))]
        const opts = shuffle(rand, [s, ...pool.slice(0, 3)])
        return {
          prompt: `${p.name} is in which state or union territory?`,
          options: opts.map((id) => ({ id, label: atlas.state(id)?.name ?? id })),
          answer: s,
          explain: `${p.name} is in ${atlas.state(s)?.name}. ${firstFact(p)}`,
        }
      }
      // Multi-state features: which of these does it pass through?
      const answer = p.states[Math.floor(rand() * p.states.length)]
      const nb = [...new Set(p.states.flatMap((s) => atlas.state(s)?.neighbours ?? []))].filter((x) => !own.has(x))
      if (nb.length < 3) return null
      const opts = shuffle(rand, [answer, ...shuffle(rand, nb).slice(0, 3)])
      const verb = p.kind === 'river' ? 'flows through' : 'extends into'
      return {
        prompt: `Which of these does the ${p.name} ${verb}?`,
        options: opts.map((id) => ({ id, label: atlas.state(id)?.name ?? id })),
        answer,
        explain: `The ${p.name} ${verb} ${where(atlas, p)}.`,
      }
    }
    const iso = p.countries?.length === 1 ? p.countries[0] : null
    if (!iso) return null
    const nb = atlas.country(iso)?.neighbours ?? []
    const pool = [...shuffle(rand, nb), ...shuffle(rand, ['CHN', 'IND', 'PAK', 'NPL', 'USA', 'BRA', 'RUS', 'AUS', 'EGY', 'ZAF', 'ARG', 'IRN', 'TUR'])].filter((x, i, a) => x !== iso && a.indexOf(x) === i && atlas.country(x))
    const opts = shuffle(rand, [iso, ...pool.slice(0, 3)])
    return {
      prompt: `${p.name} is in which country?`,
      options: opts.map((id) => ({ id, label: atlas.country(id)?.name ?? id })),
      answer: iso,
      explain: `${p.name} is in ${atlas.country(iso)?.name}. ${firstFact(p)}`,
    }
  },
  river(atlas, p, rand) {
    const rivers = p.rel?.onRiver?.map((r) => atlas.byId.get(r)).filter((r): r is Place => !!r && r.kind === 'river')
    if (!rivers?.length) return null
    const answer = rivers[0]
    const pool = neighboursOfKind(atlas, answer, 10).filter((r) => !rivers.some((x) => x.id === r.id))
    if (pool.length < 3) return null
    const opts = shuffle(rand, [answer, ...shuffle(rand, pool).slice(0, 3)])
    const noun = p.kind === 'dam' ? `${p.name} is built on` : p.kind === 'waterfall' ? `${p.name} is on` : `${p.name} lies on`
    return {
      prompt: `${noun} which river?`,
      options: opts.map((q) => ({ id: q.id, label: q.name })),
      answer: answer.id,
      explain: `${noun} the ${answer.name}. ${firstFact(p)}`,
    }
  },
  relation(atlas, p, rand) {
    const rel = p.rel ?? {}
    const pickTarget = (): [Place, string] | null => {
      if (rel.tributaryOf) {
        const t = atlas.byId.get(rel.tributaryOf)
        if (t) return [t, `The ${p.name} is a ${rel.bank ? `${rel.bank}-bank ` : ''}tributary of which river?`]
      }
      if (rel.distributaryOf) {
        const t = atlas.byId.get(rel.distributaryOf)
        if (t) return [t, `The ${p.name} is a distributary of which river?`]
      }
      if (rel.range) {
        const t = atlas.byId.get(rel.range)
        if (t) return [t, `${p.name} is in which range?`]
      }
      if (rel.source) {
        const t = atlas.byId.get(rel.source)
        if (t) return [t, `Where does the ${p.name} rise?`]
      }
      if (rel.flowsInto) {
        const t = atlas.byId.get(rel.flowsInto)
        if (t) return [t, `Where does the ${p.name} end?`]
      }
      if (rel.within) {
        const t = atlas.byId.get(rel.within)
        if (t) return [t, `${p.name} lies within which feature?`]
      }
      return null
    }
    const hit = pickTarget()
    if (hit) {
      const [t, prompt] = hit
      const pool = neighboursOfKind(atlas, t, 8)
      if (pool.length < 3) return null
      const opts = shuffle(rand, [t, ...shuffle(rand, pool).slice(0, 3)])
      return { prompt, options: opts.map((q) => ({ id: q.id, label: q.name })), answer: t.id, explain: `${t.name}. ${firstFact(p)}` }
    }
    // Reverse: which of these is a tributary of / lies on this river?
    const back = atlas.referencedBy.get(p.id)?.filter((r) => r.key === 'tributaryOf')
    if (p.kind === 'river' && back?.length) {
      const answer = back[Math.floor(rand() * back.length)].place
      const pool = neighboursOfKind(atlas, answer, 10).filter((q) => q.rel?.tributaryOf !== p.id && q.id !== p.id)
      if (pool.length < 3) return null
      const opts = shuffle(rand, [answer, ...shuffle(rand, pool).slice(0, 3)])
      return {
        prompt: `Which of these is a tributary of the ${p.name}?`,
        options: opts.map((q) => ({ id: q.id, label: q.name })),
        answer: answer.id,
        explain: `The ${answer.name} joins the ${p.name}. ${firstFact(answer)}`,
      }
    }
    return null
  },
  border(atlas, p, rand) {
    const iso = p.rel?.border?.[0]
    if (!iso) return null
    const pool = ['CHN', 'PAK', 'NPL', 'BTN', 'MMR', 'BGD', 'AFG', 'LKA'].filter((c) => !p.rel!.border!.includes(c))
    const opts = shuffle(rand, [iso, ...shuffle(rand, pool).slice(0, 3)])
    return {
      prompt: `${p.name} is on India’s border with which country?`,
      options: opts.map((id) => ({ id, label: atlas.country(id)?.name ?? id })),
      answer: iso,
      explain: `${p.name} leads to ${p.rel!.border!.map((c) => atlas.country(c)?.name ?? c).join(' and ')}. ${firstFact(p)}`,
    }
  },
  order(atlas, p, rand) {
    // Rivers: states from source to mouth.
    if (p.kind === 'river' && (p.states?.length ?? 0) >= 3) {
      const seq = p.states!.slice(0, 5)
      return {
        prompt: `Put these in order along the ${p.name}, from source to mouth.`,
        options: shuffle(rand, seq).map((id) => ({ id, label: atlas.state(id)?.name ?? id })),
        answer: seq.join(','),
        order: seq,
        orderHint: ['Source', 'Mouth'],
        explain: `Source to mouth: ${seq.map((s) => atlas.state(s)?.name).join(' → ')}.`,
      }
    }
    // Peaks: by height.
    if ((p.kind === 'peak' || p.kind === 'pass') && p.elevation) {
      const others = neighboursOfKind(atlas, p, 10).filter((q) => q.elevation && Math.abs(q.elevation - p.elevation!) > 60)
      if (others.length >= 2) {
        const set = [p, ...shuffle(rand, others).slice(0, 3)].sort((a, b) => b.elevation! - a.elevation!)
        return {
          prompt: `Order these ${kindWord(p.kind)}${p.kind === 'pass' ? 'es' : 's'} from highest to lowest.`,
          options: shuffle(rand, set).map((q) => ({ id: q.id, label: q.name })),
          answer: set.map((q) => q.id).join(','),
          order: set.map((q) => q.id),
          orderHint: ['Highest', 'Lowest'],
          explain: set.map((q) => `${q.name} ${q.elevation!.toLocaleString('en-IN')} m`).join(' · '),
        }
      }
    }
    // Anything else: west to east.
    const others = neighboursOfKind(atlas, p, 8).filter((q) => Math.abs(q.lon - p.lon) > 0.4)
    if (others.length < 2) return null
    const set = [p, ...shuffle(rand, others).slice(0, 3)]
    const uniq = set.filter((q, i) => set.findIndex((x) => Math.abs(x.lon - q.lon) < 0.3) === i).sort((a, b) => a.lon - b.lon)
    if (uniq.length < 3) return null
    return {
      prompt: `Order these from west to east.`,
      options: shuffle(rand, uniq).map((q) => ({ id: q.id, label: q.name })),
      answer: uniq.map((q) => q.id).join(','),
      order: uniq.map((q) => q.id),
      orderHint: ['West', 'East'],
      explain: `West to east: ${uniq.map((q) => q.name).join(' → ')}.`,
    }
  },
  fact(atlas, p, rand) {
    const names = [p.name, ...(p.aka ?? [])].sort((a, b) => b.length - a.length)
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const facts = shuffle(rand, p.facts)
    for (const f of facts) {
      let masked = f
      for (const n of names) masked = masked.replace(new RegExp(escape(n), 'gi'), '▢▢▢')
      // Skip facts that still give the answer away.
      const words = p.name.split(/[\s-]+/).filter((w) => w.length > 3 && !/^(lake|river|dam|falls|national|park|pass|peak|mount|island|glacier|valley|plateau|hills|range|gulf|bay|strait|sea|port|tiger|reserve|sanctuary|temple|caves|fort)$/i.test(w))
      if (words.some((w) => new RegExp(`\\b${escape(w)}\\b`, 'i').test(masked))) continue
      if (!masked.includes('▢▢▢') && masked.length < 30) continue
      const others = distractors(atlas, p, 3, rand, 12)
      if (others.length < 3) return null
      const opts = shuffle(rand, [p, ...others])
      return {
        prompt: `Which ${kindWord(p.kind)} is this?`,
        options: opts.map((q) => ({ id: q.id, label: q.name })),
        answer: p.id,
        clue: masked,
        explain: f,
      }
    }
    return null
  },
}

/** Question types that can be asked about this place. */
export function availableTypes(atlas: AtlasData, p: Place): QuestionType[] {
  return (Object.keys(GENERATORS) as QuestionType[]).filter((t) => GENERATORS[t](atlas, p, seededRandom(1)) !== null)
}

/**
 * Build a question about `p`. Prefers types the place still needs for its next
 * mastery step (a second type for Strong, a spatial one for Mastered) and
 * avoids repeating the last type used.
 */
export function makeQuestion(atlas: AtlasData, p: Place, mastery: MasteryMap, seed: string, prefer?: QuestionType): Question | null {
  const rand = seededRandom(hashString(`${p.id}:${seed}`))
  const m = mastery.get(p.id)
  const have = m?.types ?? new Set<QuestionType>()
  const order: QuestionType[] = shuffle(rand, ['locate', 'identify', 'state', 'river', 'relation', 'border', 'order', 'fact'] as QuestionType[])
  const score = (t: QuestionType) => {
    let s = rand()
    if (t === prefer) s += 10
    if (!have.has(t)) s += 1.5
    if ((t === 'locate' || t === 'order') && !have.has('locate') && !have.has('order') && (m?.correct ?? 0) >= 2) s += 3
    if (t === 'locate' || t === 'identify') s += 0.6 // the map is the point
    return s
  }
  for (const t of order.sort((a, b) => score(b) - score(a))) {
    const q = GENERATORS[t](atlas, p, rand)
    if (q) return { ...q, key: `${p.id}:${t}:${seed}`, placeId: p.id, type: t }
  }
  return null
}

export function isCorrect(q: Question, answer: string | string[]): boolean {
  if (q.order) return (Array.isArray(answer) ? answer : answer.split(',')).join(',') === q.order.join(',')
  return answer === q.answer
}
