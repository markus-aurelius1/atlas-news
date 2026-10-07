/** Pair/sequence sufficiency is assessed by humans, independently of metadata presence or article value. */
import type { Observation } from './contracts.ts'
import type { EditorialJudgment } from './editorial-judgments.ts'
import { validateEditorialJudgment } from './editorial-judgments.ts'
import { rate } from './metrics.ts'
import { digest,requireThat,unique } from './core.ts'
export function importEditorialReview(templates:EditorialJudgment[],observations:Observation[],responses:EditorialJudgment[]) {
  unique(responses,j=>j.id,'human editorial response');const originals=new Map(templates.map(j=>[j.id,j]))
  for(const j of responses){const original=originals.get(j.id);requireThat(original,'Unknown editorial review task');const immutable=(v:EditorialJudgment)=>({id:v.id,version:v.version,kind:v.kind,partition:v.partition,clock:v.clock,articleUrls:v.articleUrls,observationIds:v.observationIds,historyObservationIds:v.historyObservationIds});requireThat(digest(immutable(j))===digest(immutable(original!)),'Human response changed immutable task metadata');validateEditorialJudgment(j,observations,'bootstrap_primary_human');requireThat(j.review.annotations.length>0,'Human editorial response needs an actual annotation')}
  const supplied=new Map(responses.map(j=>[j.id,j]));return templates.map(j=>supplied.get(j.id)??j)
}
export function editorialMetadataStudy(judgments:EditorialJudgment[],observations:Observation[]) {
  const lookup=new Map(observations.map(o=>[o.id,o]))
  const tags=(j:EditorialJudgment)=>{const rows=j.observationIds.map(id=>lookup.get(id)!),keys=['all','task:'+j.kind];for(const o of rows){keys.push('publisher:'+o.metadata.publisher);if(o.metadata.publisher==='Indian Express')keys.push(o.metadata.description?'ie_with_description':'ie_without_description');if(o.metadata.publisher==='The Hindu')keys.push(o.metadata.description?'th_with_description':'th_without_description')};if(j.review.status==='adjudicated'&&j.gold.relation)keys.push('human_relation:'+j.gold.relation);return [...new Set(keys)]}
  const names=[...new Set(judgments.flatMap(tags))].sort()
  const slices=names.map(slice=>{const rows=judgments.filter(j=>tags(j).includes(slice)),assessments=rows.flatMap(j=>{const suff=j.review.status==='adjudicated'?j.gold.metadataSufficiency:j.review.annotations[0]?.labels.metadataSufficiency;return suff?[suff]:[]}),counts=Object.fromEntries(['sufficient','limited','insufficient'].map(level=>[level,assessments.filter(a=>a.level===level).length]));return {slice,tasks:rows.length,assessed:assessments.length,unassessed:rows.length-assessments.length,counts,rates:Object.fromEntries(Object.entries(counts).map(([k,n])=>[k,rate(n,assessments.length)])),missingFields:Object.fromEntries(['title','description','bylines','categories','publication_time','scope','development','angle'].map(field=>[field,assessments.filter(a=>a.missingFields.includes(field as 'description')).length])),basis:'One primary assessment per task; unresolved annotation sufficiency is provisional, not final semantic gold.'}})
  return {version:'tars-editorial-metadata-sufficiency/v1',status:judgments.some(j=>j.review.annotations.length)?'human_assessments_available':'awaiting_adjudication',slices,semanticQualityClaim:null,independence:'Article-level sufficiency is reported separately. No title heuristic or field presence supplies semantic sufficiency; tasks can overlap articles and each other.'}
}
