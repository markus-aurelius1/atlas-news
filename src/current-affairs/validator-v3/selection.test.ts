import { expect, it } from 'vitest'
import { chooseRepresentative, sameNamedTopic, selectReading, SELECTION_POLICY, topicAllowance, topicNames, type QualifiedArticle } from './selection'
import { EDITORIAL_POLICY } from './editorial'
import { SUBJECT_POLICY, type Subject } from './subject'
import { storyFrame, type ReadingUnit } from './stories'
import type { StageCDecision } from './contracts'

const now = Date.parse('2026-10-09T12:00:00.000Z')
/** Selection mechanics are tested with stated values; what earns a value is tested in editorial.test.ts. */
function article(url: string, { publisher = 'Indian Express', title = 'Quantum research reveals a new mechanism', score = 8, subject = 'Sci-Tech' as Subject, description = 'Researchers explain the mechanism and its consequences.' } = {}): QualifiedArticle {
  const item = { url, publisher, sourceId: 'ie-explained', section: 'Explained', title, description, publishedAt: new Date(now).toISOString() }
  const acceptance: StageCDecision = { url, accepted: true, decision: 'accepted', eligibility: { status: 'eligible', scope: 'global_knowledge', reasonCodes: ['synthetic'], evidence: [] }, relevance: { status: 'useful', confidence: 'high', reasonCodes: ['synthetic'], evidence: [], dimensions: { topicalConnection: 2, substantiveSupport: 2, consequence: 0, sourcePrior: 0, authorPrior: 0 } }, metadataSufficiency: { level: 'sufficient', missingFields: [], description: 'present' }, observationIds: [], verifiedAuthors: [] }
  return { item, acceptance, subject: { policy: SUBJECT_POLICY, primary: subject, secondary: [], confidence: 'high', margin: 0, reason: 'dominant_frame', evidence: [] }, editorial: { policy: EDITORIAL_POLICY.id, score, floor: EDITORIAL_POLICY.floor, accepted: true, subject, reasons: [] } }
}
const unit = (a: QualifiedArticle, id = a.item.url): ReadingUnit => ({ id, members: [a.item], frame: storyFrame(a.item), novelty: 'new_development', priorId: null, reason: 'synthetic labelled need', firstSeenAt: now })
/** Headlines with no word in common: each is its own topic. */
const distinct = (i: number, subject: Subject = 'Sci-Tech', score = 8) => article('https://example.org/' + subject.replace(/\W/g, '') + i, { publisher: 'Other', title: `Zq${i}${subject.replace(/\W/g, '').toLowerCase()} wq${i}${subject.replace(/\W/g, '').toLowerCase()} vq${i}${subject.replace(/\W/g, '').toLowerCase()}`, description: '', score, subject })
const select = (all: QualifiedArticle[], previous = [] as ReturnType<typeof selectReading>['retained'], at = now, capacity?: number) => selectReading(all.map(a => unit(a)), all, previous, at, capacity)

it('comparison-budget abstentions cannot appear as new Today units or erase earlier selected history', () => {
  const a = article('https://indianexpress.com/budget'), before = selectReading([unit(a, 'stable')], [a], [], now)
  const uncertain = { ...unit(a, 'stable'), novelty: 'uncertain' as const, reason: 'comparison_budget_exceeded' }
  const next = selectReading([uncertain], [a], before.retained, now + 1)
  expect(next.today).toHaveLength(0); expect(next.suppressed).toEqual([{ id: 'stable', reason: 'evidence_limit' }])
  expect(next.retained).toEqual(before.retained)
})
it('comparable TH/IE representative wins; materially stronger other source wins; permutation stable', () => {
  const ie = article('https://indianexpress.com/a'), th = article('https://www.thehindu.com/a', { publisher: 'The Hindu' }), other = article('https://example.org/a', { publisher: 'Other', score: 8.5 })
  expect(chooseRepresentative([other, ie]).item.publisher).toBe('Indian Express')
  expect(chooseRepresentative([th, ie, other])).toEqual(chooseRepresentative([other, ie, th]))
  const stronger = article('https://example.org/strong', { publisher: 'Other', score: 8 + SELECTION_POLICY.comparableTolerance + 0.1 })
  expect(chooseRepresentative([ie, stronger]).item.publisher).toBe('Other')
})
it('rejected alternatives cannot be rescued and publisher volume contributes no quality', () => {
  const good = article('https://indianexpress.com/a'), rejected = article('https://www.thehindu.com/reject', { publisher: 'The Hindu', score: 12 })
  rejected.acceptance.accepted = false
  expect(chooseRepresentative([rejected, good])).toBe(good)
  const copies = Array.from({ length: 60 }, (_, i) => article('https://example.org/' + i, { publisher: 'Other' }))
  expect(chooseRepresentative([...copies, good])).toBe(good)
  expect(() => chooseRepresentative([rejected])).toThrow()
})
it('maximum 50 is a ceiling, never a target, and every selected identity is retained', () => {
  const subjects: Subject[] = ['Environment', 'Sci-Tech', 'International relations', 'Economy'], all = Array.from({ length: 65 }, (_, i) => distinct(i, subjects[i % 4]))
  const selected = select(all)
  expect(selected.today).toHaveLength(50); expect(selected.suppressed).toHaveLength(15); expect(selected.retained).toHaveLength(50)
  expect(select(all.slice(0, 7)).today).toHaveLength(7)
  expect(() => selectReading([], [], [], now, 51)).toThrow()
})
it('the most valuable reading comes first whatever its subject', () => {
  const strong = distinct(1, 'Polity', 11), science = distinct(2, 'Sci-Tech', 7)
  expect(select([science, strong], [], now, 1).today[0].primary).toBe(strong)
  science.acceptance.accepted = false
  expect(select([science, strong]).today).toHaveLength(1)
})
it('Polity and Governance volume cannot crowd out the subjects where current affairs matter most', () => {
  const polity = Array.from({ length: 30 }, (_, i) => distinct(i, 'Polity', 10)), governance = Array.from({ length: 30 }, (_, i) => distinct(i, 'Governance', 10))
  const others = (['Environment', 'Sci-Tech', 'International relations', 'Economy', 'Geography', 'Security', 'History & Culture'] as Subject[]).flatMap(s => Array.from({ length: 3 }, (_, i) => distinct(i, s, 7)))
  const result = select([...polity, ...governance, ...others]), count = (s: Subject) => result.today.filter(r => r.primary.subject.primary === s).length
  expect(count('Polity')).toBe(SELECTION_POLICY.subjectCap.Polity); expect(count('Governance')).toBe(SELECTION_POLICY.subjectCap.Governance)
  expect(result.today).toHaveLength(SELECTION_POLICY.subjectCap.Polity + SELECTION_POLICY.subjectCap.Governance + others.length)
  expect(result.suppressed.every(s => s.reason === 'subject_cap')).toBe(true)
})
it('a priority subject may pass its cap only when the day is otherwise thin', () => {
  const economy = Array.from({ length: 20 }, (_, i) => distinct(i, 'Economy'))
  expect(select(economy).today).toHaveLength(20)
  const others = (['Environment', 'Sci-Tech', 'International relations'] as Subject[]).flatMap(s => Array.from({ length: 12 }, (_, i) => distinct(i, s, 9)))
  const busy = select([...economy, ...others, ...Array.from({ length: 5 }, (_, i) => distinct(i, 'Geography', 7))]), count = (s: Subject) => busy.today.filter(r => r.primary.subject.primary === s).length
  expect(busy.today).toHaveLength(50); expect(count('Economy')).toBe(SELECTION_POLICY.subjectCap.Economy); expect(count('Geography')).toBe(2)
})
it('one running story is one reading, however differently its reports are headlined', () => {
  const lead = article('https://indianexpress.com/h1b', { title: 'Lower dependence on H-1B, local hiring: Why Indian IT stocks rose despite US shock', description: '', score: 10, subject: 'International relations' })
  const bridge = article('https://example.org/perm-h1b', { publisher: 'Business Standard', title: 'PERM programme\'s suspension won\'t affect existing H-1B visas, clarifies MEA', description: '', score: 7, subject: 'International relations' })
  const far = article('https://example.org/perm', { publisher: 'Hindustan Times', title: 'What MEA said on Trump administration PERM curbs', description: '', score: 9, subject: 'International relations' })
  const economy = article('https://example.org/gtri', { publisher: 'BusinessLine', title: 'PERM programme suspension signals protectionist shift, raises concerns for exports', description: '', score: 8, subject: 'Economy' })
  // The same name under another subject is one topic only when the wording overlaps too: a study dated to a PERM year is not this story.
  const incidental = article('https://example.org/study', { publisher: 'Down To Earth', title: 'Wetland bird counts fell sharply in the year PERM filings peaked', description: '', score: 9.5, subject: 'Environment' })
  const other = article('https://example.org/crr', { publisher: 'The Tribune', title: 'RBI raises daily minimum CRR maintenance requirement to 99% from 90%', description: '', score: 8, subject: 'Economy' })
  expect(sameNamedTopic(lead.item, far.item)).toBe(false)
  const listed = [far, economy, bridge, other, lead, incidental], feed = Array.from({ length: 40 }, (_, i) => distinct(100 + i, 'Polity'))
  const result = selectReading(listed.map(a => unit(a)), [...listed, ...feed], [], now)
  expect(result.today.map(r => r.primary.item.url)).toEqual([lead.item.url, incidental.item.url, other.item.url])
  expect(result.suppressed).toEqual(expect.arrayContaining([{ id: far.item.url, reason: 'topic_covered', by: lead.item.url }, { id: economy.item.url, reason: 'topic_covered', by: lead.item.url }]))
  expect(result.diagnostics.topicRepeats).toBe(3)
})
it('reports of the same story travel with the reading chosen for it and corroborate it', () => {
  const tribune = article('https://example.org/t', { publisher: 'The Tribune', title: 'India’s forex reserves fall by $12.95 billion to $734.61 billion in week ended Oct 2: RBI', description: 'Foreign exchange reserves fell for a fourth straight week as the central bank sold dollars to steady the rupee.', subject: 'Economy' })
  const standard = article('https://example.org/b', { publisher: 'Business Standard', title: 'India\'s forex reserves drop for fourth week, down $12.95 bn to $734.6 bn', description: 'Foreign exchange reserves have now fallen for four weeks, with the central bank selling dollars to defend the rupee.', score: 7.9, subject: 'Economy' })
  // Rarity is measured over the day's whole feed, so the feed is part of the case.
  const feed = Array.from({ length: 40 }, (_, i) => distinct(100 + i, 'Polity')), listed = [standard, tribune, distinct(1, 'Economy'), distinct(2, 'Economy')]
  const result = selectReading(listed.map(a => unit(a)), [...listed, ...feed], [], now)
  expect(result.today).toHaveLength(3); expect(result.diagnostics.mergedStories).toBe(1)
  const forex = result.today.find(r => r.primary === tribune)!
  expect(forex.unit.members.map(m => m.url)).toEqual([tribune.item.url, standard.item.url])
  expect(result.retained.find(s => s.id === tribune.item.url)!.members).toEqual([standard.item.url, tribune.item.url].sort())
  // Two publishers in one unit raise its value; one publisher repeating itself does not.
  const both = { ...unit(tribune), members: [tribune.item, standard.item] }
  expect(selectReading([both], [tribune, standard, ...feed], [], now).today[0].quality).toBeGreaterThan(selectReading([unit(tribune)], [tribune, ...feed], [], now).today[0].quality)
})
it('names every headline shares are not topics; acronyms are read as written', () => {
  expect(topicNames(article('u', { title: 'UP Cabinet approves proposal to name Jewar airport after PM Narendra Modi' }).item)).toEqual(['jewar', 'pm narendra modi'])
  const up = article('u1', { title: 'UP Cabinet approves Jewar airport proposal' }).item, speeds = article('u2', { title: 'GST Council eases penalties and speeds up refunds' }).item
  expect(sameNamedTopic(up, speeds)).toBe(false)
  expect(sameNamedTopic(article('a', { title: 'Tamil Nadu may encounter El Niño differently from rest of India' }).item, article('b', { title: 'Collectors told to prioritise drinking water supply amid El Nino concerns' }).item)).toBe(true)
  expect(sameNamedTopic(article('c', { title: 'Supreme Court orders national digital net to record road crashes' }).item, article('d', { title: 'Supreme Court asks Centre to regulate train services in Delhi' }).item)).toBe(false)
  // A passing mention in another subject's summary is not a shared topic.
  const explainer = article('f', { title: 'What is Pitru Paksha, why it is observed in the autumn', description: '' }).item, fish = article('g', { title: 'Fish deaths: Faith must coexist with ecological care', description: 'Thousands of fish dying in a historic tank after Pitru Paksha rituals is not an isolated mishap.' }).item
  expect(sameNamedTopic(explainer, fish)).toBe(true); expect(sameNamedTopic(explainer, fish, false)).toBe(false)
  // A headline in title case says nothing by its capitals.
  expect(topicNames(article('e', { title: 'China and Europe Agree to Deal to Limit Chinese Exports of Hybrid Cars' }).item)).toEqual([])
})
it('an institution may carry a decision and its analysis, not a page of reports', () => {
  const rbi = ['RBI raises repo rate by 25 basis points to 5.50%', 'How RBI’s rate hike turns homeownership dream into bigger debt burden', 'Govt bond yields near three-year high after RBI\'s hawkish policy shift', 'Individuals spared from new FEMA reporting requirement: RBI clarifies'].map((title, i) => article('https://example.org/rbi' + i, { publisher: 'Other', title, description: '', score: 10 - i, subject: 'Economy' }))
  const result = select(rbi)
  expect(result.today.map(r => r.primary.item.title)).toEqual(rbi.slice(0, 2).map(a => a.item.title))
  expect(topicAllowance(5)).toBe(1); expect(topicAllowance(30)).toBe(2)
})
it('a digest neither joins a topic nor hides one', () => {
  const digest = article('https://indianexpress.com/key', { title: 'UPSC Key: GST Council, Green Card Programme and Makkah Accord', description: '', score: 12, subject: 'International relations' })
  const gst = article('https://www.thehindu.com/gst', { publisher: 'The Hindu', title: 'What are the reforms proposed by the GST Council?', description: '', score: 10, subject: 'Economy' })
  expect(select([digest, gst]).today).toHaveLength(2)
})
it('refresh keeps a selected reading in Today for a day without refreshing its selection time; no re-entry later', () => {
  const a = article('https://indianexpress.com/a'), original = selectReading([unit(a, 'stable')], [a], [], now)
  const repeat = { ...unit(a, 'stable'), novelty: 'repeat' as const, selectedAt: now }
  expect(selectReading([repeat], [a], original.retained, now + 1000).today).toHaveLength(1)
  const after = selectReading([repeat], [a], original.retained, now + 30 * 86400000)
  expect(after.today).toHaveLength(0); expect(after.retained[0].selectedAt).toBe(now); expect(after.suppressed).toEqual([{ id: 'stable', reason: 'repeat' }])
})
it('a reading seen earlier but never selected can still be chosen while it is current', () => {
  const a = article('https://indianexpress.com/a'), seen = { ...unit(a), novelty: 'repeat' as const }
  expect(selectReading([seen], [a], [], now).today).toHaveLength(1)
})
it('a reading already in Today holds its place against an equal newcomer', () => {
  const kept = distinct(1), before = select([kept]), newcomer = distinct(2)
  expect(select([newcomer, kept], before.retained, now + 1000, 1).today[0].primary).toBe(kept)
})
it('undated and old publication cannot become Today by discovery or refreshed timestamp', () => {
  const a = article('https://indianexpress.com/a'); a.item.publishedAt = new Date(now - 2 * 86400000).toISOString()
  expect(selectReading([unit(a)], [a], [], now).today).toHaveLength(0)
  const undated = article('https://indianexpress.com/b'); (undated.item as { publishedAt: string | null }).publishedAt = null
  expect(selectReading([unit(undated)], [undated], [], now).suppressed).toEqual([{ id: undated.item.url, reason: 'undated_or_stale' }])
})
it('representative replacement preserves selected ID, chronology and every member URL', () => {
  const initial = article('https://example.org/a', { publisher: 'Other' }), replacement = article('https://indianexpress.com/a')
  const before = selectReading([unit(initial, 'stable')], [initial], [], now)
  const next = { ...unit(replacement, 'stable'), members: [initial.item, replacement.item], novelty: 'repeat' as const }
  const result = selectReading([next], [initial, replacement], before.retained, now + 10)
  expect(result.retained[0]).toMatchObject({ id: 'stable', selectedAt: now, representative: replacement.item }); expect(result.retained[0].members).toHaveLength(2)
})
it('permutation preserves complete selection and suppression order', () => {
  const all = Array.from({ length: 60 }, (_, i) => distinct(i, (['Economy', 'Polity', 'Sci-Tech'] as Subject[])[i % 3], 7 + i % 4))
  const units = all.map(a => unit(a)), forward = selectReading(units, all, [], now), backward = selectReading([...units].reverse(), [...all].reverse(), [], now)
  expect(forward.today).toEqual(backward.today); expect(forward.suppressed).toEqual(backward.suppressed)
})
