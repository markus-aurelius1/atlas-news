import type { StageCInput, StageCOutput, StageCObservation } from './contracts.ts'
import { STAGE_C_POLICY } from './policy.ts'
import { extractEvidence } from './evidence.ts'
import { assessEligibility } from './eligibility.ts'
import { assessRelevance } from './relevance.ts'
function closed(o: object, keys: string[]) { if (!o || typeof o !== 'object' || Object.keys(o).some(k => !keys.includes(k)) || keys.some(k => !Object.hasOwn(o, k))) throw new Error('Stage C accepts closed metadata-only input') }
const instant = (s: string) => { if (typeof s !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString() !== s) throw new Error('Explicit UTC clock required'); return Date.parse(s) }
export function evaluateStageC(input: StageCInput): StageCOutput {
  closed(input, ['observations', 'clock', 'versions']); closed(input.versions, ['policyId', 'policyHash', 'indexHash', 'registryHash', 'authorHash', 'codeHash'])
  if (input.versions.policyId !== STAGE_C_POLICY.id || Object.entries(input.versions).some(([k, v]) => k !== 'policyId' && !/^[a-f0-9]{64}$/.test(v))) throw new Error('Pinned Stage C versions required')
  const cutoff = instant(input.clock), seen = new Set<string>(), groups = new Map<string, StageCObservation[]>()
  for (const o of input.observations) {
    closed(o, ['id', 'captureId', 'sourceId', 'ordinal', 'capturedAt', 'parserVersion', 'registryHash', 'metadataHash', 'metadata'])
    closed(o.metadata, ['url', 'title', 'description', 'publisher', 'memberships', 'categories', 'bylines', 'publishedAt', 'updatedAt'])
    if (typeof o.id !== 'string' || !o.id || typeof o.sourceId !== 'string' || typeof o.captureId !== 'string' || typeof o.parserVersion !== 'string' || !Number.isInteger(o.ordinal) || o.ordinal < 0 || !/^[a-f0-9]{64}$/.test(o.metadataHash)) throw new Error('Invalid observation provenance')
    const m = o.metadata
    if (typeof m.title !== 'string' || m.title.length > 400 || typeof m.description !== 'string' || m.description.length > 600 || typeof m.publisher !== 'string' || !Array.isArray(m.memberships) || !Array.isArray(m.bylines) || !Array.isArray(m.categories) || m.memberships.length > 99 || m.bylines.length > 20 || m.categories.length > 30) throw new Error('Invalid bounded feed metadata')
    for (const b of m.bylines) { closed(b, ['name', 'provenance']); if (typeof b.name !== 'string' || b.name.length > 160 || !['rss:dc:creator', 'rss:author', 'atom:author'].includes(b.provenance)) throw new Error('Invalid byline') }
    for (const s of m.memberships) { closed(s, ['sourceId', 'feedUrl', 'section']); if (typeof s.sourceId !== 'string' || typeof s.feedUrl !== 'string' || typeof s.section !== 'string' || s.section.length > 100 || s.feedUrl.length > 2048) throw new Error('Invalid source metadata') }
    if (m.categories.some(c => typeof c !== 'string' || c.length > 160)) throw new Error('Invalid category')
    const url = new URL(m.url); if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || m.url.length > 2048) throw new Error('Invalid article URL')
    if (seen.has(o.id) || instant(o.capturedAt) > cutoff || [m.publishedAt, m.updatedAt].some(t => t !== null && instant(t) > cutoff)) throw new Error('Duplicate or future observation leakage')
    if (o.registryHash !== input.versions.registryHash) throw new Error('Registry version mismatch')
    seen.add(o.id); groups.set(m.url, [...(groups.get(m.url) ?? []), o])
  }
  return { version: 'tars-validator-stage-c/v1', clock: input.clock, versions: { ...input.versions }, articles: [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([url, rows]) => {
    const e = extractEvidence(rows), eligibility = assessEligibility(e), relevance = assessRelevance(e, eligibility)
    const accepted = eligibility.status === 'eligible' && ['useful', 'must_read_candidate'].includes(relevance.status)
    return { url, accepted, decision: accepted ? 'accepted' : eligibility.status === 'insufficient_metadata' ? 'deferred' : 'rejected', eligibility, relevance, metadataSufficiency: e.coverage, observationIds: e.observations, verifiedAuthors: e.verifiedAuthors }
  }) }
}
