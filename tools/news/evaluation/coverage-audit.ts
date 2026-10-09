/** Offline article-level audit. Never acquires feeds, opens bodies or writes frozen evidence. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import assert from 'node:assert/strict'
import { evaluateReading } from '../../../src/current-affairs/validator-v3/orchestrator.ts'
import { extractEvidence } from '../../../src/current-affairs/validator-v3/evidence.ts'
import { stageCVersions, byteHash } from './stage-c-runner.ts'
import { digest } from './core.ts'
import type { StageCObservation } from '../../../src/current-affairs/validator-v3/contracts.ts'

const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'))
const root = 'tools/news/evaluation/calibration-gold-v1/'
const provenance = read(root + 'provenance.json'), packageRoot = provenance.sourcePackage
const clock = provenance.replay.clock, now = Date.parse(clock)
const folder = 'docs/coverage-recovery', cache = 'tools/news/.cache/coverage-recovery'
mkdirSync(folder, { recursive: true }); mkdirSync(cache, { recursive: true })
const phase = process.argv[2]
assert(['before', 'after'].includes(phase), 'Explicit before/after phase required')
for (const row of provenance.protectedFiles) assert.equal(byteHash(packageRoot + '/' + row.path), row.sha256, row.path)
const corpus = read(packageRoot + '/corpus.json')
const gold: { records: { number: number; record: { metadata: { url: string } }; resolvedGold: { value: string } | null }[] } = read(root + 'gold.json')
const versions = stageCVersions(provenance.replay ? read(root + 'observations.json')[0].registryHash : '')
function run(observations: StageCObservation[]) {
  const input = { observations, clock, versions }
  const output = evaluateReading(input, [], [])
  assert.deepEqual(evaluateReading({ ...input, observations: [...observations].reverse() }, [], []), output)
  const byUrl = new Map<string, StageCObservation[]>()
  for (const o of observations) byUrl.set(o.metadata.url, [...byUrl.get(o.metadata.url) ?? [], o])
  const articles = output.articles.map(a => {
    const evidence = extractEvidence(byUrl.get(a.item.url)!)
    const unit = output.stories.units.find(u => u.members.some(m => m.url === a.item.url))
    const selected = output.selection.today.find(r => r.unit.id === unit?.id)
    const suppression = output.selection.suppressed.find(s => s.id === unit?.id)
    const representative = selected?.primary.item.url ?? (unit ? output.articles.filter(r => r.acceptance.accepted && unit.members.some(m => m.url === r.item.url))[0]?.item.url : null)
    const age = a.item.publishedAt ? (now - Date.parse(a.item.publishedAt)) / 86400000 : null
    const sections = [...new Set(a.item.memberships?.map(m => m.section) ?? [a.item.section])].sort()
    const contentTypeProxy = sections.some(s => /editorial|opinion|column|analysis/i.test(s)) ? 'editorial_analysis' : sections.some(s => /explained/i.test(s)) ? 'explainer' : 'news_or_other'
    return { url: a.item.url, title: a.item.title, publisher: a.item.publisher, feedIds: a.item.memberships?.map(m => m.sourceId) ?? [a.item.sourceId], sections, contentTypeProxy,
      description: a.acceptance.metadataSufficiency.description, publishedAt: a.item.publishedAt, ageDays: age, ageBand: age === null ? 'undated' : age <= 1 ? '0-1d' : age <= 7 ? '1-7d' : age <= 14 ? '7-14d' : '14d+',
      decision: a.acceptance.decision, eligibility: a.acceptance.eligibility.status, scope: a.acceptance.eligibility.scope, subject: a.subject.primary, verifiedAuthors: a.acceptance.verifiedAuthors, publisherProvidedBylines: [...new Set((a.item.bylines ?? []).map(b => b.name))].sort(),
      stage: !a.acceptance.accepted ? 'C' : suppression ? 'F' : selected && representative !== a.item.url ? 'E/F alternative' : selected ? 'Today' : 'E',
      decisiveRules: !a.acceptance.accepted ? a.acceptance.eligibility.reasonCodes : suppression ? [suppression.reason] : selected ? [selected.reason] : [unit?.reason ?? 'no_unit'],
      evidenceAvailable: { routes: evidence.routes, exclusions: evidence.exclusions, context: evidence.context, bylines: a.item.bylines ?? [], categories: a.item.categories ?? [], subject: a.subject.evidence }, evidenceMissing: evidence.coverage.missingFields,
      unitId: unit?.id ?? null, novelty: unit?.novelty ?? null, representative: selected ? representative : null, anotherRepresentativeSelected: !!selected && representative !== a.item.url,
      todayMember: !!selected, todayPrimary: selected?.primary.item.url === a.item.url, archiveMember: output.selection.retained.some(s => s.members.includes(a.item.url)) }
  })
  const count = (key: string, rows = articles) => Object.fromEntries([...new Set(rows.map(a => String(a[key as keyof typeof a])))].sort().map(v => [v, rows.filter(a => String(a[key as keyof typeof a]) === v).length]))
  const funnel = (rows = articles) => ({ acquiredArticles: rows.length, normalizedArticles: rows.length, eligible: rows.filter(a => a.eligibility === 'eligible').length,
    accepted: rows.filter(a => a.decision === 'accepted').length, rejected: rows.filter(a => a.decision === 'rejected').length, deferred: rows.filter(a => a.decision === 'deferred').length,
    classifiedAccepted: rows.filter(a => a.decision === 'accepted' && a.subject !== 'Unresolved').length, unresolvedAccepted: rows.filter(a => a.decision === 'accepted' && a.subject === 'Unresolved').length,
    clusteredArticles: rows.filter(a => a.unitId).length, units: new Set(rows.flatMap(a => a.unitId ? [a.unitId] : [])).size,
    todayPrimary: rows.filter(a => a.todayPrimary).length, todayMembers: rows.filter(a => a.todayMember).length, selectedLedgerMembers: rows.filter(a => a.archiveMember).length, archiveOnlyMembers: rows.filter(a => a.archiveMember && !a.todayMember).length,
    suppressions: count('decisiveRules', rows.filter(a => a.stage === 'F')), missingDescriptions: rows.filter(a => a.description === 'missing').length })
  const group = (key: 'publisher' | 'subject' | 'ageBand' | 'publishedAt' | 'description' | 'scope' | 'contentTypeProxy') => Object.fromEntries(Object.keys(count(key)).map(v => [v, funnel(articles.filter(a => String(a[key]) === v))]))
  const multi = (key: 'feedIds' | 'sections' | 'verifiedAuthors' | 'publisherProvidedBylines') => Object.fromEntries([...new Set(articles.flatMap(a => a[key]))].sort().map(v => [v, funnel(articles.filter(a => a[key].includes(v)))]))
  assert.equal(articles.length, output.c.articles.length)
  return { outputHash: digest(output), versions, observationCount: observations.length, funnel: funnel(), byPublisher: group('publisher'), byFeed: multi('feedIds'), bySection: multi('sections'), byContentTypeProxy: group('contentTypeProxy'), bySubject: group('subject'), byAge: group('ageBand'), byPublicationDate: Object.fromEntries([...new Set(articles.map(a => a.publishedAt?.slice(0, 10) ?? 'undated'))].sort().map(d => [d, funnel(articles.filter(a => (a.publishedAt?.slice(0,10) ?? 'undated') === d))])), byDescription: group('description'), byScope: group('scope'), byVerifiedAuthor: multi('verifiedAuthors'), byPublisherProvidedByline: multi('publisherProvidedBylines'), sourceComposition: output.selection.diagnostics, story: { units: output.stories.units.length, comparisons: output.stories.comparisons, historyCoverage: output.stories.coverage }, articles }
}
const wider = run(read(packageRoot + '/observations.json')), calibration = run(read(root + 'observations.json'))
const calibrationRows = gold.records.map((r: { number: number; record: { metadata: { url: string } }; resolvedGold: { value: string } | null }, i: number) => {
  const a = calibration.articles.find(a => a.url === r.record.metadata.url)!, value = r.resolvedGold?.value ?? null
  return { number: i + 1, url: a.url, title: a.title, value, decision: a.decision, subject: a.subject, rules: a.decisiveRules, result: !value ? 'unresolvable' : ['must_read','useful'].includes(value) ? a.decision === 'accepted' ? 'TP' : 'FN' : a.decision === 'accepted' ? 'FP' : 'TN' }
})
const snapshot = { label: 'Historical exposed shadow; unreviewed broader outcomes are not truth labels', clock, liveDay: 'NOT evaluated: no production network testing', history: 'Empty cold-start inputs; no natural temporal adjudication', inputHashes: { observations: byteHash(packageRoot + '/observations.json'), corpus: byteHash(packageRoot + '/corpus.json'), calibration: byteHash(root + 'observations.json'), gold: byteHash(root + 'gold.json') }, acquisition: read(packageRoot + '/source-audit.json'), wider, calibration: { ...calibration, rows: calibrationRows, confusion: Object.fromEntries(['TP','FP','FN','TN','unresolvable'].map(k => [k, calibrationRows.filter(r => r.result === k).length])) }, sampling: { selected: corpus.length, parentUniqueUrls: 4945, note: '580 representative + 420 coverage enriched; membership distributions overlap' } }
writeFileSync(cache + '/' + phase + '.json', JSON.stringify(snapshot, null, 2) + '\n')
if (phase === 'after') {
  const before = read(cache + '/before.json')
  assert.deepEqual(before.inputHashes, snapshot.inputHashes)
  const changed = wider.articles.filter(a => before.wider.articles.find((b: { url: string; decision: string }) => b.url === a.url)?.decision !== a.decision)
  const calibrationChanges = calibrationRows.filter(r => before.calibration.rows.find((b: { url: string; decision: string; subject: string }) => b.url === r.url)?.decision !== r.decision || before.calibration.rows.find((b: { url: string; subject: string }) => b.url === r.url)?.subject !== r.subject)
  const correctionReplays = existsSync(folder + '/DECISION_FUNNEL.json') ? read(folder + '/DECISION_FUNNEL.json').correctionReplays ?? [] : []
  writeFileSync(folder + '/DECISION_FUNNEL.json', JSON.stringify({ before, after: snapshot, changedDecisions: changed, calibrationChanges, correctionReplays, independentMetrics: { precision: null, recall: null, p20: null, p50: null, falsePositives: null, recoveredPositives: null } }, null, 2) + '\n')
}
console.log(JSON.stringify({ phase, funnel: wider.funnel, publishers: wider.byPublisher, calibration: snapshot.calibration.confusion, today: wider.sourceComposition }, null, 2))
