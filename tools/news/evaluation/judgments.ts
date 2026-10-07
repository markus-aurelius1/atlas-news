import type { EvidenceSpan, Partition, Observation, RunArtifact } from './contracts.ts'
import { instant, requireThat, unique, urlIdentity } from './core.ts'
import { pairMetric, rate } from './metrics.ts'
import { checkJudgmentSchema, validateObservation, validateRun } from './validate.ts'

interface JudgmentBase {
  version:'tars-news-judgment/v1'; id:string; partition:Partition; clock:string
  reviewStatus:'unreviewed'|'disputed'|'adjudicated'|'unresolvable'
  annotations:{reviewerId:string; reviewedAt:string; rubricVersion:string; label:string|null; evidence:EvidenceSpan[]}[]
  adjudicatorId:string|null; rationale:string
}
export interface PairJudgment extends JudgmentBase {
  kind:'event_pair'|'analysis_pair'|'anchor_pair';leftUrl:string;rightUrl:string
  label:'same_development'|'related_distinct_development'|'unrelated'|'uncertain'|'equivalent_angle'|'complementary_valuable_angle'|'redundant_analysis'|'comparable_quality'|'left_materially_better'|'right_materially_better'|null
  cannotLink:boolean|null
}
export interface SequenceJudgment extends JudgmentBase {
  kind:'sequence';historyObservationIds:string[];label:'sequence_reviewed'|null
  needs:{id:string;qualifyingUrls:string[];novelty:'new_development'|'distinct_analysis'|'repeat'|'uncertain';mustRead:boolean}[]
}
export function validateJudgment(value:unknown, observations:Observation[], access:'implementation'|'custodian'='implementation'): asserts value is PairJudgment|SequenceJudgment {
  const partition=(value as {partition?:string}|null)?.partition
  requireThat(access==='custodian'||!partition?.startsWith('holdout_'),'Sealed holdout judgments unavailable')
  checkJudgmentSchema(value)
  const j=value as PairJudgment|SequenceJudgment
  observations.forEach(validateObservation)
  const ids=new Map(observations.map(o=>[o.id,o]))
  unique(j.annotations,a=>a.reviewerId,'independent judgment reviewer')
  requireThat(j.reviewStatus!=='adjudicated'||j.label!==null&&j.adjudicatorId&&j.annotations.length>=2&&j.rationale,'Incomplete judgment adjudication')
  requireThat(j.reviewStatus==='adjudicated'||j.label===null&&j.adjudicatorId===null,'Unresolved judgment cannot carry final truth')
  for(const a of j.annotations)for(const span of a.evidence){
    const o=ids.get(span.observationId)
    requireThat(o&&instant(o.capturedAt)<=instant(j.clock),'Missing/future judgment evidence')
    const field=span.field==='categories'?o.metadata.categories.join('\n'):span.field==='bylines'?o.metadata.bylines.map(b=>b.name).join('\n'):o.metadata[span.field]
    requireThat(span.end>span.start&&span.end<=field.length,'Invalid judgment evidence span')
  }
  const available=new Set(observations.filter(o=>instant(o.capturedAt)<=instant(j.clock)).map(o=>o.metadata.url))
  if(j.kind==='sequence'){
    unique(j.needs,n=>n.id,'sequence need')
    requireThat(j.reviewStatus==='adjudicated'||j.needs.length===0,'Pending sequence cannot expose gold needs')
    for(const id of j.historyObservationIds)requireThat(ids.has(id)&&instant(ids.get(id)!.capturedAt)<instant(j.clock),'Future sequence history')
    requireThat(j.needs.every(n=>n.qualifyingUrls.every(url=>available.has(urlIdentity(url)))),'Sequence references unobserved URL')
  }else{
    requireThat(j.leftUrl!==j.rightUrl&&available.has(j.leftUrl)&&available.has(j.rightUrl),'Pair must reference distinct observed articles')
    requireThat(j.cannotLink!==true||j.kind==='event_pair'&&['related_distinct_development','unrelated'].includes(j.label!),'Contradictory cannot-link')
  }
}
export function evaluateEventPairs(pairs:PairJudgment[],run:RunArtifact,observations:Observation[],access:'implementation'|'custodian'='implementation'){
  pairs.forEach(p=>validateJudgment(p,observations,access));unique(pairs,p=>p.id,'pair judgment')
  requireThat(pairs.every(p=>p.clock===run.clock),'Pair/run cutoff mismatch')
  validateRun(run)
  const rows=new Map(run.articles.map(a=>[a.url,a]))
  const same=(p:PairJudgment)=>!!rows.get(p.leftUrl)?.eventId&&rows.get(p.leftUrl)?.eventId===rows.get(p.rightUrl)?.eventId
  const event=pairs.filter(p=>p.kind==='event_pair')
  return {...pairMetric(event.map(p=>({left:p.leftUrl,right:p.rightUrl,same:p.reviewStatus!=='adjudicated'||p.label==='uncertain'?null:p.label==='same_development',predictedSame:same(p)}))),cannotLinkFailures:event.filter(p=>p.reviewStatus==='adjudicated'&&p.cannotLink===true&&same(p)).length}
}
export function evaluateSequence(j:SequenceJudgment,run:RunArtifact,observations:Observation[],access:'implementation'|'custodian'='implementation'){
  validateJudgment(j,observations,access)
  validateRun(run);requireThat(j.clock===run.clock,'Sequence/run cutoff mismatch')
  requireThat(j.reviewStatus==='adjudicated','Sequence metrics pending human adjudication')
  const top=new Set(run.units.map(u=>u.primaryUrl)),expanded=new Set(run.units.flatMap(u=>u.memberUrls))
  const eligible=j.needs.filter(n=>n.novelty!=='repeat'&&n.novelty!=='uncertain')
  const covered=(n:typeof eligible[number],urls:Set<string>)=>n.qualifyingUrls.some(url=>urls.has(url))
  return {topLevel:rate(eligible.filter(n=>covered(n,top)).length,eligible.length),expanded:rate(eligible.filter(n=>covered(n,expanded)).length,eligible.length),mustRead:rate(eligible.filter(n=>n.mustRead&&covered(n,expanded)).length,eligible.filter(n=>n.mustRead).length),repeatExposure:rate(run.units.filter(u=>j.needs.some(n=>n.novelty==='repeat'&&n.qualifyingUrls.includes(u.primaryUrl))).length,run.units.length),uncertainNeeds:j.needs.filter(n=>n.novelty==='uncertain').length}
}
