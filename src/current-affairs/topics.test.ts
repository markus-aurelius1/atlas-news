/** Topic groups: anchor preference, determinism, and nothing lost when stories fold together. */
import { describe, expect, it } from 'vitest'
import { anchorOrder, groupTopics, pickAnchor } from './topics'
import type { ClassifiedItem } from './types'
import type { WorkspaceEvent } from './workspace'

const article = (id: string, publisher: string, sourceId: string, overrides: Partial<ClassifiedItem> = {}): ClassifiedItem => ({
  title: `GST reform ${id}`,
  url: `https://example.org/${id}`,
  publisher,
  sourceId,
  section: 'Economy',
  description: '',
  publishedAt: '2026-10-01T09:00:00Z',
  relevance: { accepted: true, score: 7, exam: 'both', subjects: ['Economy'], topics: ['Taxation'], staticAnchors: ['GST'], signals: [] },
  ...overrides,
})
const story = (members: ClassifiedItem[], primary = members[0]): WorkspaceEvent => ({ id: members.map((m) => m.url).sort()[0], primary, members, mustRead: false, priority: 0, priorityReasons: [], minutes: 3, day: '2026-10-01' })
const urls = (items: { item: ClassifiedItem }[]) => items.map((entry) => entry.item.url)

describe('anchor article', () => {
  it('prefers Indian Express or The Hindu over a richer article elsewhere', () => {
    const mint = article('mint', 'Mint', 'mint-economy', { section: 'Explained', description: 'A long and detailed explainer '.repeat(10) })
    const hindu = article('hindu', 'The Hindu', 'hindu-economy')
    expect(pickAnchor([mint, hindu])).toBe(hindu)
    expect(pickAnchor([hindu, mint])).toBe(hindu)
  })
  it('between Indian Express and The Hindu, takes the more complete article whatever the input order', () => {
    const express = article('ie', 'Indian Express', 'ie-explained', { section: 'Explained', description: 'Why the council is rewriting enforcement, and what changes for traders.' })
    const hindu = article('hindu', 'The Hindu', 'hindu-economy')
    expect(pickAnchor([hindu, express])).toBe(express)
    expect(pickAnchor([express, hindu])).toBe(express)
    const fullerHindu = article('hindu-full', 'The Hindu', 'hindu-editorial', { section: 'Explained', description: 'Why the council is rewriting enforcement, what changes for traders, how states respond and what the revenue data shows.' })
    expect(pickAnchor([express, fullerHindu])).toBe(fullerHindu)
  })
  it('breaks an exact tie by URL so the choice is stable', () => {
    const a = article('a', 'The Hindu', 'hindu-economy'), b = article('b', 'The Hindu', 'hindu-economy')
    expect(pickAnchor([b, a])).toBe(a)
    expect(anchorOrder(a, b)).toBeLessThan(0)
  })
  it('with neither preferred publisher, falls back to the existing depth and relevance ranking', () => {
    const brief = article('bs', 'Business Standard', 'bs-economy')
    const explainer = article('ht', 'Hindustan Times', 'ht-explained', { section: 'Explained' })
    expect(pickAnchor([brief, explainer])).toBe(explainer)
  })
})

describe('topic groups', () => {
  it('anchors a topic on the preferred publisher and keeps every other article underneath', () => {
    const bs = article('bs', 'Business Standard', 'bs-economy'), tribune = article('tribune', 'The Tribune', 'tribune-business')
    const ht = article('ht', 'Hindustan Times', 'ht-india'), express = article('ie', 'Indian Express', 'ie-economy')
    const [group, ...more] = groupTopics([story([bs, tribune]), story([ht]), story([express])])
    expect(more).toHaveLength(0)
    expect(group.topic).toBe('GST')
    expect(group.anchor.item).toBe(express)
    expect(group.count).toBe(4)
    expect(urls(group.rest).sort()).toEqual([bs.url, ht.url, tribune.url].sort())
    expect(group.rest.filter((entry) => entry.lead).map((entry) => entry.item)).toEqual([bs, ht])
  })
  it('shows the preferred publisher of one story even when clustering chose another primary', () => {
    const mint = article('mint', 'Mint', 'mint-economy', { section: 'Explained' }), hindu = article('hindu', 'The Hindu', 'hindu-economy')
    const [group] = groupTopics([story([mint, hindu], mint)])
    expect(group.topic).toBeNull()
    expect(group.anchor.item).toBe(hindu)
    expect(group.rest).toEqual([{ event: group.anchor.event, item: mint, lead: false }])
  })
  it('with no preferred publisher, the story the feed ranks first anchors the group', () => {
    const first = story([article('bs', 'Business Standard', 'bs-economy')]), second = story([article('ht', 'Hindustan Times', 'ht-explained', { section: 'Explained' })])
    expect(groupTopics([first, second])[0].anchor.event).toBe(first)
  })
  it('leaves unrelated stories on their own, in feed order, and limits a story to the coverage in view', () => {
    const rbi = article('rbi', 'Mint', 'mint-economy', { relevance: { accepted: true, score: 7, exam: 'both', subjects: ['Economy'], topics: [], staticAnchors: ['RBI'], signals: [] } })
    const bare = article('bare', 'Mint', 'mint-politics', { relevance: { accepted: true, score: 2, exam: 'general', subjects: [], topics: [], staticAnchors: [], signals: [] } })
    const old = article('old', 'The Hindu', 'hindu-economy'), fresh = article('fresh', 'Business Standard', 'bs-economy')
    const groups = groupTopics([story([rbi]), story([bare]), story([old, fresh])], (event) => event.members.filter((m) => m !== old))
    expect(groups.map((g) => g.anchor.item)).toEqual([rbi, bare, fresh])
    expect(groups.every((g) => g.count === 1 && g.topic === null)).toBe(true)
  })
})
