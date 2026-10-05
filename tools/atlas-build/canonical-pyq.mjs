/** Job 1 CLI. Verifies the canonical release, scans coverage independently, then writes only the three-gate Atlas subset. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadCanonical, runtimeEligibility, canonicalHash, sha256 } from './lib/canonical-package.mjs'
import { premiumRenderability, textLocations } from '../../src/atlas/pyq/quality.mjs'
import { blockNodes, nodesHtml, escapeHtml } from '../../src/atlas/pyq/render.mjs'
import { buildEntityIndex, extractMentions } from './lib/atlas-mentions.mjs'
import { classifyRelevance, assignRoles } from './lib/atlas-relevance.mjs'
import mappings from './content/pyq/canonical-mappings.mjs'
import indiaCandidates from './content/candidates/india.mjs'
import worldCandidates from './content/candidates/world.mjs'

export const PIPELINE_VERSION = 'atlas-canonical-pyq/v1'
export const EXAM_FAMILY = { 'UPSC-CSE': 'CSE', UPPCS: 'PCS', CDS: 'CDS' }
const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '../..')
const increment = (counts, key) => { counts[key] = (counts[key] ?? 0) + 1 }
const jsonBytes = (x) => JSON.stringify(x) + '\n'
const sourceIdentity = () => {
  const files = []
  const walk = (path) => { for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) { const p = join(path, entry.name); if (entry.isDirectory()) walk(p); else if (/\.(mjs|json)$/.test(p)) files.push([relative(root, p).replaceAll('\\', '/'), sha256(readFileSync(p))]) } }
  walk(join(here, 'content'))
  return canonicalHash(files)
}

export function curate(canonical, atlas, entityIndex) {
  const rows = [], allMentions = [], residualNames = [], included = []
  const counts = { activeCanonicalRecords: canonical.records.length, runtimeEligible: 0, premiumRenderable: 0, atlasRelevant: 0, included: 0, excludedByRuntimeGate: 0, excludedByRenderabilityGate: 0, excludedByRelevanceGate: 0, unresolvedGeographicMentions: 0, newPlaceCandidates: 0, matchedExistingPlaces: 0, relationsBySemanticRole: {}, includedByFamily: { CSE: 0, PCS: 0, CDS: 0 }, includedByYear: {}, includedByCanonicalType: {}, exclusionReasons: {} }
  for (const source of [...canonical.records].sort((a, b) => a.record.id.localeCompare(b.record.id, 'en'))) {
    const { record, answer, meta, paper } = source
    const extracted = extractMentions(record.id, record.question, entityIndex)
    const runtime = runtimeEligibility(meta, answer)
    const premium = premiumRenderability(record.question)
    const relevance = classifyRelevance(record.question, extracted.mentions, entityIndex)
    const provisionalRoles = assignRoles(extracted.mentions, relevance, answer, false)
    if (['direct-spatial', 'place-centric', 'spatial-association'].includes(relevance.classification) && !provisionalRoles.some((r) => r.placeId && r.semanticRole !== 'distractor' && r.semanticRole !== 'incidental')) {
      relevance.classification = 'incidental'; relevance.reasons = ['relevance:no-meaningful-mapping']
    }
    let excludedBy, reasons = []
    if (!runtime.pass) { excludedBy = 'runtime'; reasons = runtime.reasons; counts.excludedByRuntimeGate++ }
    else {
      counts.runtimeEligible++
      if (!premium.pass) { excludedBy = 'renderability'; reasons = premium.reasons.map((r) => `renderability:${r.code}`); counts.excludedByRenderabilityGate++ }
      else {
        counts.premiumRenderable++
        if (!['direct-spatial', 'place-centric', 'spatial-association'].includes(relevance.classification)) { excludedBy = 'relevance'; reasons = relevance.reasons; counts.excludedByRelevanceGate++ }
        else counts.atlasRelevant++
      }
    }
    const pass = !excludedBy
    const relations = assignRoles(extracted.mentions, relevance, answer, pass)
    allMentions.push(...relations)
    residualNames.push(...extracted.potentialNames)
    const row = { questionId: record.id, paperId: paper.paper_id, exam: record.exam.code, year: record.exam.year, canonicalType: record.question.type, included: pass, excludedBy: excludedBy ?? null, reasons: [...new Set(reasons)], runtime, premiumRenderability: premium, relevance }
    rows.push(row)
    for (const reason of new Set(reasons)) increment(counts.exclusionReasons, reason)
    if (pass) {
      const family = EXAM_FAMILY[record.exam.code]
      counts.included++; increment(counts.includedByFamily, family); increment(counts.includedByYear, record.exam.year); increment(counts.includedByCanonicalType, record.question.type)
      included.push({ source, relations: relations.filter((m) => m.placeId), relevance, family })
    }
  }
  const unresolved = allMentions.filter((m) => !m.placeId)
  const candidateMap = new Map()
  for (const mention of unresolved.filter((m) => m.resolution === 'unresolved-review')) {
    const key = mention.mentionText.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    if (!candidateMap.has(key)) candidateMap.set(key, { name: mention.mentionText, variants: [], questionIds: [], status: 'review-before-coordinate-sourcing', coordinates: null })
    const c = candidateMap.get(key)
    if (!c.variants.includes(mention.mentionText)) c.variants.push(mention.mentionText)
    if (!c.questionIds.includes(mention.questionId)) c.questionIds.push(mention.questionId)
  }
  const candidates = [...candidateMap.entries()].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([, c]) => c)
  counts.unresolvedGeographicMentions = unresolved.length
  counts.newPlaceCandidates = candidates.length
  counts.matchedExistingPlaces = new Set(allMentions.filter((m) => m.placeId).map((m) => m.placeId)).size
  counts.matchedExistingMentions = allMentions.filter((m) => m.placeId).length
  counts.unresolvedByResolution = unresolved.reduce((a, m) => { increment(a, m.resolution); return a }, {})
  counts.potentialNameReviewItems = residualNames.length
  for (const relation of allMentions) increment(counts.relationsBySemanticRole, relation.semanticRole)
  return { rows, allMentions, unresolved, residualNames, candidates, included, counts }
}

export function runtimeArtifacts(result, identity) {
  const artifacts = new Map(), groups = new Map(), places = {}
  for (const entry of result.included) {
    const { record, answer, meta, paper } = entry.source
    if (!groups.has(paper.paper_id)) groups.set(paper.paper_id, { paper, questions: [], answers: [] })
    const group = groups.get(paper.paper_id)
    group.questions.push({ schema: 'atlas-pyq-question/v1', id: record.id, answerId: answer.id, exam: record.exam, family: entry.family, question: record.question, relevance: entry.relevance.classification, baseQuestionHash: meta.base_question_hash, relations: entry.relations })
    group.answers.push({ schema: 'atlas-pyq-answer/v1', id: answer.id, questionId: record.id, status: 'final', correctOptions: answer.correct_options, suppliedAnswerHash: meta.supplied_answer_hash })
    for (const id of new Set(entry.relations.map((r) => r.placeId))) {
      if (!places[id]) places[id] = { questionIds: [], byFamily: { CSE: 0, PCS: 0, CDS: 0 }, primaryQuestionIds: [], enrichmentQuestionIds: [] }
      places[id].questionIds.push(record.id)
      increment(places[id].byFamily, entry.family)
      places[id][record.exam.corpus_role === 'primary' ? 'primaryQuestionIds' : 'enrichmentQuestionIds'].push(record.id)
    }
  }
  const papers = []
  for (const [id, g] of groups) {
    const questions = `papers/${id}.json`, answers = `answers/${id}.json`
    const q = jsonBytes({ schema: 'atlas-pyq-paper/v1', identity, paperId: id, questions: g.questions })
    const a = jsonBytes({ schema: 'atlas-pyq-answers/v1', identity, paperId: id, answers: g.answers })
    artifacts.set(questions, q); artifacts.set(answers, a)
    papers.push({ paperId: id, exam: g.paper.exam, family: EXAM_FAMILY[g.paper.exam], year: g.paper.year, cycle: g.paper.cycle, corpusRole: g.paper.corpus_role, count: g.questions.length, questions, answers, questionsHash: sha256(q), answersHash: sha256(a) })
  }
  const placeIndex = jsonBytes({ schema: 'atlas-place-pyq-index/v1', identity, places })
  artifacts.set('place-pyq-index.json', placeIndex)
  artifacts.set('manifest.json', jsonBytes({ schema: 'atlas-pyq-manifest/v1', identity, count: result.counts.included, byFamily: result.counts.includedByFamily, examFamilies: EXAM_FAMILY, papers, placeIndex: 'place-pyq-index.json', placeIndexHash: sha256(placeIndex) }))
  return artifacts
}

export function auditHtml(result) {
  const css = readFileSync(join(root, 'src/atlas/pyq/blocks.css'), 'utf8')
  const body = result.included.map(({ source, relations, relevance }) => {
    const { record, answer } = source
    return `<article id="${record.id}" data-exam="${record.exam.code}" data-type="${record.question.type}"><h2>${record.id}</h2><p>${record.question.type} · ${relevance.classification} · ${record.exam.corpus_role}</p><div class="pyq-body">${nodesHtml(blockNodes(record.question.content))}${record.question.options.map((o) => `<div class="option"><b>${o.key}</b>${nodesHtml(blockNodes(o.content))}</div>`).join('')}</div><details><summary>Answer and mapping audit</summary><p>Final accepted keys: ${answer.correct_options.join(', ')}</p><ul>${relations.map((r) => `<li>${escapeHtml(r.mentionText)} → ${escapeHtml(r.placeId)} · ${r.semanticRole} · mastery ${r.masteryEligible}</li>`).join('')}</ul></details></article>`
  }).join('\n')
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Atlas canonical PYQ quality audit</title><style>${css}body{margin:0;background:#f5f2eb;color:#252722;font:16px system-ui}main{max-width:760px;margin:auto;padding:20px}article{background:white;border:1px solid #d4d0c8;border-radius:12px;padding:24px;margin:24px 0}h2{font-size:18px}.option{display:flex;gap:16px;align-items:baseline;margin:12px 0;padding:12px;border:1px solid #ddd;border-radius:8px}.option>p{margin:0}details{margin-top:20px}li{overflow-wrap:anywhere}@media(max-width:480px){main{padding:8px}article{padding:16px}}</style><main><h1>Atlas PYQ quality audit</h1><p>${result.counts.included} included. Source wording is unchanged. This uses the same semantic component tree and responsive CSS as the future quiz renderer.</p>${body}</main></html>\n`
}

export function buildCanonical({ packagePath = process.env.CANONICAL_PYQ_PACKAGE ?? resolve(root, '../canonical-pyq-v2-final.zip'), output = join(root, 'public/pyq-atlas/v1'), reports = join(here, 'reports') } = {}) {
  const canonical = loadCanonical(packagePath)
  const atlasBytes = readFileSync(join(root, 'public/atlas/v1/places.json'))
  const atlas = JSON.parse(atlasBytes)
  const index = buildEntityIndex(atlas, mappings, [...indiaCandidates, ...worldCandidates])
  const result = curate(canonical, atlas, index)
  const pipelineFiles = ['canonical-pyq.mjs', 'lib/canonical-package.mjs', 'lib/atlas-mentions.mjs', 'lib/atlas-relevance.mjs'].map((p) => [p, sha256(readFileSync(join(here, p)))])
  for (const p of ['quality.mjs', 'render.mjs', 'blocks.css']) pipelineFiles.push([p, sha256(readFileSync(join(root, 'src/atlas/pyq', p)))])
  const identity = { ...canonical.identity, pipelineVersion: PIPELINE_VERSION, pipelineHash: canonicalHash(pipelineFiles), atlasDataVersion: atlas.version, atlasHash: sha256(atlasBytes), atlasSourceHash: sourceIdentity(), mappingsHash: canonicalHash(mappings) }
  const artifacts = runtimeArtifacts(result, identity)
  // Remove only previous generated pack filenames in the explicit output. Prevent stale excluded IDs from shipping after a stricter rebuild.
  for (const dir of ['papers', 'answers']) {
    const path = join(output, dir)
    mkdirSync(path, { recursive: true })
    for (const file of readdirSync(path)) if (/^(UPSC-CSE|UPPCS|CDS)-[A-Z0-9-]+\.json$/.test(file)) rmSync(join(path, file))
  }
  for (const [path, bytes] of artifacts) writeFileSync(join(output, path), bytes)
  mkdirSync(reports, { recursive: true })
  const write = (name, value) => writeFileSync(join(reports, name), JSON.stringify(value, null, 2) + '\n')
  write('canonical-pyq-import.json', { schema: 'atlas-canonical-import-report/v1', identity, counts: result.counts, stageCounting: 'Sequential gates; reason counts overlap within a stage', candidates: result.rows })
  write('atlas-place-mentions.json', { schema: 'atlas-place-mentions/v1', identity, scannedActiveRecords: canonical.records.length, rejectedAliasDefinitions: index.rejectedAliasDefinitions, mentions: result.allMentions })
  write('atlas-relevance-review.json', { schema: 'atlas-relevance-review/v1', identity, questions: result.rows.map((r) => ({ questionId: r.questionId, ...r.relevance })) })
  write('premium-renderability-review.json', { schema: 'atlas-premium-review/v1', identity, rejected: result.rows.filter((r) => !r.premiumRenderability.pass).map((r) => ({ questionId: r.questionId, ...r.premiumRenderability })) })
  write('unresolved-geography.json', { schema: 'atlas-unresolved-geography/v1', identity, unresolved: result.unresolved, newPlaceCandidates: result.candidates, potentialNames: result.residualNames, coverageLimits: 'Exact/normalized dictionaries and geographic feature phrases; residual proper names require human review. A candidate is not a confirmed geographic identity. No unsourced places are added.' })
  writeFileSync(join(reports, 'canonical-pyq-preview.html'), auditHtml(result))
  write('canonical-pyq-audit-samples.json', auditSamples(result))
  console.log(JSON.stringify(result.counts, null, 2))
  return { result, artifacts, identity }
}

export function auditSamples(result) {
  const samples = new Map(), missing = []
  const choose = (label, predicate, newest = false) => {
    const candidates = result.included.filter(predicate).sort((a, b) => a.source.record.exam.year - b.source.record.exam.year || a.source.record.id.localeCompare(b.source.record.id, 'en'))
    const picked = newest ? candidates.at(-1) : candidates[0]
    if (!picked) { missing.push(label); return }
    const id = picked.source.record.id
    if (!samples.has(id)) samples.set(id, { questionId: id, dimensions: [] })
    samples.get(id).dimensions.push(label)
  }
  for (const exam of Object.keys(EXAM_FAMILY)) { choose(`${exam}:old`, (x) => x.source.record.exam.code === exam); choose(`${exam}:recent`, (x) => x.source.record.exam.code === exam, true) }
  for (const type of ['mcq', 'statements', 'matching', 'pairs', 'table', 'sequence', 'assertion-reason']) choose(type, (x) => x.source.record.question.type === type)
  choose('multi-place', (x) => new Set(x.relations.map((r) => r.placeId)).size >= 3)
  return { schema: 'atlas-pyq-audit-samples/v1', samples: [...samples.values()], dimensionsAbsentFromStrictSubset: missing }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const packageArg = process.argv.slice(2).find((a) => a.startsWith('--package='))
  buildCanonical(packageArg ? { packagePath: resolve(packageArg.slice('--package='.length)) } : {})
}
