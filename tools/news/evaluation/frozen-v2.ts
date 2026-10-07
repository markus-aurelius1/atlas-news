/** Frozen article-level v2 adapter. No production logic, thresholds or Today selection changed. */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { classify, ACCEPT_THRESHOLD, SUBSTANCE_THRESHOLD } from '../../../src/current-affairs/relevance.ts'
import type { RelevanceIndex } from '../../../src/current-affairs/types.ts'
import type { Observation, Prediction, ReplayVersions } from './contracts.ts'
import { SUBJECTS } from './contracts.ts'
import { digest, requireThat } from './core.ts'
import { observationItem } from './source-audit.ts'
import { replay } from './replay.ts'
export const byteHash=(path:string)=>createHash('sha256').update(readFileSync(path)).digest('hex')
export function freezeV2(observations:Observation[],clock:string,baseCommit:string) {
  const indexPath='public/current-affairs/v2/relevance-index.json',index:RelevanceIndex=JSON.parse(readFileSync(indexPath,'utf8'))
  const codeFiles=['src/current-affairs/relevance.ts','src/current-affairs/evidence-lexicon.ts','src/current-affairs/match.ts','src/current-affairs/sources.ts','src/current-affairs/types.ts','tools/news/evaluation/source-audit.ts','tools/news/evaluation/frozen-v2.ts','tools/news/evaluation/replay.ts']
  const files=codeFiles.map(path=>({path,sha256:byteHash(path)}))
  const policy={id:'existing-v2/job-b',baseCommit,acceptThreshold:ACCEPT_THRESHOLD,substanceThreshold:SUBSTANCE_THRESHOLD,scope:'article acceptance and existing ordered subjects only; no clustering/Today/novelty evaluation; v2 retains its historical exam evidence unchanged'}
  const versions:ReplayVersions={policyId:policy.id,policyHash:digest(policy),indexHash:byteHash(indexPath),registryHash:observations[0].registryHash,codeHash:digest(files)}
  const traces=observations.map(o=>({url:o.metadata.url,observationId:o.id,metadataHash:o.metadataHash,clock,verdict:classify(observationItem(o.metadata),index)})).sort((a,b)=>a.url.localeCompare(b.url,'en'))
  const run=replay({observations,history:[],clock,versions},input=>({articles:input.observations.map(o=>{
    const v=classify(observationItem(o.metadata),index),primary=v.subjects[0]??null
    requireThat(primary===null || SUBJECTS.includes(primary as never),'Unknown existing v2 subject')
    return {url:o.metadata.url,decision:v.accepted?'accepted':'rejected',primarySubject:primary,eventId:null,themeId:null,angleId:null,novelty:'not_applicable'} as Prediction
  }),units:[]}))
  return {version:'tars-frozen-v2-baseline/v1',clock,baseCommit,policy,files,index:{path:indexPath,sha256:byteHash(indexPath)},run,traces,decisionCounts:{accepted:run.articles.filter(a=>a.decision==='accepted').length,rejected:run.articles.filter(a=>a.decision==='rejected').length,deferred:0},qualityMetrics:null}
}
