/** No action runs on import; raw collection is an explicit separate subcommand. */
import { readFileSync } from 'node:fs'
import { collectShard } from './collect.ts'
import { evaluate } from './evaluate.ts'
import type { EvaluationContext } from './evaluate.ts'
import type { GoldRecord, Observation, RunArtifact, LeakageIdentity } from './contracts.ts'
import { annotationExport, sample } from './sample.ts'
import type { SamplingManifest, SamplingPlan } from './sample.ts'
import { splitBootstrap, validatePartitionManifest, leakageIdentities } from './split.ts'
import type { PartitionManifest } from './split.ts'
import { validateCorpus, validateRaw } from './validate.ts'
import { renderReport, writeArtifact } from './report.ts'
import { requireThat } from './core.ts'

const [command, ...args] = process.argv.slice(2)
const load = <T>(path: string): T => {
  requireThat(path, 'Missing input path')
  const text = readFileSync(path, 'utf8').trim()
  try { return JSON.parse(text) as T } catch { return text.split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)) as T }
}
try {
  switch (command) {
    case 'validate': {
      const records = load<unknown[]>(args[0]), observations = load<Observation[]>(args[1])
      const validated = validateCorpus(records, observations)
      console.log(`${validated.length} valid records; review quality remains pending`); break
    }
    case 'validate-raw': { validateRaw(load<unknown>(args[0])); console.log('Valid raw capture'); break }
    case 'validate-partitions': { validatePartitionManifest(load<PartitionManifest>(args[0])); console.log('Valid partition manifest'); break }
    case 'sample': {
      const result = sample(load<Observation[]>(args[0]), load<SamplingPlan>(args[1]))
      console.log(writeArtifact(args[2], result)); break
    }
    case 'annotate': {
      const records = annotationExport(load<SamplingManifest>(args[0]), load<Observation[]>(args[1]), args[3] ? load<PartitionManifest>(args[3]) : undefined)
      console.log(writeArtifact(args[2], records)); break
    }
    case 'split': { console.log(writeArtifact(args[2], splitBootstrap(load<LeakageIdentity[]>(args[0]), args[1]))); break }
    case 'identities': { console.log(writeArtifact(args[2], leakageIdentities(load<Observation[]>(args[0]), load<LeakageIdentity[]>(args[1])))); break }
    case 'evaluate': {
      const context = load<EvaluationContext>(args[2])
      // This implementation CLI never unlocks holdout truth; custodian invocation uses the API separately.
      requireThat(!context.partition.startsWith('holdout_') && context.access !== 'custodian', 'Holdout requires separate independent custodian runner')
      const report = evaluate(load<GoldRecord[]>(args[0]), load<RunArtifact>(args[1]), context)
      console.log(writeArtifact(args[3], report)); console.log(writeArtifact(args[3] + '.md', renderReport(report), true)); break
    }
    case 'collect-shard': {
      requireThat(args.length === 3, 'collect-shard requires shard index, immutable capture namespace, output path')
      const result = await collectShard({ shardIndex: Number(args[0]), captureId: args[1], clock: () => new Date().toISOString() })
      console.log(writeArtifact(args[2], result)); break
    }
    default: throw new Error('Commands: validate, validate-raw, validate-partitions, sample, annotate, identities, split, evaluate, collect-shard. See evaluation/README.md for positional arguments.')
  }
} catch (error) { console.error(error instanceof Error ? error.message : 'Evaluation command failed'); process.exitCode = 1 }
