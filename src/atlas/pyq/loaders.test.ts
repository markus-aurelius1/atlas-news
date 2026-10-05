/// <reference types="node" />
/** Exercise the actual lazy boundary with generated packs, including stale bytes and rejected answer/render contracts. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { loadAtlasPyqManifest, loadAtlasPyqPaper, loadPlacePyqIndex } from './loaders'
import type { AtlasPyqManifest, AtlasPyqPaper, AtlasPyqAnswers } from './types'

const root = new URL('../../../public/pyq-atlas/v1/', import.meta.url)
const bytes = (path: string) => readFileSync(new URL(path, root), 'utf8')
const manifest = JSON.parse(bytes('manifest.json')) as AtlasPyqManifest
const hash = (text: string) => createHash('sha256').update(text).digest('hex')
const installFetch = (overrides: Record<string, string> = {}) => vi.stubGlobal('fetch', vi.fn(async (url: string) => {
  const path = url.split('pyq-atlas/v1/')[1]?.split('?')[0]
  return path ? new Response(overrides[path] ?? bytes(path), { status: 200 }) : new Response('', { status: 404 })
}))
afterEach(() => vi.unstubAllGlobals())

describe('lazy canonical Atlas PYQ loading', () => {
  it('loads the manifest alone, then all verified paper/answer joins without loading the complete corpus', async () => {
    installFetch()
    const m = await loadAtlasPyqManifest()
    expect(fetch).toHaveBeenCalledTimes(1)
    const packs = await Promise.all(m.papers.map((p) => loadAtlasPyqPaper(m, p.paperId)))
    expect(packs.reduce((n, p) => n + p.paper.questions.length, 0)).toBe(m.count)
    for (const p of packs) expect(p.answers.answers.every((a) => a.status === 'final' && a.correctOptions.length)).toBe(true)
    const index = await loadPlacePyqIndex(m)
    expect(Object.keys(index.places).length).toBeGreaterThan(0)
    for (const value of Object.values(index.places)) expect(value.primaryQuestionIds.every((id) => !id.startsWith('CDS-')) && value.enrichmentQuestionIds.every((id) => id.startsWith('CDS-'))).toBe(true)
    await expect(loadAtlasPyqPaper(m, 'source-archive/paper')).rejects.toThrow('outside curated')
  })

  it('fails closed on stale or corrupted packs and permits retry after failure', async () => {
    const m = structuredClone(manifest), p = m.papers[0]
    p.questionsHash = '0'.repeat(64)
    installFetch()
    await expect(loadAtlasPyqPaper(m, p.paperId)).rejects.toThrow('integrity mismatch')
    await expect(loadAtlasPyqPaper(m, p.paperId)).rejects.toThrow('integrity mismatch')
  })

  it('rejects bad rendering and final-answer joins even when derived pack hashes are updated', async () => {
    for (const mode of ['render', 'answer', 'relevance', 'mastery']) {
      const m = structuredClone(manifest), entry = m.papers[0]
      const q = JSON.parse(bytes(entry.questions)) as AtlasPyqPaper
      const a = JSON.parse(bytes(entry.answers)) as AtlasPyqAnswers
      if (mode === 'render') q.questions[0].question.options[0].content = []
      if (mode === 'answer') a.answers[0].correctOptions = []
      if (mode === 'relevance') q.questions[0].relevance = 'incidental' as never
      if (mode === 'mastery') { q.questions[0].relations[0].semanticRole = 'distractor'; q.questions[0].relations[0].masteryEligible = true }
      const qb = JSON.stringify(q), ab = JSON.stringify(a)
      entry.questionsHash = hash(qb); entry.answersHash = hash(ab)
      installFetch({ [entry.questions]: qb, [entry.answers]: ab })
      await expect(loadAtlasPyqPaper(m, entry.paperId)).rejects.toThrow()
    }
  })
})
