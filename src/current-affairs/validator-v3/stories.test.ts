import { describe, expect, it } from 'vitest'
import type { NewsItem } from '../types'
import { buildStories, equivalentDevelopment, materialDelta, storyFrame, STORY_POLICY, type MetadataObservation, type SelectedReading } from './stories'

const day = 86400000, start = Date.parse('2026-10-01T12:00:00.000Z')
const item = (title: string, url = 'https://indianexpress.com/fixture', extra: Partial<NewsItem> = {}): NewsItem => ({ title, url, publisher: 'Indian Express', sourceId: 'ie-explained', section: 'National', description: '', publishedAt: new Date(start).toISOString(), ...extra })
const observe = (article: NewsItem, at = start): MetadataObservation => ({ item: article, observedAt: at, firstSeenAt: at })
const saved = (article: NewsItem): SelectedReading => ({ id: 'stable-reading', selectedAt: start, lastSelectedAt: start, representative: article, members: [article.url], frame: storyFrame(article) })

describe('labelled SYNTHETIC temporal replay; never natural production gold', () => {
  const original = item('Election Commission approves SIR electoral roll revision in India')
  it('same development across publishers and midnight merges with all URLs retained', () => {
    const copy = item(original.title, 'https://www.thehindu.com/copy')
    const result = buildStories([observe(original), observe(copy)], [], [], start + day)
    expect(result.units).toHaveLength(1); expect(result.units[0].members).toHaveLength(2)
  })
  it('timestamp-only updates and six new publishers cannot make a repeat novel', () => {
    const repeats = Array.from({ length: 6 }, (_, i) => observe(item(original.title, 'https://example.org/' + i, { updatedAt: new Date(start + day).toISOString() }), start + day))
    expect(buildStories(repeats, [observe(original)], [saved(original)], start + day).units[0].novelty).toBe('repeat')
  })
  it('selected identities survive missing history and never cooldown-reenter', () => {
    const result = buildStories([observe(original, start + 30 * day)], [], [saved(original)], start + 30 * day)
    expect(result.units[0]).toMatchObject({ id: 'stable-reading', novelty: 'repeat', selectedAt: start })
  })
  it('interim stay with changed legal effect is retained as material development', () => {
    const next = item('Election Commission SIR electoral roll revision: Supreme Court stays implementation in India', 'https://example.org/stay')
    expect(materialDelta(original, next)).toBe(true)
    expect(buildStories([observe(next, start + day)], [observe(original)], [saved(original)], start + day).units[0].novelty).toBe('new_development')
  })
  it('report periods, counterparts, draft/enactment and different effects cannot merge', () => {
    for (const [a, b] of [
      ['India EU approves trade agreement', 'India US approves trade agreement'],
      ['RBI reports inflation data for Q1 2026', 'RBI reports inflation data for Q2 2026'],
      ['Government drafts data protection policy', 'Government implements data protection policy'],
      ['Supreme Court approves electoral roll revision', 'Supreme Court invalidates electoral roll revision'],
    ]) expect(equivalentDevelopment(item(a), item(b, 'https://example.org/different'))).toBe(false)
  })
  it('distinct valuable constitutional analysis stays separate from report and economic analysis', () => {
    const constitutional = item('Election Commission SIR electoral roll: constitutional implications', 'https://example.org/constitutional', { section: 'Opinion' })
    const economic = item('Election Commission SIR electoral roll: economic transmission', 'https://example.org/economic', { section: 'Opinion' })
    const result = buildStories([observe(original), observe(constitutional), observe(economic)], [], [], start)
    expect(result.units).toHaveLength(3)
    expect(result.units.filter(u => u.novelty === 'distinct_analysis')).toHaveLength(2)
  })
  it('section or author difference alone does not establish an analytical angle', () => {
    expect(storyFrame(item('Election Commission approves electoral roll revision', undefined, { section: 'Opinion' })).angle).toBeNull()
  })
  it('future observations and future publication cannot leak into an earlier replay', () => {
    const result = buildStories([observe(original), observe(item('RBI changes liquidity framework', 'https://example.org/future'), start + day)], [], [], start)
    expect(result.units).toHaveLength(1)
    expect(buildStories([observe(item(original.title, undefined, { publishedAt: new Date(start + day).toISOString() }))], [], [], start).units).toHaveLength(0)
  })
  it('undated sparse material remains uncertain and cannot use observed date as event date', () => {
    const result = buildStories([observe(item('Institutions in transition', undefined, { publishedAt: null }))], [], [], start)
    expect(result.units[0].novelty).toBe('uncertain'); expect(result.units[0].frame.action).toBe('')
  })
  it('seven-day strongest comparison, 14-day context and cold start are explicit', () => {
    const result = buildStories([observe(original, start + 10 * day)], [observe(original), observe(original, start - 20 * day)], [], start + 10 * day)
    expect(result.history.every(o => o.observedAt >= start - 4 * day)).toBe(true)
    expect(result.coverage).toBe('seven_days'); expect(result.units[0].novelty).toBe('repeat')
  })
  it('permutations and repeated snapshots produce identical units', () => {
    const input = [observe(original), observe(item('RBI changes liquidity framework', 'https://example.org/rbi'))]
    expect(buildStories(input, [], [], start)).toEqual(buildStories([...input].reverse(), [], [], start))
  })
  it('a shared institution or number cannot chain distinct developments', () => {
    expect(equivalentDevelopment(original, item('Election Commission approves data protection framework in India', 'https://example.org/other'))).toBe(false)
    expect(equivalentDevelopment(item('UPSC Key: quantum research and inflation'), item('UPSC Key: quantum research and inflation', 'https://example.org/digest'))).toBe(false)
  })
  it('crowded history abstains explicitly instead of sampling or performing an unbounded strongest search', () => {
    const history = Array.from({ length: STORY_POLICY.maxComparisonBucket + 1 }, (_, i) => observe(item('RBI changes liquidity framework ' + i, 'https://example.org/' + i)))
    const next = observe(item('RBI changes liquidity framework', 'https://example.org/next'), start + day)
    const result = buildStories([next], history, [], start + day)
    expect(result.units[0]).toMatchObject({ novelty: 'uncertain', reason: 'comparison_budget_exceeded' })
    expect(result.comparisons).toBe(0)
    expect(buildStories([next], [...history].reverse(), [], start + day)).toEqual(result)
  })
})
