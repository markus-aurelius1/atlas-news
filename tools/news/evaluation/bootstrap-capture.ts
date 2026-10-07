import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { NEWS_SOURCES } from '../../../src/current-affairs/sources.ts'
import { FEED_REGISTRY_GENERATION, feedShards } from '../../../src/current-affairs/shards.ts'
import { collectShard, PARSER_VERSION, REGISTRY_HASH } from './collect.ts'
import { writeArtifact } from './report.ts'
import { requireThat } from './core.ts'
import { validateRaw } from './validate.ts'
const root = process.argv[2]
const archive = process.argv[3]
requireThat(root?.startsWith('tools/news/evaluation/data/') && archive, 'Usage: node tools/news/evaluation/bootstrap-capture.ts NEW_ROOT VERIFIED_JOB_B_ROOT')
const bytesHash = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex')
const evidence = JSON.parse(readFileSync('tools/news/evaluation/JOB_B_EVIDENCE.json', 'utf8'))
const parserFiles = ['src/current-affairs/feed.ts','src/current-affairs/validator-v3/metadata.ts','tools/news/evaluation/collect.ts','tools/news/evaluation/xml.ts','tools/news/evaluation/validate.ts']
writeArtifact(root+'/preregistration.json', {version:'tars-bootstrap-plan/v1', namespace:root, registeredAt:new Date().toISOString(), target:1000, representative:580, coverageTarget:420, seed:'tars-upsc-a2a-2026-10-07/1', splitSeed:'tars-upsc-a2a-split/1', validationFraction:0.25, samplingBasis:'raw unique URLs before any classifier; disjoint publisher/feed/first-capture-UTC-day representative cells; neutral metadata coverage rotation', coverage:['requested_authors','ie_upsc','ie_explained','ie_opinion','th_opinion','science','environment','security_terms','ir_terms','economy','missing_description','single_source','party_terms','foreign_domestic_terms','institution_terms','recurring_metadata'], collection:'one sequential wave of every pinned shard, real UTC clock at each response; verified Job B archival raw observations imported byte-for-byte, original IDs/clocks retained; archive is not fresh supply', holdout:'future; none created or inspected', review:'primary human for bootstrap development/validation; second later for protected slices, disagreements, random overlap and final holdout'})
writeArtifact(root+'/registry.json',NEWS_SOURCES)
writeArtifact(root+'/parser-manifest.json',parserFiles.map(path=>({path,sha256:bytesHash(path)})))
const files: {path:string;sha256:string;origin:string;captureId:string;clock:string}[]=[]
for(const name of readdirSync(archive).filter(f=>/^raw-.*\.json$/.test(f)).sort()) {
  const original=archive+'/'+name
  const expected=evidence.inputArtifacts.find((f:{path:string})=>f.path.endsWith('/'+name))
  requireThat(expected && bytesHash(original)===expected.sha256,'Job B archive bytes differ: '+name)
  const capture=JSON.parse(readFileSync(original,'utf8')); validateRaw(capture,NEWS_SOURCES)
  requireThat(capture.parserVersion===PARSER_VERSION && capture.registryHash===REGISTRY_HASH,'Archive generation mismatch')
  const out=root+'/archive/'+name
  // writeArtifact uses the same canonical byte encoding as Job B; verify preservation.
  writeArtifact(out,capture); requireThat(bytesHash(out)===expected.sha256,'Archive copy not byte-identical')
  files.push({path:'archive/'+name,sha256:bytesHash(out),origin:'verified_job_b_archive',captureId:capture.id,clock:capture.capturedAt})
}
for(const shardIndex of feedShards().keys()) {
  const capture=await collectShard({captureId:root+':live:1:'+shardIndex,shardIndex,clock:()=>new Date().toISOString()})
  const name='live/raw-1-'+shardIndex+'.json'; writeArtifact(root+'/'+name,capture)
  files.push({path:name,sha256:bytesHash(root+'/'+name),origin:'a2a_live',captureId:capture.id,clock:capture.capturedAt})
  console.log(JSON.stringify({shardIndex,sources:capture.sources.map(s=>({id:s.sourceId,status:s.status,http:s.httpStatus,count:s.countAfter,failure:s.failure}))}))
}
writeArtifact(root+'/capture-manifest.json',{version:'tars-bootstrap-captures/v1',clock:new Date().toISOString(),registryHash:REGISTRY_HASH,registryGeneration:FEED_REGISTRY_GENERATION,parserVersion:PARSER_VERSION,files,archiveEvidenceHash:bytesHash('tools/news/evaluation/JOB_B_EVIDENCE.json'),planningDocuments:['VALIDATOR_V3_SPEC.md','EVALUATION_SCHEMA.md','WORK_PACKAGES.md'].map(path=>({path,sha256:bytesHash('C:/Users/hario/Downloads/Atlas-News/'+path)}))})
