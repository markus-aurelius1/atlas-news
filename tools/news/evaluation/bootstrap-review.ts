/** Import explicit human responses; preserve labels/metadata unchanged and never manufacture a second reviewer. */
import type { GoldRecord, Annotation } from './contracts.ts'
import { requireThat } from './core.ts'
import { validateCorpus } from './validate.ts'
import type { Observation } from './contracts.ts'
import { RUBRIC_VERSION } from './bootstrap.ts'
export interface HumanResponse { id:string; annotation: Omit<Annotation,'reviewerId'|'reviewedAt'> & { reviewerId:string|null; reviewedAt:string|null; disposition:'resolved'|'unresolvable'|null } }
export function applyPrimaryReview(corpus:GoldRecord[],observations:Observation[],responses:HumanResponse[]) {
  requireThat(new Set(responses.map(r=>r.id)).size===responses.length,'Duplicate human response')
  requireThat(responses.every(r=>corpus.some(c=>c.id===r.id)),'Unknown response ID')
  const lookup=new Map(responses.map(r=>[r.id,r]))
  const result=corpus.map(original=>{
    const r=structuredClone(original),response=lookup.get(r.id);if(!response)return r
    requireThat(r.review.status==='unreviewed','Append/version reviews; do not overwrite earlier labels')
    const {disposition,...a}=response.annotation
    requireThat(a.reviewerId && a.reviewedAt && a.rubricVersion===RUBRIC_VERSION && a.evidence.length && ['resolved','unresolvable'].includes(disposition??''),'Human identity, timestamp, rubric, evidence and disposition required')
    r.review.annotations=[a as Annotation]
    if(disposition==='resolved') {
      requireThat(a.labels.rationale,'Human rationale required')
      r.review.status='adjudicated';r.gold=structuredClone(a.labels)
      r.review.adjudication={adjudicatorId:a.reviewerId,reviewedAt:a.reviewedAt,rationale:a.labels.rationale,resolutionVersion:RUBRIC_VERSION,labels:structuredClone(a.labels)}
    }else r.review.status='unresolvable'
    return r
  })
  return validateCorpus(result,observations,'implementation','bootstrap_primary_human')
}
