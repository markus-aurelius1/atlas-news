/** Job B acquisition diagnostics. No value labels, eligibility, subject predictions or lexical rescue rules. */
import type { NewsSource, NewsItem } from '../../../src/current-affairs/types.ts'
import { canonicalUrl } from '../../../src/current-affairs/feed.ts'
import { curatedAuthorEvidence } from '../../../src/current-affairs/validator-v3/author-registry.ts'
import { validateRaw } from './validate.ts'
import { digest, instant, requireThat } from './core.ts'
import type { Metadata, RawCapture } from './contracts.ts'
export interface DiscoveryReference { url: string; title: string; publisher: string; referenceUrl: string; discoveredAt: string; attributedAuthorId?: string }
export const observationItem = (m: Metadata): NewsItem => ({ ...m, sourceId: m.memberships[0].sourceId, section: m.memberships[0].section, bylines: m.bylines.map(b => ({ ...b, sourceId: m.memberships[0].sourceId })) })
export function sourceAudit(captures: RawCapture[], registry: NewsSource[], inventory: DiscoveryReference[], clock: string) {
  instant(clock); captures.forEach(c => validateRaw(c, registry))
  requireThat(captures.every(c => instant(c.capturedAt) <= instant(clock)), 'Future capture')
  for (const r of inventory) { requireThat(!!canonicalUrl(r.url) && !!canonicalUrl(r.referenceUrl) && r.title.length <= 400, 'Invalid listing metadata'); requireThat(instant(r.discoveredAt) <= instant(clock), 'Future discovery') }
  const observations = captures.flatMap(c => c.sources.flatMap(s => s.observations))
  const unique = (values: string[]) => [...new Set(values)].sort()
  const urls = unique(observations.map(o => o.metadata.url))
  const byUrl = new Map(urls.map(url => [url, observations.filter(o => o.metadata.url === url)]))
  const described = (url: string) => byUrl.get(url)?.some(o => !!o.metadata.description) ?? false
  const bylined = (url: string) => byUrl.get(url)?.some(o => o.metadata.bylines.length > 0) ?? false
  const inventoryUrls = unique(inventory.map(r => canonicalUrl(r.url)!))
  const sourceRows = registry.filter(s => s.enabled).map(s => {
    const probes = captures.flatMap(c => c.sources.filter(p => p.sourceId === s.id))
    const rows = observations.filter(o => o.sourceId === s.id)
    const sourceUrls = unique(rows.map(o => o.metadata.url))
    const dates = rows.map(o => o.metadata.publishedAt).filter((s): s is string => !!s).sort()
    return { sourceId: s.id, section: s.section, feedUrl: s.feedUrl, probes: probes.length, successful: probes.filter(p => p.status !== 'failed').length,
      failures: probes.filter(p => p.status === 'failed').sort((a,b)=>a.capturedAt.localeCompare(b.capturedAt)).map(p => ({ capturedAt: p.capturedAt, httpStatus: p.httpStatus, failure: p.failure })),
      rawObservations: rows.length, uniqueUrls: sourceUrls.length, newest: dates.at(-1) ?? null, oldest: dates[0] ?? null,
      recentSevenDays: sourceUrls.filter(url => rows.some(o => o.metadata.url === url && o.metadata.publishedAt && instant(o.metadata.publishedAt) <= instant(clock) && instant(o.metadata.publishedAt) >= instant(clock)-7*86400000)).length,
      descriptions: sourceUrls.filter(url => rows.some(o => o.metadata.url === url && o.metadata.description)).length,
      categories: sourceUrls.filter(url => rows.some(o => o.metadata.url === url && o.metadata.categories.length)).length,
      bylines: sourceUrls.filter(url => rows.some(o => o.metadata.url === url && o.metadata.bylines.length)).length,
      invalidEntries: probes.reduce((n,p) => n+(p.invalidEntries??0),0), truncatedEntries: probes.reduce((n,p) => n+(p.truncatedEntries??0),0),
      unobserved: probes.length === 0 }
  })
  const overlaps = sourceRows.flatMap((s,k) => sourceRows.slice(k+1).flatMap(t => {
    const left = new Set(observations.filter(o => o.sourceId === s.sourceId).map(o=>o.metadata.url))
    const common = unique(observations.filter(o => o.sourceId === t.sourceId && left.has(o.metadata.url)).map(o=>o.metadata.url))
    return common.length ? [{ sources: [s.sourceId,t.sourceId], sharedUrls: common.length }] : []
  }))
  const authorIds = unique(observations.flatMap(o => curatedAuthorEvidence(observationItem(o.metadata)).map(a=>a.authorId)))
  const authors = authorIds.map(authorId => {
    const rows = observations.filter(o => curatedAuthorEvidence(observationItem(o.metadata)).some(a=>a.authorId===authorId))
    const authorUrls = unique(rows.map(o=>o.metadata.url))
    const discovered = unique(inventory.filter(r=>r.attributedAuthorId===authorId).map(r=>r.url))
    return { authorId, observed: authorUrls.length, memberships: unique(rows.map(o=>o.sourceId)), bylineProvenances: unique(rows.flatMap(o=>o.metadata.bylines.map(b=>b.provenance))),
      descriptions: authorUrls.filter(described).length, discovered: discovered.length, discoveredObserved: discovered.filter(url=>byUrl.has(url)).length,
      notObserved: discovered.filter(url=>!byUrl.has(url)), urls: authorUrls }
  })
  return { version: 'tars-source-audit/v1', clock, registryHash: digest(registry), captureHashes: captures.map(digest).sort(), inventoryHash: digest(inventory),
    scope: 'UPSC acquisition and metadata only; listing inventories are bounded, unreviewed discovery proxies, not valuable-article gold.',
    funnel: { discovered: inventoryUrls.length, observedInRaw: inventoryUrls.filter(url=>byUrl.has(url)).length,
      descriptionAvailable: inventoryUrls.filter(described).length, metadataSufficient: null, laterEvaluable: null, status: 'pending_independent_metadata_review' },
    availability: { rawObservations: observations.length, uniqueUrls: urls.length, missingDescription: urls.filter(url=>!described(url)).length,
      missingByline: urls.filter(url=>!bylined(url)).length, missingCategories: urls.filter(url=>!byUrl.get(url)!.some(o=>o.metadata.categories.length)).length,
      missingPublicationTime: urls.filter(url=>!byUrl.get(url)!.some(o=>o.metadata.publishedAt)).length,
      opaqueOrSemanticSufficiency: 'pending_human_review; field presence is not reliable judgement' },
    sources: sourceRows, overlaps, authors,
    discovery: inventoryUrls.map(url => ({ url, references: unique(inventory.filter(r=>r.url===url).map(r=>r.referenceUrl)), observed: byUrl.has(url), sourceIds: unique((byUrl.get(url)??[]).map(o=>o.sourceId)), descriptionAvailable: described(url), bylineAvailable: bylined(url) })) }
}
