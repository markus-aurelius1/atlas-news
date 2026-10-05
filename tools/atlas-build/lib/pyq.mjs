/**
 * Previous-year questions (PYQs) → per-place exam history and a study-priority
 * score. Pure functions, no dependencies, so they are easy to test.
 *
 * Input is the ledger in content/pyq/: one entry per question appearance,
 * always with its source. Nothing here invents appearances or years: a place
 * gets `pyq` only from ledger entries that name it.
 *
 * The priority score is an interpretable STUDY HEURISTIC, not a prediction of
 * future questions. Every place that gets a score also gets the parts and the
 * plain-language reasons it was built from, so the app can show why.
 */

// ── names ─────────────────────────────────────────────────────────────────

/** Descriptor words that are not part of a place's identity ("Chilika Lake" ≈ "Chilika"). */
const GENERIC = new Set([
  'the', 'of', 'lake', 'lakes', 'river', 'national', 'park', 'np', 'wildlife', 'sanctuary', 'ws', 'bird', 'tiger', 'reserve',
  'biosphere', 'wetland', 'wetlands', 'mount', 'mt', 'hills', 'hill', 'range', 'mountains', 'falls', 'waterfall', 'dam',
  'reservoir', 'port', 'island', 'islands', 'gulf', 'bay', 'strait', 'plateau', 'valley', 'glacier', 'desert', 'delta', 'pass',
  'city', 'district', 'state', 'town', 'fort',
])

/** Lower-case, accents and punctuation removed, "&" → "and", single spaces. */
export function normalizeName(s) {
  return String(s)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** The identifying core of a name, without descriptor words. Empty when the name is only descriptors. */
export function coreName(s) {
  return normalizeName(s)
    .split(' ')
    .filter((w) => w && !GENERIC.has(w))
    .join(' ')
}

/**
 * Index every place under its id, its name and each alias (full and core
 * forms). Later lookups prefer an exact id, then a full-name match, then a
 * core-name match.
 */
export function buildAliasIndex(places) {
  const byId = new Map(places.map((p) => [p.id, p]))
  const full = new Map()
  const core = new Map()
  const add = (map, key, id) => {
    if (!key) return
    const list = map.get(key)
    if (!list) map.set(key, [id])
    else if (!list.includes(id)) list.push(id)
  }
  for (const p of places) {
    for (const n of [p.name, ...(p.aka ?? [])]) {
      add(full, normalizeName(n), p.id)
      add(core, coreName(n), p.id)
    }
  }
  return { byId, full, core }
}

/**
 * Resolve a ledger reference to one place id.
 * `ref` is a place id (`in.lake.chilika`), a name/alias, or
 * `{ name, kind?, sheet?, state? }` to settle ambiguous names.
 * Returns `{ id }` (plus `also` for the same place drawn on the other sheet,
 * e.g. New Delhi on both India and World), `{ ambiguous: ids }` or `{ missing: true }`.
 */
export function resolveRef(index, ref) {
  const r = typeof ref === 'string' ? { name: ref } : ref
  if (r.id) return index.byId.has(r.id) ? { id: r.id } : { missing: true }
  if (index.byId.has(r.name)) return { id: r.name }
  const narrow = (ids) => {
    let out = ids
    if (r.kind) out = out.filter((id) => index.byId.get(id).kind === r.kind)
    if (r.sheet) out = out.filter((id) => index.byId.get(id).sheet === r.sheet)
    if (r.state) out = out.filter((id) => (index.byId.get(id).states ?? []).includes(r.state) || (index.byId.get(id).countries ?? []).includes(r.state))
    return out
  }
  for (const [map, key] of [
    [index.full, normalizeName(r.name)],
    [index.core, coreName(r.name)],
  ]) {
    const ids = key ? narrow(map.get(key) ?? []) : []
    if (ids.length === 1) return { id: ids[0] }
    if (ids.length > 1) {
      // One real place drawn on both sheets: same name and kind, one per sheet.
      const ps = ids.map((id) => index.byId.get(id))
      const twins = new Set(ps.map((p) => p.sheet)).size === ps.length && ps.every((p) => p.kind === ps[0].kind && normalizeName(p.name) === normalizeName(ps[0].name))
      return twins ? { id: ids[0], also: ids.slice(1) } : { ambiguous: ids }
    }
  }
  return { missing: true }
}

// ── ledger → per-place history ────────────────────────────────────────────

/** Check one ledger entry; returns a list of problems (empty when fine). */
export function validateEntry(e) {
  const problems = []
  if (!e || typeof e !== 'object') return ['not an object']
  if (!e.exam || typeof e.exam !== 'string') problems.push('exam missing')
  if (!Number.isInteger(e.year) || e.year < 1950 || e.year > 2100) problems.push('year must be a four-digit integer')
  if (!e.q || typeof e.q !== 'string') problems.push('q (the question, or enough of it to identify it) is required')
  if (!Array.isArray(e.places) || e.places.length === 0) problems.push('places must name at least one place')
  if (!e.source || typeof e.source.url !== 'string' || !/^https?:\/\/|^pdf:/.test(e.source.url)) problems.push('source.url (http(s) link or pdf:<file>#page) is required')
  return problems
}

/**
 * Attach `pyq: { count, years, exams, topics, sources }` to every place a
 * ledger entry names. `count` is the number of distinct questions (exam +
 * year + question text), so an entry recorded twice is counted once.
 * Returns what could not be matched, for review.
 */
export function attachPyq(places, ledger) {
  const index = buildAliasIndex(places)
  const unmatched = []
  const ambiguous = []
  const invalid = []
  const hist = new Map() // id → { keys:Set, years:Set, exams:Set, topics:Set, sources:Map }
  for (const e of ledger) {
    const problems = validateEntry(e)
    if (problems.length) {
      invalid.push({ entry: e, problems })
      continue
    }
    const key = `${e.exam}|${e.year}|${normalizeName(e.q)}`
    for (const ref of e.places) {
      const r = resolveRef(index, ref)
      if (r.missing) {
        unmatched.push({ ref, exam: e.exam, year: e.year, source: e.source.url })
        continue
      }
      if (r.ambiguous) {
        ambiguous.push({ ref, candidates: r.ambiguous, exam: e.exam, year: e.year })
        continue
      }
      for (const id of [r.id, ...(r.also ?? [])]) {
        let h = hist.get(id)
        if (!h) hist.set(id, (h = { keys: new Set(), years: new Set(), exams: new Set(), topics: new Set(), sources: new Map() }))
        h.keys.add(key)
        h.years.add(e.year)
        h.exams.add(e.exam)
        for (const t of [].concat(e.topic ?? [])) h.topics.add(t)
        // Pages of one PDF are grouped into a single source: `pdf:<file>` with its pages.
        const pdf = /^(pdf:[^#]+)#p(\d+)$/.exec(e.source.url)
        const srcKey = pdf ? pdf[1] : e.source.url
        if (!h.sources.has(srcKey)) h.sources.set(srcKey, { title: e.source.title ?? srcKey, url: srcKey, ...(pdf ? { pages: [] } : {}) })
        const s = h.sources.get(srcKey)
        if (pdf && !s.pages.includes(Number(pdf[2]))) s.pages.push(Number(pdf[2]))
      }
    }
  }
  for (const p of places) {
    const h = hist.get(p.id)
    if (!h) continue
    p.pyq = {
      count: h.keys.size,
      years: [...h.years].sort((a, b) => a - b),
      exams: [...h.exams].sort(),
      topics: [...h.topics].sort(),
      sources: [...h.sources.values()].map((s) => (s.pages ? { ...s, pages: s.pages.sort((a, b) => a - b) } : s)),
    }
  }
  return { matched: hist.size, unmatched, ambiguous, invalid }
}

// ── the study-priority score ──────────────────────────────────────────────

/** Weights of each part (they sum to 1). Kept in the output so the app can explain the score. */
export const YIELD_WEIGHTS = { frequency: 0.3, recurrence: 0.15, recency: 0.15, importance: 0.2, density: 0.1, gap: 0.1 }

export const YIELD_NOTE =
  'A study-priority heuristic built from past papers (how often, how many different years and how recently a place was asked), how central the place is to the syllabus, and how connected it is to other asked places. It is not a prediction of future questions.'

/** Recency half-life in years: a place asked this many years before the latest paper counts half as recent. */
const RECENCY_HALF_LIFE = 6

const KEY_TAGS = { ramsar: 'Ramsar site', 'tiger-reserve': 'Tiger reserve', 'world-heritage': 'World Heritage site', biosphere: 'Biosphere reserve', national: 'National capital' }
const LEVEL_IMPORTANCE = { 1: 0.8, 2: 0.5, 3: 0.25 }
const LEVEL_NAME = { 1: 'Core syllabus place', 2: 'Standard syllabus place', 3: 'Advanced place' }

export function bandOf(score) {
  return score >= 65 ? 'core' : score >= 45 ? 'high' : score >= 25 ? 'medium' : 'low'
}

/** Ids a place's relations point to (rivers, ranges, borders, `near`…). */
function relatedIds(p, byId) {
  const out = new Set()
  const visit = (v) => {
    if (typeof v === 'string') {
      if (byId.has(v)) out.add(v)
    } else if (Array.isArray(v)) v.forEach(visit)
  }
  for (const v of Object.values(p.rel ?? {})) visit(v)
  out.delete(p.id)
  return out
}

const r2 = (n) => Math.round(n * 100) / 100
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`

/**
 * Score every place: `yield: { score 0–100, band, parts, reasons }`.
 * `refYear` anchors recency (default: the latest year in the ledger), so the
 * output only changes when the data does.
 */
export function scorePlaces(places, { refYear } = {}) {
  const byId = new Map(places.map((p) => [p.id, p]))
  const latest = refYear ?? Math.max(0, ...places.flatMap((p) => p.pyq?.years ?? []))
  // Undirected links between places.
  const links = new Map(places.map((p) => [p.id, new Set()]))
  for (const p of places)
    for (const q of relatedIds(p, byId)) {
      links.get(p.id).add(q)
      links.get(q).add(p.id)
    }

  for (const p of places) {
    const n = p.pyq?.count ?? 0
    const years = p.pyq?.years ?? []
    const frequency = 1 - Math.exp(-n / 2)
    const recurrence = years.length > 1 ? Math.min(1, (years.length - 1) / 3) : 0
    const recency = years.length ? Math.pow(0.5, Math.max(0, latest - years[years.length - 1]) / RECENCY_HALF_LIFE) : 0
    const tags = (p.tags ?? []).filter((t) => KEY_TAGS[t])
    const importance = Math.min(1, (LEVEL_IMPORTANCE[p.level] ?? 0.5) + (tags.length ? 0.2 : 0))
    const linked = links.get(p.id)
    const askedLinks = [...linked].filter((id) => byId.get(id).pyq).length
    const density = Math.min(1, (linked.size + 2 * askedLinks) / 10)
    const gap = n <= 1 ? importance * (1 - frequency) : 0

    const parts = { frequency: r2(frequency), recurrence: r2(recurrence), recency: r2(recency), importance: r2(importance), density: r2(density), gap: r2(gap) }
    const score = Math.round(100 * Object.entries(YIELD_WEIGHTS).reduce((s, [k, w]) => s + w * parts[k], 0))

    const reasons = []
    if (n) {
      const exams = p.pyq.exams.join(', ')
      reasons.push(`Asked ${n}× in ${exams} (${years.join(', ')})`)
      if (years.length > 1) reasons.push(`Recurs across ${plural(years.length, 'year')}`)
      reasons.push(`Last asked ${years[years.length - 1]}`)
    }
    reasons.push(LEVEL_NAME[p.level] ?? 'Syllabus place')
    for (const t of tags) reasons.push(KEY_TAGS[t])
    if (linked.size >= 3 || askedLinks) reasons.push(`Linked to ${plural(linked.size, 'place')}${askedLinks ? `, ${askedLinks} of them asked` : ''}`)
    if (gap >= 0.3) reasons.push(n ? 'Important but asked only once in the collected papers' : 'Important but not yet seen in the collected papers')

    p.yield = { score, band: bandOf(score), parts, reasons }
  }
  return { refYear: latest }
}

/**
 * Split unmatched references into those deliberately left out of the atlas
 * (listed in content/pyq/not-mapped.mjs with a reason) and those still open.
 */
export function explainUnmatched(unmatched, notMapped) {
  const explained = []
  const open = []
  for (const u of unmatched) {
    const name = typeof u.ref === 'string' ? u.ref : u.ref?.name
    if (name && Object.hasOwn(notMapped, name)) explained.push({ ...u, reason: notMapped[name] })
    else open.push(u)
  }
  return { unmatched: open, explained }
}

/**
 * The whole PYQ step for the build. With an empty ledger nothing is attached
 * and nothing is scored (no claims are made without data).
 */
export function applyPyq(places, ledger, opts = {}) {
  if (!ledger.length) return { applied: false, matched: 0, unmatched: [], ambiguous: [], invalid: [] }
  const res = attachPyq(places, ledger)
  const { refYear } = scorePlaces(places, opts)
  return { applied: true, ...res, model: { weights: YIELD_WEIGHTS, note: YIELD_NOTE, refYear, recencyHalfLifeYears: RECENCY_HALF_LIFE } }
}
