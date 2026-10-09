import { describe, expect, it } from 'vitest'
import { classifySubject } from './subject'

describe('independent subject dominance (explicitly synthetic policy regressions)', () => {
  const cases = [
    ['NASA telescope findings reveal an exoplanet', 'Sci-Tech'],
    ['NASA diplomatic treaty with India enters bilateral talks', 'International relations'],
    ['NASA personnel dispute in America', 'Unresolved'],
    ['Hormuz naval blockade threatens Indian shipping', 'Security'],
    ['Hormuz sanctions bargaining enters diplomatic negotiations', 'International relations'],
    ['Hormuz disruption drives Indian inflation transmission', 'Economy'],
    ['How a strait forms: Hormuz bathymetry', 'Geography'],
    ['Supreme Court rules on constitutional rights of a BJP litigant', 'Polity'],
    ['New public service delivery framework in India', 'Governance'],
    ['Law enforcement evaluates AI benefits and risks', 'Governance'],
    ['India R&D ecosystem: funding research and development', 'Sci-Tech'],
    ['Nuclear enrichment safeguards and non-proliferation', 'Security'],
    ['Defence readiness and border management assessment', 'Security'],
    ['Cyber infrastructure reform targets terror financing', 'Security'],
    ['River ecological restoration methods in Japan', 'Environment'],
    ['Ancient inscription reveals medieval architecture', 'History & Culture'],
    ['World news: Germany visits India', 'Unresolved'],
    ['Constitutional rights and monetary policy', 'Unresolved'],
  ] as const
  for (const [title, expected] of cases) it(title, () => expect(classifySubject({ title, description: '' }).primary).toBe(expected))
  it('title issue dominates incidental summary keywords and places', () => {
    expect(classifySubject({ title: 'India inflation transmission after Hormuz disruption', description: 'The article mentions diplomacy, constitutional rights and quantum research in passing.' }).primary).toBe('Economy')
  })
  it('acceptance, publisher, section, byline, category and scores are outside the API', () => {
    const item = { title: 'Quantum computing research reveals a new mechanism', description: '', publisher: 'The Hindu', section: 'World', categories: ['Geography'], accepted: false, score: 999 }
    const changed = { ...item, publisher: 'Other', section: 'National', categories: ['Polity'], accepted: true, score: 0 }
    expect(classifySubject(item)).toEqual(classifySubject(changed))
  })
  it('spans reproduce observed evidence; input repetition is deterministic', () => {
    const item = { title: 'NASA telescope findings reveal an exoplanet', description: 'An Indian researcher explains quantum research.' }, result = classifySubject(item)
    for (const e of result.evidence) expect(item[e.field].slice(e.start, e.end)).toBe(e.text)
    expect(classifySubject(item)).toEqual(result)
  })
})
