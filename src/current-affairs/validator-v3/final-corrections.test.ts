import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { evaluateStageC } from './stage-c'
import { classifySubject } from './subject'
import { buildStories, equivalentDevelopment, storyFrame } from './stories'
import type { StageCObservation } from './contracts'
import type { NewsItem } from '../types'
const versions = { policyId: 'tars-validator-stage-c/1', policyHash: 'a'.repeat(64), indexHash: 'a'.repeat(64), registryHash: 'a'.repeat(64), authorHash: 'a'.repeat(64), codeHash: 'a'.repeat(64) }
function decide(title: string, description = '') {
  const o: StageCObservation = { id: 'synthetic-final', captureId: 'synthetic', sourceId: 'ie-india', ordinal: 0, capturedAt: '2026-10-07T00:00:00.000Z', parserVersion: 'synthetic', registryHash: versions.registryHash, metadataHash: 'b'.repeat(64), metadata: { title, description, url: 'https://indianexpress.com/synthetic-final', publisher: 'Indian Express', publishedAt: null, updatedAt: null, categories: [], memberships: [], bylines: [] } }
  return evaluateStageC({ observations: [o], clock: '2026-10-08T00:00:00.000Z', versions }).articles[0]
}
const item = (title: string, url: string, description = ''): NewsItem => ({ title, url, description, publisher: 'Synthetic', sourceId: 'synthetic', section: 'News', publishedAt: '2026-10-07T00:00:00.000Z' })
describe('final corrections: exposed natural regressions and labelled synthetic contrasts', () => {
  it.each([
    ['RBI revises GDP growth forecast to 6.8 per cent for FY29', 'A brokerage raises GDP growth forecast to 6.8 per cent for FY29', 'Economy'],
    ['Can AI be conscious? A question of value alignment', 'AI company announces a funding round and a new office', 'Sci-Tech'],
    ['How does detention differ from arrest: rights of detainees', 'Opposition leader detained during a street protest', 'Polity'],
  ])('compound concept has independent support: %s', (positive, adjacent, subject) => {
    expect(decide(positive).accepted).toBe(true)
    expect(classifySubject({ title: positive, description: '' }).primary).toBe(subject)
    expect(decide(adjacent).accepted).toBe(false)
    expect(decide('Corporate AI promotion: buy now', positive).decision).toBe('rejected')
  })
  it('classifies incidents independently while preserving missing systemic evidence', () => {
    for (const title of ['Naval base staffer held for sharing information with another country', 'Items drone-dropped from Pakistan seized']) {
      expect(classifySubject({ title, description: '' }).primary).toBe('Security')
      expect(decide(title).decision).toBe('deferred')
    }
  })
  it('hard exclusions do not reject commodity-policy analysis or focused macro updates', () => {
    expect(decide('Gold Rate Today: check 24 carat prices in cities').decision).toBe('rejected')
    expect(decide('World News Live Updates: mixed stories').decision).toBe('rejected')
    expect(decide('BJP says learn from a leader to win voters support').decision).toBe('rejected')
    expect(decide('RBI cuts policy rates after inflation review').accepted).toBe(true)
  })
  it('importance depends on evidenced consequence, not every policy or science story', () => {
    expect(decide('RBI hikes repo rate by 50 basis points, changes stance to tightening').relevance.status).toBe('must_read_candidate')
    expect(decide('RBI cuts policy rates').relevance.status).toBe('useful')
    expect(decide('Chemistry Nobel awarded for discovery of autocatalysis in organic synthesis').relevance.status).toBe('must_read_candidate')
    expect(decide('Physics Nobel awarded for neutrino discovery').relevance.status).toBe('useful')
    expect(decide('RBI monetary policy meeting begins', 'Economists discuss risks of future inflation and a likely rate hike.').relevance.status).toBe('useful')
    expect(decide('How monetary policy affects inflation transmission in India').relevance.status).toBe('must_read_candidate')
  })
  it('negated changes and revisiting do not invent a new action', () => {
    for (const title of ['RBI kept interest rates unchanged', 'Revisiting nuclear doctrine without revising it', 'RBI does not change liquidity rules']) expect(storyFrame(item(title, 'https://example.org/a')).action).toBe('')
    expect(storyFrame(item('RBI revises liquidity rules', 'https://example.org/a')).action).toBe('changes')
  })
  it('natural Physics reports reconcile by observed scientist and mechanism, preserving the explanation', () => {
    const rows = JSON.parse(readFileSync('docs/owner-validation-v1/owner-review.original.json', 'utf8')).records
    const natural = (n: number) => ({ ...rows[n - 1].metadata, sourceId: 'natural', section: rows[n - 1].metadata.memberships[0].section }) as NewsItem
    for (const [a, b] of [[4, 13], [4, 17], [13, 17]]) expect(equivalentDevelopment(natural(a), natural(b))).toBe(true)
    for (const n of [4, 13, 17]) expect(equivalentDevelopment(natural(n), natural(15))).toBe(false)
    const now = Date.parse('2026-10-07T13:40:55.600Z')
    expect(buildStories([4, 13, 15, 17].map(n => ({ item: natural(n), observedAt: now, firstSeenAt: now })), [], [], now).units).toHaveLength(2)
    expect(storyFrame(natural(15)).angle).toBe('scientific-mechanism')
    expect([5, 14, 16].map(n => storyFrame(natural(n)).angle)).toEqual(['inflation-government-burden', 'price-stability-rationale', 'future-tightening-outlook'])
    expect(decide(natural(6).title, natural(6).description).relevance.status).toBe('must_read_candidate')
  })
  it('unknown awards cannot borrow a publication year, different recipients or mechanisms', () => {
    const a = item('Alice Smith wins Physics Nobel for neutrino discovery', 'https://example.org/a')
    const b = item('Physics Nobel 2028 awarded to Alice Smith for neutrino discovery', 'https://example.org/b')
    expect(equivalentDevelopment(a, b)).toBe(true)
    for (const title of ['Physics Nobel 2027 awarded to Alice Smith for neutrino discovery', 'Bob Jones wins Physics Nobel for neutrino discovery', 'Alice Smith wins Physics Nobel for quantum tunnelling discovery', 'Physics Nobel awarded for neutrino discovery', 'How Alice Smith wins Physics Nobel for neutrino discovery']) {
      expect(equivalentDevelopment(b, item(title, 'https://example.org/c'))).toBe(false)
    }
    expect(equivalentDevelopment({ ...a, title: 'Physics Nobel 2029 awarded to Alice Smith for neutrino discovery' }, b)).toBe(false)
  })
  it('same superficial analysis wording does not confer arbitrary unique angles', () => {
    const a = item('RBI policy rate analysis', 'https://example.org/a')
    expect(storyFrame({ ...a, section: 'Opinion' }).angle).toBeNull()
    expect(storyFrame(item('RBI policy: signals further tightening', 'https://example.org/a')).angle).toBe('future-tightening-outlook')
    const original = item('RBI policy signals further tightening', 'https://example.org/a')
    const variation = item('RBI policy signals further tightening ahead', 'https://example.org/b')
    expect(equivalentDevelopment(original, variation)).toBe(true)
    const now = Date.parse(original.publishedAt!)
    expect(buildStories([original, variation].map(item => ({ item, observedAt: now, firstSeenAt: now })), [], [], now).units).toHaveLength(1)
    expect(equivalentDevelopment(original, item('RBI policy: need to protect price stability', 'https://example.org/c'))).toBe(false)
  })
})
