/** Story clustering: one event from many publishers, a five-article cap, and the bar a single-publisher story must clear. */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ANCHOR_PUBLISHERS, MAX_STORY_ARTICLES, SOLO_STORY_THRESHOLD, clusterItems, similarity } from './cluster'
import { eventPersonalState, type PersonalState } from './personal-state'
import { ACCEPT_THRESHOLD, classify } from './relevance'
import { groupTopics } from './topics'
import type { ClassifiedItem, NewsItem, RelevanceIndex } from './types'
import { buildWorkspace } from './workspace'

const index: RelevanceIndex = JSON.parse(readFileSync(new URL('../../public/current-affairs/v2/relevance-index.json', import.meta.url), 'utf8'))
let n = 0
const article = (title: string, publisher: string, sourceId: string, overrides: Partial<NewsItem> = {}): ClassifiedItem => {
  const row: NewsItem = { title, description: '', publisher, sourceId, section: 'India', url: `https://example.org/${++n}`, publishedAt: '2026-10-05T06:00:00Z', ...overrides }
  return { ...row, relevance: classify(row, index) }
}
/** Real headlines from one morning's coverage of a single Supreme Court hearing. */
const hearing = () => [
  article('Supreme Court notice to ECI, Centre on plea challenging decisions taken by CEC-led poll panel', 'The Hindu', 'hindu-national', { section: 'National' }),
  article('SC notice to EC, Centre on PILs seeking to restrain Gyanesh Kumar from functioning as CEC', 'The Tribune', 'tribune-india'),
  article('SC declines interim order on plea for CEC Gyanesh Kumar’s suspension, seeks EC response', 'Scroll.in', 'india-scroll-in', { section: 'Latest' }),
  article('SC refuses to restrain CEC Gyanesh Kumar on plea, seeks Election Commission response', 'Hindustan Times', 'ht-india'),
  article('SC Notice To ECI On SIR Row, Declines Interim Stay On CEC Gyanesh Kumar', 'India Today', 'india-india-today-india'),
  article('SC Refuses To Suspend CEC Gyanesh Kumar, Issues Notice On Unilateral Decision Plea', 'India Today', 'india-india-today-india'),
  article('Supreme Court issues notice to Centre, poll panel over CEC Gyanesh Kumar’s functioning; no interim order', 'Hindustan Times', 'ht-india'),
]

describe('one event, many publishers', () => {
  it('merges differently worded reports into one story led by a preferred paper', () => {
    const items = hearing(), events = clusterItems(items)
    expect(items.every(i => i.relevance.accepted)).toBe(true)
    expect(events).toHaveLength(1)
    expect(ANCHOR_PUBLISHERS).toContain(events[0].primary.publisher)
    expect(events[0].primary).toBe(events[0].members[0])
  })
  it('shows at most five articles, one per publisher first, and keeps the rest as identities', () => {
    const items = hearing(), [story] = clusterItems(items)
    expect(story.members).toHaveLength(MAX_STORY_ARTICLES)
    expect(new Set(story.members.map(m => m.publisher)).size).toBe(5)
    expect(story.overflow).toHaveLength(items.length - MAX_STORY_ARTICLES)
    expect([...story.members.map(m => m.url), ...story.overflow!].sort()).toEqual(items.map(i => i.url).sort())
    expect(story.id).toBe(items.map(i => i.url).sort()[0])
  })
  it('keeps a story read when the article that was opened is no longer one of the five shown', () => {
    const [story] = clusterItems(hearing()), state: PersonalState = { version: 1, entries: { [story.overflow![0]]: { readAt: 5 } } }
    expect(eventPersonalState(story, state).readAt).toBe(5)
  })
  it('does not depend on the order articles arrive in', () => {
    const items = hearing(), shape = (list: ClassifiedItem[]) => clusterItems(list).map(e => [e.id, e.members.map(m => m.url), e.overflow])
    expect(shape([...items].reverse())).toEqual(shape(items))
  })
  it('matches abbreviations, spelling variants and concepts rather than exact wording', () => {
    const a = article('RBI likely to raise repo rate in October as inflation risks mount', 'Mint', 'mint-economy'), b = article('Reserve Bank may hike rates next month amid inflation pressure', 'Business Standard', 'bs-economy')
    expect(clusterItems([a, b])).toHaveLength(1)
    expect(similarity(a, b)).toBeGreaterThan(0.2)
  })
})

describe('stories that run past midnight', () => {
  const evening = () => article('Supreme Court notice to ECI, Centre on plea challenging decisions taken by CEC-led poll panel', 'The Hindu', 'hindu-national', { publishedAt: '2026-10-04T16:00:00Z' })
  const morning = (at: string) => article('SC notice to EC, Centre on PILs seeking to restrain Gyanesh Kumar from functioning as CEC', 'The Tribune', 'tribune-india', { publishedAt: at })
  it('joins the next morning’s report to the evening’s story', () => {
    const events = clusterItems([evening(), morning('2026-10-05T03:00:00Z')])
    expect(events).toHaveLength(1)
    expect(events[0].members).toHaveLength(2)
  })
  it('does not chain a story across a longer gap', () => {
    expect(clusterItems([evening(), morning('2026-10-06T03:00:00Z')])).toHaveLength(2)
  })
  it('keeps the newest report among the five shown', () => {
    const late = article('Supreme Court notice to Election Commission on CEC Gyanesh Kumar plea: what happens next', 'Mint', 'mint-politics', { section: 'Politics', publishedAt: '2026-10-05T09:00:00Z' })
    const [story] = clusterItems([...hearing(), late])
    expect(story.members).toHaveLength(MAX_STORY_ARTICLES)
    expect(story.members).toContain(late)
  })
})

describe('distinct stories stay apart', () => {
  it('does not merge different developments that share an institution or a concept', () => {
    const items = [
      article('Supreme Court strikes down electoral bonds scheme as unconstitutional', 'The Hindu', 'hindu-national'),
      article('Supreme Court upholds constitutional validity of tribunal reforms law', 'Indian Express', 'ie-india'),
      article('GST Council approves input tax credit reform for exporters', 'Mint', 'mint-economy'),
      article('RBI raises repo rate as inflation risks mount', 'Indian Express', 'ie-economy'),
    ]
    expect(clusterItems(items)).toHaveLength(4)
  })
  it('does not merge the same headline on another day, or undated articles', () => {
    const a = article('RBI raises repo rate as inflation risks mount', 'Indian Express', 'ie-economy')
    expect(clusterItems([a, { ...a, url: 'https://example.org/later', publishedAt: '2026-10-07T06:00:00Z' }, { ...a, url: 'https://example.org/undated', publishedAt: null }])).toHaveLength(3)
  })
})

describe('stories that only look alike', () => {
  const eu = () => [
    article('India-EU trade deal to boost exports in labour-intensive sectors, says FM Sitharaman', 'The Tribune', 'tribune-business', { section: 'Business' }),
    article('FM Sitharaman hails India-EU trade deal at Munich Leaders Meeting', 'The Hindu', 'hindu-economy', { section: 'Economy' }),
  ]
  const us = () => [
    article('India-US trade deal talks hit plateau, says FM Sitharaman', 'Times of India', 'toi-business', { section: 'Business' }),
    article('India, US trade deal talks have reached a plateau, says FM Nirmala Sitharaman', 'Business Standard', 'bs-economy', { section: 'Economy' }),
  ]
  const titles = (items: ClassifiedItem[]) => clusterItems(items).map(e => e.members.map(m => m.title).sort()).sort()
  it('keeps India–EU and India–US apart although the minister, the subject and the words overlap', () => {
    const a = eu(), b = us()
    expect(titles([...a, ...b])).toEqual([a.map(i => i.title).sort(), b.map(i => i.title).sort()].sort())
    expect(similarity(a[0], b[0])).toBe(0)
  })
  it('keeps a third country’s talks with the same partner apart', () => {
    const iran = article('Iran tells US there is no military solution to war as nuclear talks hit impasse', 'South China Morning Post', 'ext-scmp', { section: 'World' })
    const events = clusterItems([...us(), iran])
    expect(events.find(e => e.members.includes(iran))?.members ?? [iran]).toEqual([iran])
  })
  it('never lets a multi-topic digest join or bridge stories', () => {
    const a = eu(), b = us()
    const digest = article('UPSC Key: India-EU trade deal, India-US trade deal talks and FM Sitharaman', 'Indian Express', 'ie-upsc', { section: 'UPSC Current Affairs' })
    expect(digest.relevance.accepted).toBe(true)
    const events = clusterItems([...a, ...b, digest])
    expect(events).toHaveLength(3)
    expect(events.find(e => e.members.includes(digest))!.members).toEqual([digest])
  })
  it('does not link reports through a shared number', () => {
    const a = article('Centre’s fertiliser subsidy pilot in 22 districts yields ₹1,500 crore savings', 'BusinessLine', 'bl-economy', { section: 'Economy' })
    const b = article('Nearly 1,500 Myanmar refugees repatriated from Malaysia as UN warns of risks', 'Hindustan Times', 'ht-world', { section: 'World' })
    expect(similarity(a, b)).toBe(0)
  })
  it('merges reports that share a named body and its business', () => {
    const items = [
      article('GST Council may allow single application for GST registrations across multiple states', 'BusinessLine', 'bl-economy', { section: 'Economy' }),
      article('GST Council to consider single GST registration across states on Wednesday', 'Business Standard', 'bs-economy', { section: 'Economy' }),
      article('GST Council may clear single registration for businesses in multiple states', 'Hindustan Times', 'ht-business', { section: 'Business' }),
    ]
    expect(clusterItems(items)).toHaveLength(1)
  })
})

describe('single-publisher stories', () => {
  const weak = () => article('Gujarat plans rooftop solar policy for 15,000 more government buildings', 'BusinessLine', 'bl-national', { section: 'National' })
  it('drops a story only one publisher carries unless it is a strong match on its own', () => {
    const solo = weak()
    expect(solo.relevance.accepted).toBe(true)
    expect(solo.relevance.score).toBeGreaterThanOrEqual(ACCEPT_THRESHOLD)
    expect(solo.relevance.score).toBeLessThan(SOLO_STORY_THRESHOLD)
    expect(clusterItems([solo])).toHaveLength(0)
    expect(clusterItems([solo], { soloThreshold: 0 })).toHaveLength(1)
    const strong = article('Supreme Court strikes down electoral bonds scheme as unconstitutional', 'The Hindu', 'hindu-national')
    expect(strong.relevance.score).toBeGreaterThanOrEqual(SOLO_STORY_THRESHOLD)
    expect(clusterItems([strong])).toHaveLength(1)
  })
  it('keeps the same story once a second publisher reports it', () => {
    const second = article('Gujarat to add rooftop solar on 15,000 government buildings under new policy', 'The Hindu', 'hindu-national', { section: 'National' })
    const events = clusterItems([weak(), second])
    expect(events).toHaveLength(1)
    expect(events[0].members).toHaveLength(2)
  })
  it('never promotes a rejected article, alone or inside a story', () => {
    const noise = article('Cricket: India wins the final as RBI governor watches', 'The Hindu', 'hindu-national')
    expect(noise.relevance.accepted).toBe(false)
    const events = clusterItems([...hearing(), noise])
    expect(events.flatMap(e => [...e.members.map(m => m.url), ...(e.overflow ?? [])])).not.toContain(noise.url)
  })
})

describe('topic groups on the reading list', () => {
  it('never fold more than five articles under one row', () => {
    const stories = [
      ...hearing(),
      article('Election Commission to hold special revision of voter rolls ahead of assembly elections', 'Indian Express', 'ie-india'),
      article('Election Commission orders special revision of voter rolls before assembly elections', 'The Hindu', 'hindu-national'),
      article('Electoral bonds data: Election Commission publishes donor lists after Supreme Court order', 'Indian Express', 'ie-explained', { section: 'Explained' }),
    ]
    const events = buildWorkspace(clusterItems(stories), index), groups = groupTopics(events)
    expect(events.length).toBeGreaterThan(1)
    expect(groups.every(g => g.count <= MAX_STORY_ARTICLES)).toBe(true)
    expect(groups.reduce((sum, g) => sum + g.count, 0)).toBe(events.reduce((sum, e) => sum + e.members.length, 0))
    expect(new Set(groups.map(g => g.key)).size).toBe(groups.length)
  })
})

describe('ranking and the day’s list', () => {
  it('values corroborated, preferred-paper and explained coverage above a lone report of the same strength', async () => {
    const { storyValue } = await import('./workspace')
    const lone = clusterItems([article('Supreme Court strikes down electoral bonds scheme as unconstitutional', 'Business Standard', 'bs-india')])[0]
    const covered = clusterItems([
      article('Supreme Court strikes down electoral bonds scheme as unconstitutional', 'Business Standard', 'bs-india'),
      article('Electoral bonds scheme struck down as unconstitutional by Supreme Court', 'The Hindu', 'hindu-national', { section: 'National' }),
      article('Explained: Why the Supreme Court struck down the electoral bonds scheme as unconstitutional', 'Indian Express', 'ie-explained', { section: 'Explained' }),
    ])[0]
    expect(covered.members).toHaveLength(3)
    const a = storyValue(lone, index), b = storyValue(covered, index)
    expect(b.value).toBeGreaterThan(a.value + 3)
    expect(b.valueReasons.join(' | ')).toMatch(/Syllabus match.*Past-paper recurrence.*Indian Express or The Hindu coverage.*Explainer or editorial.*Reported by 3 publishers/)
    expect(a.valueReasons.some(r => r.startsWith('Reported by'))).toBe(false)
  })
  it('shows the highest-value stories up to the limit and keeps the rest in the Archive', async () => {
    const { readingScopes } = await import('./analytics')
    const { TODAY_STORY_LIMIT } = await import('./workspace')
    const now = Date.parse('2026-10-05T12:00:00Z')
    const stories = buildWorkspace(clusterItems(hearing()), index)
    const many = Array.from({ length: TODAY_STORY_LIMIT + 7 }, (_, i) => ({ ...stories[0], id: `story-${i}`, value: i }))
    const { today, archive } = readingScopes(many, now)
    expect(today).toHaveLength(TODAY_STORY_LIMIT)
    expect(today[0].value).toBe(TODAY_STORY_LIMIT + 6)
    expect(Math.min(...today.map(e => e.value!))).toBe(7)
    expect(archive.map(e => e.value).sort((x, y) => x! - y!)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(today.length + archive.length).toBe(many.length)
    expect(readingScopes(many.slice(0, 5), now).archive).toHaveLength(0)
  })
})

describe('every article in a story clears the bar on its own', () => {
  it('a strong story does not carry party reactions or candidate lists about the same event', () => {
    const reactions = [
      article('CEC Gyanesh Kumar should resign to protect his dignity, says CPI(M) national general secretary', 'The Hindu', 'hindu-national', { section: 'National', description: 'M.A. Baby alleges SIR has deprived 13 crore people of voting rights; calls for strengthening INDIA bloc to protect democracy' }),
      article('CEC Gyanesh Kumar’s ability to ‘execute G2’s illegal orders’ makes him a liability for country: Congress', 'The Tribune', 'tribune-india'),
      article('Justice Bhuyan’s remarks on SIR prove CEC violated Constitution: Congress', 'Times of India', 'toi-india'),
    ]
    const events = clusterItems([...hearing(), ...reactions])
    const listed = new Set(events.flatMap(e => [...e.members.map(m => m.url), ...(e.overflow ?? [])]))
    for (const reaction of reactions) {
      expect(reaction.relevance.accepted, reaction.title).toBe(false)
      expect(listed.has(reaction.url), reaction.title).toBe(false)
    }
    expect(events.length).toBeGreaterThan(0)
    for (const event of events) for (const member of event.members) {
      expect(member.relevance.accepted, member.title).toBe(true)
      expect(member.relevance.score).toBeGreaterThanOrEqual(ACCEPT_THRESHOLD)
      expect(member.relevance.substance!.score, member.title).toBeGreaterThanOrEqual(1)
    }
  })
})
