/** Offline adapter only. Gold/baseline are joined AFTER this runner completes. */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { evaluateStageC } from '../../../src/current-affairs/validator-v3/stage-c.ts'
import { NEWS_SOURCES } from '../../../src/current-affairs/sources.ts'
import { STAGE_C_POLICY } from '../../../src/current-affairs/validator-v3/policy.ts'
import type { StageCOutput, StageCVersions } from '../../../src/current-affairs/validator-v3/contracts.ts'
import type { Observation } from './contracts.ts'
import { replay } from './replay.ts'
import { digest, requireThat } from './core.ts'
export const STAGE_C_FILES = ['contracts', 'policy', 'evidence', 'eligibility', 'relevance', 'stage-c', 'metadata', 'author-registry'].map(n => 'src/current-affairs/validator-v3/' + n + '.ts').concat(['src/current-affairs/feed.ts', 'src/current-affairs/sources.ts', 'src/current-affairs/types.ts', 'tools/news/evaluation/stage-c-runner.ts', 'tools/news/evaluation/replay.ts', 'tools/news/evaluation/validate.ts', 'tools/news/evaluation/core.ts', 'tools/news/evaluation/schema.json'])
export const byteHash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
export function stageCVersions(registryHash: string): StageCVersions {
  requireThat(registryHash === digest(NEWS_SOURCES), 'Registry does not match pinned Job B source data')
  return { policyId: STAGE_C_POLICY.id, policyHash: byteHash('src/current-affairs/validator-v3/policy.ts'), indexHash: byteHash('public/current-affairs/v2/relevance-index.json'), registryHash, authorHash: byteHash('src/current-affairs/validator-v3/author-registry.ts'), codeHash: digest(STAGE_C_FILES.map(path => ({ path, sha256: byteHash(path) }))) }
}
export function runStageC(observations: Observation[], clock: string) {
  requireThat(observations.length > 0, 'Stage C replay needs observations')
  const versions = stageCVersions(observations[0].registryHash)
  let details: StageCOutput | undefined
  const replayVersions = { policyId: versions.policyId, policyHash: versions.policyHash, indexHash: versions.indexHash, registryHash: versions.registryHash, codeHash: versions.codeHash }
  const run = replay({ observations, history: [], clock, versions: replayVersions }, input => {
    details = evaluateStageC({ observations: input.observations, clock: input.clock, versions })
    return { articles: details.articles.map(p => ({ url: p.url, decision: p.decision, primarySubject: null, eventId: null, themeId: null, angleId: null, novelty: 'not_applicable' })), units: [] }
  })
  requireThat(details, 'No Stage C output')
  return { run, details, detailsHash: digest(details) }
}
