import { expect, it } from 'vitest'
import { chooseRepresentative, selectReading, type QualifiedArticle } from './selection'
import { classifySubject } from './subject'
import { storyFrame, type ReadingUnit } from './stories'
import type { StageCDecision } from './contracts'

const now = Date.parse('2026-10-09T12:00:00.000Z')
function article(url: string, publisher = 'Indian Express', title = 'Quantum research reveals a new mechanism', strong = false, summary = true): QualifiedArticle {
  const item = { url, publisher, sourceId: 'ie-explained', section: 'Explained', title, description: summary ? 'Researchers explain the mechanism and its consequences.' : '', publishedAt: new Date(now).toISOString() }
  const acceptance: StageCDecision = { url, accepted: true, decision: 'accepted', eligibility: { status: 'eligible', scope: 'global_knowledge', reasonCodes: ['synthetic'], evidence: [] }, relevance: { status: strong ? 'must_read_candidate' : 'useful', confidence: 'high', reasonCodes: ['synthetic'], evidence: [], dimensions: { topicalConnection: 2, substantiveSupport: 2, consequence: strong ? 1 : 0, sourcePrior: 0, authorPrior: 0 } }, metadataSufficiency: { level: 'sufficient', missingFields: [], description: summary ? 'present' : 'missing' }, observationIds: [], verifiedAuthors: [] }
  return { item, acceptance, subject: classifySubject(item) }
}
const unit = (a: QualifiedArticle, id = a.item.url): ReadingUnit => ({ id, members: [a.item], frame: storyFrame(a.item), novelty: 'new_development', priorId: null, reason: 'synthetic labelled need', firstSeenAt: now })

it('comparable TH/IE representative wins; materially stronger other source wins; permutation stable', () => {
  const ie = article('https://indianexpress.com/a'), th = article('https://www.thehindu.com/a'), other = article('https://example.org/a', 'Other')
  expect(chooseRepresentative([other, ie]).item.publisher).toBe('Indian Express')
  expect(chooseRepresentative([th, ie, other])).toEqual(chooseRepresentative([other, ie, th]))
  const stronger = article('https://example.org/strong', 'Other', undefined, true)
  expect(chooseRepresentative([ie, stronger]).item.publisher).toBe('Other')
  expect(chooseRepresentative([article('https://indianexpress.com/brief', undefined, undefined, false, false), other]).item.publisher).toBe('Other')
})
it('rejected alternatives cannot be rescued and publisher volume contributes no quality', () => {
  const good = article('https://indianexpress.com/a'), rejected = article('https://www.thehindu.com/reject')
  rejected.acceptance.accepted = false
  expect(chooseRepresentative([rejected, good])).toBe(good)
  const copies = Array.from({ length: 60 }, (_, i) => article('https://example.org/' + i, 'Other'))
  expect(chooseRepresentative([...copies, good])).toBe(good)
})
it('maximum 50 is a ceiling, no filling, capacity loss is reported and all selected identities retained', () => {
  const candidates = Array.from({ length: 65 }, (_, i) => article('https://indianexpress.com/' + i))
  const selected = selectReading(candidates.map(a => unit(a)), candidates, [], now)
  expect(selected.today).toHaveLength(50); expect(selected.diagnostics.capacityLoss).toBe(15); expect(selected.retained).toHaveLength(50)
  expect(selectReading([unit(candidates[0])], [candidates[0]], [], now).today).toHaveLength(1)
  expect(() => selectReading([], [], [], now, 51)).toThrow()
})
it('substantive quality precedes diversity and weak or rejected supply never fills', () => {
  const must = article('https://example.org/strong', 'Other', 'Constitutional rights judgment', true), science = article('https://indianexpress.com/science')
  expect(selectReading([unit(science), unit(must)], [science, must], [], now, 1).today[0].primary).toBe(must)
  science.acceptance.accepted = false
  expect(selectReading([unit(science), unit(must)], [science, must], [], now).today).toHaveLength(1)
})
it('equal-quality subject coverage protects distinct Security and Science against Polity volume', () => {
  const polity = Array.from({ length: 55 }, (_, i) => article('https://example.org/p' + i, 'Other', 'Constitutional rights judgment'))
  const science = article('https://indianexpress.com/science'), security = article('https://indianexpress.com/security', undefined, 'Defence readiness capability assessment')
  const all = [...polity, science, security], result = selectReading(all.map(a => unit(a)), all, [], now, 3)
  expect(new Set(result.today.map(a => a.primary.subject.primary))).toEqual(new Set(['Polity', 'Sci-Tech', 'Security']))
})
it('refresh keeps selected Today units without refreshing original selection time; no cooldown reentry', () => {
  const a = article('https://indianexpress.com/a'), original = selectReading([unit(a, 'stable')], [a], [], now)
  const repeat = { ...unit(a, 'stable'), novelty: 'repeat' as const, selectedAt: now }
  expect(selectReading([repeat], [a], original.retained, now + 1000).today).toHaveLength(1)
  const after = selectReading([repeat], [a], original.retained, now + 30 * 86400000)
  expect(after.today).toHaveLength(0); expect(after.retained[0].selectedAt).toBe(now)
})
it('undated and old publication cannot become Today by discovery or refreshed timestamp', () => {
  const a = article('https://indianexpress.com/a'); a.item.publishedAt = new Date(now - 2 * 86400000).toISOString()
  expect(selectReading([unit(a)], [a], [], now).today).toHaveLength(0)
})
it('representative replacement preserves selected ID, chronology and every member URL', () => {
  const initial = article('https://example.org/a', 'Other'), replacement = article('https://indianexpress.com/a')
  const before = selectReading([unit(initial, 'stable')], [initial], [], now)
  const next = { ...unit(replacement, 'stable'), members: [initial.item, replacement.item], novelty: 'repeat' as const }
  const result = selectReading([next], [initial, replacement], before.retained, now + 10)
  expect(result.retained[0]).toMatchObject({ id: 'stable', selectedAt: now, representative: replacement.item }); expect(result.retained[0].members).toHaveLength(2)
})
it('permutation preserves complete selection and suppression order', () => {
  const all = Array.from({ length: 60 }, (_, i) => article('https://example.org/' + i, 'Other'))
  const units = all.map(a => unit(a))
  // Runtime normalizes unit order; this API must normalize too.
  expect(selectReading(units, all, [], now).today).toEqual(selectReading([...units].reverse(), [...all].reverse(), [], now).today)
})
