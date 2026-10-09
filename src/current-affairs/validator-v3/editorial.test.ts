import { describe, expect, it } from 'vitest'
import day from '../fixtures/editorial-day.json' with { type: 'json' }
import cases from '../fixtures/relevance-cases.json' with { type: 'json' }
import { NEWS_SUBJECTS } from '../subjects'
import type { NewsItem, RelevanceIndex } from '../types'
import { evaluateProduction } from './adapter'
import { assess, EDITORIAL_POLICY, readingSubject, TOPICS } from './editorial'
import { SUBJECTS } from './subject'

const item = (title: string, extra: Partial<NewsItem> = {}): NewsItem => ({ title, description: '', publisher: 'The Hindu', sourceId: 'hindu-national', section: 'National', url: 'https://www.thehindu.com/x', publishedAt: '2026-10-09T06:00:00.000Z', ...extra })
const reasons = (title: string, extra?: Partial<NewsItem>) => assess(item(title, extra)).reasons.map(r => r.label)
const index: RelevanceIndex = { version: 2, provenance: {}, signals: [] }

describe('the owner’s review of the 2026-10-09 list', () => {
  it.each(day.flagged.map(i => [i.title, i] as const))('does not offer: %s', (_, flagged) => {
    expect(assess(flagged).accepted).toBe(false)
  })
  it.each(day.wanted.map(i => [i.title, i] as const))('offers: %s', (_, wanted) => {
    const verdict = assess(wanted)
    expect(verdict.accepted, JSON.stringify(verdict.reasons)).toBe(true)
  })
  it('shelves each reading under the subject it is about', () => {
    const subject = (title: string) => readingSubject(day.wanted.find(i => i.title.includes(title))!)
    expect(subject('Chilika')).toBe('Environment'); expect(subject('nuclear clocks')).toBe('Sci-Tech'); expect(subject('CRR')).toBe('Economy')
    expect(subject('India-Turkey')).toBe('International relations'); expect(subject('anti-submarine')).toBe('Security'); expect(subject('BNSS')).toBe('Polity')
    expect(subject('road crashes')).toBe('Governance'); expect(subject('Literature Nobel')).toBe('History & Culture'); expect(subject('World economic growth')).toBe('Economy')
  })
  it('offers each running story once, led by the reading the owner named, and nothing they rejected', async () => {
    const all = [...day.flagged, ...day.wanted, ...Object.values(day.topics).flat()], feed = { version: 1 as const, fetchedAt: day.fetchedAt, items: [...new Map(all.map(i => [i.url, i])).values()], sources: [] }
    const { output, events } = await evaluateProduction(feed, index, { history: [], selected: [] }, day.fetchedAt)
    const today = output.selection.today, shown = new Set(today.flatMap(r => r.unit.members.map(m => m.url)))
    for (const flagged of day.flagged) expect(shown.has(flagged.url), flagged.title).toBe(false)
    // The day's digest ("UPSC Key: GST Council, …") is a reading of its own and stands outside the topics it lists.
    const leads = (urls: { url: string }[]) => today.filter(r => urls.some(u => u.url === r.primary.item.url)).map(r => r.primary.item.title).filter(title => !title.startsWith('UPSC Key'))
    expect(leads(day.topics.gst)).toEqual(['What are the reforms proposed by the GST Council?'])
    expect(leads(day.topics.visa)).toHaveLength(1); expect(leads(day.topics.nobelPeace)).toHaveLength(1); expect(leads(day.topics.nta)).toHaveLength(1)
    // El Niño itself is listed once, under Geography; the forest study dated to an El Niño year is an Environment reading of its own.
    const elNino = today.filter(r => day.topics.elNino.some(u => u.url === r.primary.item.url))
    expect(elNino.filter(r => r.primary.subject.primary === 'Geography')).toHaveLength(1); expect(elNino.map(r => r.primary.subject.primary).sort()).toEqual(['Environment', 'Geography'])
    expect(today.length).toBeLessThanOrEqual(50)
    // Every reading has a subject of its own: nothing is left under a catch-all.
    for (const event of events) expect(NEWS_SUBJECTS as readonly string[]).toContain(event.primary.relevance.subjects[0])
    // The first readings of the day are the strongest ones.
    expect(today.map(r => r.quality)).toEqual([...today.map(r => r.quality)].sort((a, b) => b - a))
  })
})

describe('what raises and lowers a reading', () => {
  it('needs a syllabus topic and a development; a topic alone is not news', () => {
    expect(assess(item('Auto driver rescues six-year-old thrown into lake')).excluded).toBe('No syllabus topic in headline or summary')
    expect(reasons('The left-hand-drive Ford Saloon that served Indian Air Force chiefs for 23 years')).toContain('No development reported')
    expect(reasons('Juvenile fish harvesting raises concerns along Malabar coast')).not.toContain('law or policy action')
    expect(reasons('Jal Jeevan Mission well full, but residents yet to get water')).not.toContain('scientific or technical advance')
  })
  it('separates the Union’s decisions from a State’s daily business', () => {
    expect(reasons('Cabinet clears Bill to guarantee rights for senior citizens')).toEqual(expect.arrayContaining(['National institution or scope', 'Decision by a national institution']))
    const state = reasons('Keralam Cabinet clears Bill to guarantee rights for senior citizens')
    expect(state).toContain('State or local administration'); expect(state).not.toContain('Decision by a national institution')
    expect(reasons('Delhi HC stays order mandating Aadhaar biometrics-enabled attendance for prosecutors')).toContain('State or local administration')
  })
  it('discounts politics, litigation, remarks, companies and consumer advice', () => {
    expect(reasons('Opposition slams Centre over electoral roll revision')).toContain('Party politics, protest or election contest')
    expect(reasons('SC junks petition seeking probe into FIRs on electoral roll protests')).toContain('Case-level litigation or police action')
    expect(reasons('India needs level playing field on spectrum: Rahul Gandhi')).toContain('Report of a remark')
    expect(reasons('Inflation will ease by March, says RBI')).not.toContain('Report of a remark')
    expect(reasons('TCS says green card action will not hurt hiring')).toContain('Company or market story')
    expect(reasons('UPI vs credit cards: What should you choose for payments?')).toContain('Consumer or personal-finance advice')
    expect(reasons('India, Pakistan summon top envoys in tit-for-tat move')).not.toContain('Case-level litigation or police action')
  })
  it('keeps another country’s domestic affairs out, and the neighbourhood, science and global bodies in', () => {
    expect(reasons('UK households would be £5,000 richer with more innovation', { publisher: 'Guardian', sourceId: 'guardian-science', section: 'Science' })).toContain('Another country’s domestic affairs')
    expect(assess(item('Will El Niño and the polar vortex bring snow to the UK this winter?', { publisher: 'BBC', sourceId: 'ext-bbc-science-environment', section: 'Science & environment' })).accepted).toBe(false)
    expect(reasons('As flood risk increases in Himalayas, Nepal builds more in vulnerable areas', { publisher: 'New York Times', sourceId: 'nyt-climate', section: 'Climate' })).not.toContain('Set abroad')
    expect(reasons('El Nino to continue to intensify ahead of its forecast peak in Dec: WMO')).toContain('International body or award')
  })
  it('an explainer’s occasion is not its subject', () => {
    const explainer = assess(item('Before CJP protest, BNSS Section 163 imposed in New Delhi: What this means', { publisher: 'Indian Express', sourceId: 'ie-explained', section: 'Explained' }))
    expect(explainer.accepted).toBe(true); expect(explainer.reasons.find(r => r.label.startsWith('Party politics'))!.points).toBe(-0.5)
    expect(assess(item('CJP protest: Delhi Police deny permission for Jantar Mantar rally, cite BNSS Section 163')).accepted).toBe(false)
  })
  it('never offers quizzes, live blogs, digests, horoscopes or dated trivia', () => {
    for (const title of ['UPSC Daily Quiz: Environment MCQs', 'Bypoll results LIVE updates: Ruling parties sweep', 'In 1986, Onondaga Lake reopened to fishing after sewage made it infamous', 'Horoscope today: what the stars say about monsoon']) expect(assess(item(title)).excluded, title).toBeTruthy()
  })
  it('lists every point behind a verdict, and the points sum to the score', () => {
    for (const wanted of day.wanted) { const v = assess(wanted); expect(Math.abs(v.reasons.reduce((n, r) => n + r.points, 0) - v.score)).toBeLessThan(0.11) }
  })
})

describe('the policy as a whole', () => {
  it('gives every subject a vocabulary of its own and ranks the dynamic subjects first', () => {
    for (const subject of SUBJECTS) expect(TOPICS.some(t => t.subject === subject && t.weight === 3), subject).toBe(true)
    const order = [...SUBJECTS].sort((a, b) => EDITORIAL_POLICY.subjectPriority[b] - EDITORIAL_POLICY.subjectPriority[a])
    expect(order.slice(0, 4).sort()).toEqual(['Economy', 'Environment', 'International relations', 'Sci-Tech'])
    expect(EDITORIAL_POLICY.subjectFloor.Polity).toBeGreaterThan(EDITORIAL_POLICY.floor)
  })
  it('is precise on the hand-labelled feed sample and finds at least half of what was labelled relevant', () => {
    let tp = 0, fp = 0, fn = 0
    for (const c of cases.cases) {
      if (c.label === 'borderline') continue
      const accepted = assess({ url: 'https://example.org/x', publishedAt: null, ...c }).accepted
      if (c.label === 'relevant') { if (accepted) tp++; else fn++ } else if (accepted) fp++
    }
    // The sample predates the owner's stricter standard for Polity, State and litigation items, so recall is a floor, not a target.
    expect(tp / (tp + fp)).toBeGreaterThanOrEqual(0.95); expect(tp / (tp + fn)).toBeGreaterThanOrEqual(0.5)
  })
  it('falls back to the feed’s section for an article with no topic, never to a catch-all', () => {
    expect(readingSubject(item('A quiet week', { section: 'World', sourceId: 'hindu-world' }))).toBe('International relations')
    expect(readingSubject(item('A quiet week', { section: 'Science', sourceId: 'hindu-science' }))).toBe('Sci-Tech')
    expect(readingSubject(item('A quiet week'))).toBe('Governance')
  })
})
