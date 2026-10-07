/** Human judgment schema is separate from predictions and raw observations. */
import type { EvidenceSpan, Observation, GoldRecord } from './contracts.ts'
import { digest, instant, requireThat, unique } from './core.ts'
import { checkEditorialJudgmentSchema } from './editorial-schema.ts'
import type { ReviewPolicy } from './validate.ts'
export const EMPTY_EDITORIAL_LABELS:EditorialLabels = {
  priority:null,relation:null,disposition:null,readingNeedId:null,developmentId:null,themeId:null,novelty:null,materialDelta:null,
  bestRepresentativeUrls:[],comparableUrls:[],secondaryJustification:null,rationale:null,metadataSufficiency:null,
}
export interface EditorialLabels {
  priority:'must_read'|'useful'|null
  relation:'same_development'|'related_material_new_development'|'equivalent_report'|'distinct_valuable_analysis'|'redundant_analysis'|'unrelated'|'uncertain'|null
  disposition:'selected_reading_unit'|'qualified_duplicate_internal'|'qualified_unselected_internal'|'rejected'|null
  readingNeedId:string|null;developmentId:string|null;themeId:string|null
  novelty:'new_development'|'material_new_development'|'distinct_analysis'|'equivalent_repeat'|'uncertain'|null
  materialDelta:{description:string;evidence:EvidenceSpan[]}|null
  bestRepresentativeUrls:string[];comparableUrls:string[]
  secondaryJustification:'unique'|'high_substantive_confidence'|'materially_superior'|null
  rationale:string|null;metadataSufficiency:GoldRecord['gold']['metadataSufficiency']
}
export interface EditorialJudgment {
  version:'tars-editorial-judgment/v1';id:string;kind:'representative_set'|'reading_need'|'temporal_transition'|'archive_entry'
  partition:'development'|'validation';clock:string;articleUrls:string[];observationIds:string[];historyObservationIds:string[]
  review:{status:'unreviewed'|'in_review'|'disputed'|'adjudicated'|'unresolvable';annotations:{reviewerId:string;reviewedAt:string;rubricVersion:string;labels:EditorialLabels;evidence:EvidenceSpan[]}[];adjudicatorId:string|null}
  gold:EditorialLabels
}
export function validateEditorialJudgment(j:EditorialJudgment,observations:Observation[],policy:ReviewPolicy='two_independent') {
  checkEditorialJudgmentSchema(j)
  requireThat(j.version==='tars-editorial-judgment/v1'&&['development','validation'].includes(j.partition),'Bootstrap judgments only; no holdout')
  const lookup=new Map(observations.map(o=>[o.id,o]));unique(j.review.annotations,a=>a.reviewerId,'editorial reviewer')
  unique(j.articleUrls,u=>u,'judgment URL');unique([...j.observationIds,...j.historyObservationIds],id=>id,'judgment observation')
  requireThat(j.articleUrls.length>0&&j.observationIds.length>0,'Judgment needs actual metadata')
  for(const id of [...j.observationIds,...j.historyObservationIds]) {
    const o=lookup.get(id);requireThat(o&&instant(o.capturedAt)<=instant(j.clock),'Missing/future editorial observation')
    requireThat([o.metadata.publishedAt,o.metadata.updatedAt].every(t=>t===null||instant(t)<=instant(j.clock)),'Future publisher metadata')
  }
  requireThat(j.historyObservationIds.every(id=>instant(lookup.get(id)!.capturedAt)<instant(j.clock)),'History must precede cutoff')
  requireThat(j.articleUrls.every(url=>j.observationIds.some(id=>lookup.get(id)!.metadata.url===url)),'Judgment references unseen article')
  const labels=[j.gold,...j.review.annotations.map(a=>a.labels)]
  for(const a of j.review.annotations)requireThat(instant(a.reviewedAt)>=instant(j.clock)&&a.evidence.length>0,'Review needs evidence after cutoff')
  for(const label of labels) {
    requireThat([...label.bestRepresentativeUrls,...label.comparableUrls].every(url=>j.articleUrls.includes(url)),'Representative candidate outside set')
    requireThat(!label.materialDelta||label.materialDelta.description&&label.materialDelta.evidence.length,'Material delta requires observed evidence')
    requireThat(!['related_material_new_development','distinct_valuable_analysis'].includes(label.relation??'')||label.materialDelta&&label.readingNeedId&&label.developmentId,'New development/analysis needs supported distinction')
    requireThat(!['material_new_development','distinct_analysis'].includes(label.novelty??'')||label.materialDelta,'Novelty needs a material delta; time/author/publisher alone is insufficient')
    requireThat(label.novelty!=='equivalent_repeat'||label.materialDelta===null&&j.historyObservationIds.length>0,'Repeat needs earlier observed metadata, no delta')
  }
  const spans=[...j.review.annotations.flatMap(a=>a.evidence),...labels.flatMap(l=>l.materialDelta?.evidence??[])]
  for(const s of spans) {
    const o=lookup.get(s.observationId);requireThat(o&&[...j.observationIds,...j.historyObservationIds].includes(s.observationId),'Missing editorial evidence')
    const text=s.field==='categories'?o.metadata.categories.join('\n'):s.field==='bylines'?o.metadata.bylines.map(b=>b.name).join('\n'):o.metadata[s.field]
    requireThat(Number.isInteger(s.start)&&s.start>=0&&s.end>s.start&&s.end<=text.length,'Editorial evidence offsets invalid')
  }
  if(j.review.status==='adjudicated') {
    requireThat(j.review.annotations.length>=(policy==='bootstrap_primary_human'?1:2)&&j.review.adjudicatorId&&j.gold.rationale&&j.gold.metadataSufficiency,'Complete human adjudication required')
    requireThat(j.review.annotations.some(a=>a.reviewerId===j.review.adjudicatorId&&digest(a.labels)===digest(j.gold)),'Preserve primary/adjudicator judgment explicitly')
    if(j.kind==='representative_set')requireThat(j.gold.bestRepresentativeUrls.length>0,'Representative set needs human best reasonable URLs')
    if(j.kind==='reading_need'||j.kind==='archive_entry')requireThat(j.gold.disposition&&(j.gold.disposition==='rejected'||j.gold.readingNeedId&&j.gold.developmentId),'Reading-state judgment missing')
    if(j.kind==='reading_need'&&j.gold.disposition==='selected_reading_unit')requireThat(j.gold.priority,'Human required-need priority missing')
    if(j.kind==='temporal_transition')requireThat(j.gold.novelty&&j.gold.relation,'Temporal judgment missing')
  } else requireThat(digest(j.gold)===digest(EMPTY_EDITORIAL_LABELS)&&j.review.adjudicatorId===null,'Pending judgments must have empty gold')
  requireThat(j.review.status!=='unreviewed'||j.review.annotations.length===0,'Unreviewed judgment has annotations')
  requireThat(j.review.status!=='disputed'||j.review.annotations.length>=2,'Disagreement needs second reviewer')
  for(const label of labels) {
    const suff=label.metadataSufficiency;if(!suff)continue
    requireThat(['sufficient','limited','insufficient'].includes(suff.level),'Invalid sufficiency level')
    requireThat(suff.missingFields.every(f=>['title','description','bylines','categories','publication_time','scope','development','angle'].includes(f)), 'Unknown sufficiency field')
    requireThat(suff.level==='sufficient'?suff.missingFields.length===0:suff.missingFields.length>0,'Sufficiency missing-field reasons required')
  }
}
