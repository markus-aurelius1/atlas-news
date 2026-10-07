/** Publisher-verified identities, evidence only. No acceptance, subject, score or unknown-author penalty. */
import type { NewsItem } from '../types.ts'
import { optionalMetadata } from './metadata.ts'
export const AUTHOR_REGISTRY_VERSION = 'tars-curated-authors/1'
export const AUTHOR_REGISTRY = [
  { id: 'author:pratap-bhanu-mehta', canonicalName: 'Pratap Bhanu Mehta', aliases: ['Pratap Bhanu Mehta', 'P B Mehta'], publisher: 'Indian Express', host: 'indianexpress.com', evidenceUrl: 'https://indianexpress.com/profile/columnist/pratap-bhanu-mehta/', evidenceBasis: 'Publisher profile heading and same-profile attributed listing names; dc:creator observed in Columns RSS.', reviewedAt: '2026-10-07', version: 1, active: true },
  { id: 'author:c-raja-mohan', canonicalName: 'C. Raja Mohan', aliases: ['C. Raja Mohan', 'C Raja Mohan'], publisher: 'Indian Express', host: 'indianexpress.com', evidenceUrl: 'https://indianexpress.com/profile/author/c-raja-mohan/', evidenceBasis: 'Publisher profile heading and same-profile attributed listing names; dc:creator observed in Columns RSS.', reviewedAt: '2026-10-07', version: 1, active: true },
] as const
const normalized = (name: string) => name.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()
/** RSS author may be an email plus one parenthesized name. Do not split ambiguous prose or multiple people. */
const authorName = (name: string, provenance: string) => provenance === 'rss:author' && /^[^\s()]+@[^\s()]+\s+\([^()]+\)$/.test(name) ? name.slice(name.indexOf('(')+1,-1).trim() : name
export function curatedAuthorEvidence(item: NewsItem) {
  const metadata = optionalMetadata(item)
  const bylines = metadata.bylines ?? []
  return AUTHOR_REGISTRY.flatMap(author => {
    if (!author.active || author.publisher !== item.publisher) return []
    const matches = bylines.filter(b => author.aliases.some(alias => normalized(alias) === normalized(authorName(b.name,b.provenance))))
    return matches.length ? [{ authorId: author.id, canonicalName: author.canonicalName, registryVersion: AUTHOR_REGISTRY_VERSION, bylines: matches, evidenceUrl: author.evidenceUrl }] : []
  })
}
