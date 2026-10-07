import type { LeakageIdentity, PartitionAssignment } from './contracts.ts'
import type { Observation } from './contracts.ts'
import { validateObservation } from './validate.ts'
import { digest, instant, requireThat, unique, urlIdentity } from './core.ts'

export interface PartitionManifest {
  version: 'tars-news-partitions/v1'; seed: string; mode: 'bootstrap' | 'release'
  candidateFreezeAt: string | null; holdoutsSealed: boolean; assignments: PartitionAssignment[]
  identityHash: string; hash: string
}
const kinds = ['syndicationIds', 'nearDuplicateIds', 'developmentIds', 'angleIds', 'themeIds'] as const
/** Conservative exact/lexical hints, supplemented by independently reviewed semantic family IDs. */
export function leakageIdentities(observations: Observation[], declared: LeakageIdentity[] = []) {
  observations.forEach(validateObservation); unique(observations, o => o.id, 'observation')
  const urls = [...new Set(observations.map(o => o.metadata.url))].sort()
  requireThat(urls.length <= 5000, 'Bootstrap lexical audit is bounded to 5000 URLs; audit larger batches separately')
  const supplied = new Map(identities(declared).map(row => [row.url, row]))
  requireThat([...supplied.keys()].every(url => urls.includes(url)), 'Declared family has no observations')
  const rows = urls.map(url => {
    const observationsForUrl = observations.filter(o => o.metadata.url === url), times = observationsForUrl.map(o => o.capturedAt).sort()
    return { url, aliases: [], syndicationIds: [], nearDuplicateIds: [], developmentIds: [], angleIds: [], themeIds: [], ...supplied.get(url), firstObservedAt: times[0], lastObservedAt: times[times.length - 1] } as LeakageIdentity
  })
  const tokens = (o: Observation) => (o.metadata.title + ' ' + o.metadata.description).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
  const signatures = observations.map(o => ({ url: o.metadata.url, words: tokens(o) })).filter(r => r.words.length >= 10).map(r => ({ url:r.url, exact:digest(r.words), shingles:new Set(r.words.slice(0,-2).map((_,i)=>r.words.slice(i,i+3).join(' '))) }))
  const byUrl = new Map(rows.map(r=>[r.url,r])), index = new Map<string, number[]>(), candidates = new Set<string>()
  signatures.forEach((s,i)=>{
    for(const shingle of s.shingles){
      for(const j of index.get(shingle)??[]) if(signatures[j].url!==s.url){candidates.add(j+':'+i);requireThat(candidates.size<=2000000,'Lexical duplicate candidate budget exceeded; subdivide/audit explicitly')}
      index.set(shingle,[...index.get(shingle)??[],i])
    }
  })
  requireThat(candidates.size <= 2000000, 'Lexical duplicate candidate budget exceeded; subdivide/audit explicitly')
  let linkedPairs=0
  for(const pair of [...candidates].sort()){
    const [i,j]=pair.split(':').map(Number),a=signatures[i],b=signatures[j]
    const intersection=[...a.shingles].filter(s=>b.shingles.has(s)).length
    const similarity=intersection/(a.shingles.size+b.shingles.size-intersection)
    if(a.exact!==b.exact&&similarity<0.8)continue
    const key='lexical:'+digest([a.exact,b.exact].sort()),kind=a.exact===b.exact?'syndicationIds':'nearDuplicateIds'
    byUrl.get(a.url)![kind].push(key);byUrl.get(b.url)![kind].push(key);linkedPairs++
  }
  return { version:'tars-news-leakage-hints/v1', method:'metadata-trigram-jaccard/1 (threshold 0.8)', observationsHash:digest([...observations].sort((a,b)=>a.id.localeCompare(b.id,'en'))), candidatePairs:candidates.size, linkedPairs, identities:identities(rows), limitation:'Lexical hints cannot establish all semantic paraphrases or development/theme identities. Independent family audit required before freeze.' }
}
function keys(row: LeakageIdentity): string[] {
  return ['url:' + urlIdentity(row.url), ...row.aliases.map(a => 'url:' + urlIdentity(a)), ...kinds.flatMap(k => row[k].map(id => k + ':' + id))]
}
function identities(rows: LeakageIdentity[]): LeakageIdentity[] {
  unique(rows, r => urlIdentity(r.url), 'partition URL')
  return rows.map(row => {
    requireThat(Object.keys(row).every(k => ['url', 'aliases', ...kinds, 'firstObservedAt', 'lastObservedAt', 'partition'].includes(k)), 'Unexpected partition field (no labels or predictions)')
    requireThat(instant(row.firstObservedAt) <= instant(row.lastObservedAt), 'Invalid identity observation range')
    return { url: urlIdentity(row.url), aliases: [...new Set(row.aliases.map(urlIdentity))].sort(),
      ...Object.fromEntries(kinds.map(k => [k, [...new Set(row[k])].sort()])) as Pick<LeakageIdentity, typeof kinds[number]>,
      firstObservedAt: row.firstObservedAt, lastObservedAt: row.lastObservedAt }
  }).sort((a, b) => a.url.localeCompare(b.url, 'en'))
}
export function validatePartitions(rows: PartitionAssignment[], candidateFreezeAt: string | null = null): void {
  identities(rows)
  const owners = new Map<string, PartitionAssignment[]>()
  for (const row of rows) {
    requireThat(['development','validation','holdout_unseen','holdout_forward','legacy_regression','synthetic_adversarial'].includes(row.partition), 'Unknown partition')
    if (row.partition.startsWith('holdout_')) requireThat(candidateFreezeAt && instant(row.firstObservedAt) > instant(candidateFreezeAt), 'Holdout must be after candidate freeze')
    if (candidateFreezeAt && ['development', 'validation'].includes(row.partition)) requireThat(instant(row.lastObservedAt) <= instant(candidateFreezeAt), 'Development/validation contains future observations')
    for (const key of keys(row)) owners.set(key, [...owners.get(key) ?? [], row])
  }
  for (const [key, group] of owners) {
    const partitions = new Set(group.map(r => r.partition))
    if (partitions.size <= 1) continue
    // Only theme continuity may cross into a forward holdout. URLs, events and angles never may.
    const forward = group.filter(r => r.partition === 'holdout_forward'), earlier = group.filter(r => r.partition !== 'holdout_forward')
    const forwardTheme = key.startsWith('themeIds:') && forward.length > 0 && earlier.every(r => ['development', 'validation'].includes(r.partition)) && new Set(earlier.map(r => r.partition)).size === 1
    requireThat(forwardTheme && candidateFreezeAt && earlier.every(r => instant(r.lastObservedAt) < Math.min(...forward.map(f => instant(f.firstObservedAt)))), `Partition leakage: ${key.split(':')[0]}`)
  }
}
/** Bootstrap splits only dev/validation, on whole connected leakage groups; no holdout labels generated. */
export function splitBootstrap(input: LeakageIdentity[], seed: string, validationFraction = 0.25): PartitionManifest {
  requireThat(seed && validationFraction > 0 && validationFraction < 1, 'Invalid split plan')
  const rows = identities(input), parent = rows.map((_, i) => i)
  const find = (i: number): number => parent[i] === i ? i : (parent[i] = find(parent[i]))
  const owners = new Map<string, number>()
  rows.forEach((row, i) => { for (const key of keys(row)) { const old = owners.get(key); if (old !== undefined) parent[find(i)] = find(old); else owners.set(key, i) } })
  const groups = new Map<number, LeakageIdentity[]>()
  rows.forEach((row, i) => groups.set(find(i), [...groups.get(find(i)) ?? [], row]))
  const orderedGroups = [...groups.values()].sort((a, b) => digest([seed, a.map(r => r.url)]).localeCompare(digest([seed, b.map(r => r.url)]), 'en'))
  let validationSize = 0
  const assignments: PartitionAssignment[] = orderedGroups.flatMap(group => {
    const partition = Math.abs(validationSize + group.length - rows.length * validationFraction) < Math.abs(validationSize - rows.length * validationFraction) ? 'validation' as const : 'development' as const
    if (partition === 'validation') validationSize += group.length
    return group.map(r => ({ ...r, partition }))
  }).sort((a, b) => a.url.localeCompare(b.url, 'en'))
  return partitionManifest(assignments, seed, null)
}
/** Custodian can commit later sealed identities without labels. Bootstrap needs no minimum collection duration. */
export function partitionManifest(assignments: PartitionAssignment[], seed: string, candidateFreezeAt: string | null): PartitionManifest {
  validatePartitions(assignments, candidateFreezeAt)
  const canonical = assignments.map(r => ({ ...identities([r])[0], partition: r.partition })).sort((a, b) => a.url.localeCompare(b.url, 'en'))
  const release = canonical.some(r => r.partition.startsWith('holdout_'))
  const payload = { version: 'tars-news-partitions/v1' as const, seed, mode: release ? 'release' as const : 'bootstrap' as const,
    candidateFreezeAt, holdoutsSealed: release, assignments: canonical, identityHash: digest(identities(assignments)) }
  return { ...payload, hash: digest(payload) }
}
export function validatePartitionManifest(manifest: PartitionManifest): void {
  requireThat(digest(partitionManifest(manifest.assignments, manifest.seed, manifest.candidateFreezeAt)) === digest(manifest), 'Partition manifest integrity failure')
}
