/** Lazy, hash-verified canonical subset loading. Nothing is loaded on Atlas startup until a caller requests PYQs. */
import type { AtlasPyqManifest, AtlasPyqPaper, AtlasPyqAnswers, PlacePyqIndex, CorpusIdentity } from './types'
import { premiumRenderability } from './quality.mjs'

const base = `${import.meta.env.BASE_URL}pyq-atlas/v1/`
const accepted = new Set(['direct-spatial', 'place-centric', 'spatial-association'])
const family = { 'UPSC-CSE': 'CSE', UPPCS: 'PCS', CDS: 'CDS' }
const stable = (value: unknown): unknown => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable((value as Record<string, unknown>)[key])])) : value
const digest = async (bytes: Uint8Array<ArrayBuffer>) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((n) => n.toString(16).padStart(2, '0')).join('')
const hashObject = (value: unknown) => digest(new TextEncoder().encode(JSON.stringify(stable(value))))
const assert: (ok: unknown, message: string) => asserts ok = (ok, message) => { if (!ok) throw new Error(message) }
const sameIdentity = (a: CorpusIdentity, b: CorpusIdentity) => JSON.stringify(stable(a)) === JSON.stringify(stable(b))
const packCache = new Map<string, Promise<{ paper: AtlasPyqPaper; answers: AtlasPyqAnswers }>>()

async function fetchJson<T>(path: string, hash?: string): Promise<T> {
  assert(/^(?:manifest\.json|place-pyq-index\.json|(?:papers|answers)\/(?:UPSC-CSE|UPPCS|CDS)-[A-Z0-9-]+\.json)$/.test(path), 'Invalid Atlas PYQ path')
  const response = await fetch(`${base}${path}${hash ? `?hash=${hash}` : ''}`)
  if (!response.ok) throw new Error(`Atlas PYQ load failed: ${response.status}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (hash && await digest(bytes) !== hash) throw new Error(`Atlas PYQ integrity mismatch: ${path}`)
  return JSON.parse(new TextDecoder().decode(bytes)) as T
}

export async function loadAtlasPyqManifest(): Promise<AtlasPyqManifest> {
  const manifest = await fetchJson<AtlasPyqManifest>('manifest.json')
  assert(manifest.schema === 'atlas-pyq-manifest/v1' && manifest.identity.canonicalRelease === '2.1.0' && manifest.identity.canonicalSchema === 'canonical-pyq/v2', 'Unsupported Atlas PYQ manifest')
  assert(manifest.papers.reduce((n, p) => n + p.count, 0) === manifest.count && new Set(manifest.papers.map((p) => p.paperId)).size === manifest.papers.length, 'Atlas PYQ manifest inventory mismatch')
  for (const p of manifest.papers) assert(family[p.exam] === p.family && (p.exam === 'CDS' ? p.corpusRole === 'secondary' : p.corpusRole === 'primary'), 'Atlas PYQ exam family mismatch')
  for (const p of manifest.papers) assert(p.questions === `papers/${p.paperId}.json` && p.answers === `answers/${p.paperId}.json` && Number.isInteger(p.count) && p.count > 0, 'Atlas PYQ manifest pack path mismatch')
  return manifest
}

export function loadAtlasPyqPaper(manifest: AtlasPyqManifest, paperId: string) {
  const entry = manifest.papers.find((p) => p.paperId === paperId)
  if (!entry) return Promise.reject(new Error('Paper outside curated Atlas inventory'))
  const key = `${manifest.identity.pipelineHash}:${paperId}:${entry.questionsHash}:${entry.answersHash}`
  if (!packCache.has(key)) {
    const promise = (async () => {
      const [paper, answers] = await Promise.all([fetchJson<AtlasPyqPaper>(entry.questions, entry.questionsHash), fetchJson<AtlasPyqAnswers>(entry.answers, entry.answersHash)])
      assert(paper.schema === 'atlas-pyq-paper/v1' && answers.schema === 'atlas-pyq-answers/v1' && paper.paperId === paperId && answers.paperId === paperId && sameIdentity(paper.identity, manifest.identity) && sameIdentity(answers.identity, manifest.identity), 'Atlas PYQ pack identity mismatch')
      assert(paper.questions.length === entry.count && answers.answers.length === entry.count && new Set(paper.questions.map((q) => q.id)).size === entry.count, 'Atlas PYQ pack count mismatch')
      const byId = new Map(answers.answers.map((a) => [a.questionId, a]))
      assert(byId.size === entry.count, 'Atlas PYQ duplicate answer')
      for (const q of paper.questions) {
        const a = byId.get(q.id)
        assert(q.schema === 'atlas-pyq-question/v1' && a?.schema === 'atlas-pyq-answer/v1' && a.id === q.answerId && a.status === 'final' && a.correctOptions.length && new Set(a.correctOptions).size === a.correctOptions.length && a.correctOptions.every((k) => ['A', 'B', 'C', 'D'].includes(k)), 'Atlas PYQ invalid final answer join')
        assert(q.id === `${paperId}-Q${String(q.question.number).padStart(3, '0')}` && q.exam.code === entry.exam && q.exam.year === entry.year && q.exam.cycle === entry.cycle && q.family === entry.family && q.exam.corpus_role === entry.corpusRole, 'Atlas PYQ source identity mismatch')
        assert(accepted.has(q.relevance) && premiumRenderability(q.question).pass && q.relations.some((r) => r.placeId && r.semanticRole !== 'incidental' && r.semanticRole !== 'distractor'), 'Atlas PYQ question outside quality contract')
        assert(q.relations.every((r) => r.questionId === q.id && r.quizIncluded && r.relevance === q.relevance && !(r.masteryEligible && (r.semanticRole !== 'primary' || r.locationInQuestion !== 'stem'))), 'Atlas PYQ unsafe mastery relation')
        assert(await hashObject(q.question) === q.baseQuestionHash && await hashObject({ status: a.status, correct_options: a.correctOptions }) === a.suppliedAnswerHash, 'Atlas PYQ canonical hash mismatch')
      }
      return { paper, answers }
    })()
    packCache.set(key, promise)
    void promise.catch(() => packCache.delete(key))
  }
  return packCache.get(key)!
}

export async function loadPlacePyqIndex(manifest: AtlasPyqManifest): Promise<PlacePyqIndex> {
  const index = await fetchJson<PlacePyqIndex>(manifest.placeIndex, manifest.placeIndexHash)
  assert(index.schema === 'atlas-place-pyq-index/v1' && sameIdentity(index.identity, manifest.identity), 'Atlas PYQ place index identity mismatch')
  return index
}
