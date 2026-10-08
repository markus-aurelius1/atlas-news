/** Neutral deterministic calibration subset only. No relevance/classification/novelty predictions. */
import { digest, requireThat } from './core.ts'
import type { blindExport } from './bootstrap.ts'
export type CalibrationRecord = ReturnType<typeof blindExport>[number]
export interface CalibrationSampling { entries: {id:string;coverageTags:string[];sampling:{panel:string}}[] }
export interface CalibrationTemporal {
 equivalentCandidates:{candidateId:string;articleIds:string[]}[]
 sequences:{candidateId:string;constraint:string;articleIds:string[]}[]
 analyticalArticleIds:string[]
}
export const CALIBRATION_SEED='tars-owner-calibration-50/v1'
export const CALIBRATION_LABEL='Owner calibration set — not statistical release evaluation'
// Fixed before selecting any IDs. Targets overlap and describe metadata, never expected answers.
export const CALIBRATION_TARGETS:Record<string,number>={ordinary_representative:10,indian_express:16,the_hindu:10,other_publishers:10,opinion_feeds:12,ie_explained:8,ie_upsc:4,science:6,environment:4,security_terms:5,ir_terms:6,economy:6,institution_terms:6,party_terms:5,foreign_domestic_terms:5,missing_description:22,description_present:20,missing_byline:20,byline_present:10,metadata_poor:12,single_source:15,potential_analysis:12,representative_panel:22,coverage_panel:20,recent_publication:12}
const compare=(a:string,b:string)=>a<b?-1:a>b?1:0
const author=(name:string)=>name.toLowerCase().replace(/[^a-z]/g,'')
export function verifiedRequestedAuthors(r:CalibrationRecord):string[] {
 return [...new Set(r.metadata.bylines.filter(b=>['rss:dc:creator','rss:author','atom:author'].includes(b.provenance)).flatMap(b=>author(b.name)==='pratapbhanumehta'?['Pratap Bhanu Mehta']:author(b.name)==='crajamohan'?['C. Raja Mohan']:[]))].sort()
}
export function selectCalibration(records:CalibrationRecord[],sampling:CalibrationSampling,temporal:CalibrationTemporal,clock:string){
 requireThat(records.length>=50&&new Set(records.map(r=>r.id)).size===records.length,'Need at least 50 unique immutable records')
 const rows=[...records].sort((a,b)=>compare(a.id,b.id)),lookup=new Map(rows.map(r=>[r.id,r])),samples=new Map(sampling.entries.map(s=>[s.id,s])),analytical=new Set(temporal.analyticalArticleIds)
 const slices=new Map(rows.map(r=>{
  const s=samples.get(r.id);requireThat(s,'Missing frozen sampling identity');const tags=new Set(s.coverageTags),m=r.metadata,requested=verifiedRequestedAuthors(r)
  if(m.publisher==='Indian Express')tags.add('indian_express');else if(m.publisher==='The Hindu')tags.add('the_hindu');else tags.add('other_publishers')
  if(tags.has('ie_opinion')||tags.has('th_opinion')||m.memberships.some(x=>/opinion|editorial|column|op-ed|lead/i.test(x.section)))tags.add('opinion_feeds')
  if(analytical.has(r.id))tags.add('potential_analysis')
  if(s.sampling.panel==='representative'&&!analytical.has(r.id)&&!tags.has('ie_explained')&&!tags.has('ie_upsc'))tags.add('ordinary_representative')
  tags.add(s.sampling.panel+'_panel');tags.add(m.description?'description_present':'missing_description');tags.add(m.bylines.length?'byline_present':'missing_byline')
  if(!m.description&&(!m.bylines.length||!m.categories.length))tags.add('metadata_poor')
  if(m.publishedAt&&m.publishedAt<=clock&&Date.parse(clock)-Date.parse(m.publishedAt)<=7*86400000)tags.add('recent_publication')
  requested.forEach(a=>tags.add('verified_author:'+a));return [r.id,tags] as const
 }))
 const selected=new Set<string>(),trace:{id:string;phase:string}[]=[],anchors:{kind:string;candidateId:string;articleIds:string[]}[]=[]
 const add=(ids:string[],phase:string)=>{for(const id of ids)if(!selected.has(id)){requireThat(lookup.has(id),'Unknown candidate ID');requireThat(selected.size<50,'Calibration capacity exceeded');selected.add(id);trace.push({id,phase})}}
 const counts=()=>Object.fromEntries(Object.keys(CALIBRATION_TARGETS).map(k=>[k,[...selected].filter(id=>slices.get(id)!.has(k)).length]))
 const score=(ids:string[])=>{const current=counts(),fresh=[...new Set(ids)].filter(id=>!selected.has(id));if(!fresh.length)return 0;let gain=0
  for(const [key,target] of Object.entries(CALIBRATION_TARGETS)){const n=fresh.filter(id=>slices.get(id)!.has(key)).length;gain+=Math.min(Math.max(0,target-current[key]),n)/target}
  const publishers=new Set([...selected].map(id=>lookup.get(id)!.metadata.publisher)),feeds=new Set([...selected].flatMap(id=>lookup.get(id)!.metadata.memberships.map(m=>m.sourceId)))
  gain+=new Set(fresh.map(id=>lookup.get(id)!.metadata.publisher).filter(p=>!publishers.has(p))).size*0.15
  gain+=new Set(fresh.flatMap(id=>lookup.get(id)!.metadata.memberships.map(m=>m.sourceId)).filter(f=>!feeds.has(f))).size*0.03
  return gain/fresh.length
 }
 const rank=<T>(items:T[],ids:(x:T)=>string[],key:(x:T)=>string)=>items.map(item=>({item,score:score(ids(item)),tie:digest([CALIBRATION_SEED,key(item)])})).sort((a,b)=>b.score-a.score||compare(a.tie,b.tie)).map(x=>x.item)
 const requested=rows.filter(r=>verifiedRequestedAuthors(r).length);requireThat(requested.length<=50,'Requested-author census exceeds capacity');add(requested.map(r=>r.id),'verified_requested_author_census')
 const groups=temporal.equivalentCandidates.filter(g=>g.articleIds.length>=2&&g.articleIds.length<=3&&g.articleIds.every(id=>lookup.has(id)))
 for(let n=0;n<Math.min(3,groups.length);n++){const chosen=rank(groups.filter(g=>!anchors.some(a=>a.candidateId===g.candidateId)),g=>g.articleIds,g=>g.candidateId)[0];add(chosen.articleIds,'existing_equivalence_candidate_group');anchors.push({kind:'unconfirmed_equivalence_candidate',candidateId:chosen.candidateId,articleIds:[...chosen.articleIds].sort()})}
 const usedThemes=new Set<string>()
 for(let n=0;n<2;n++){
  const pairs=temporal.sequences.filter(s=>!usedThemes.has(s.candidateId)).flatMap(s=>{
   const eligible=s.articleIds.filter(id=>lookup.has(id)).sort((a,b)=>compare(digest([CALIBRATION_SEED,'theme',a]),digest([CALIBRATION_SEED,'theme',b])))
   return eligible.filter(id=>analytical.has(id)).slice(0,32).flatMap(left=>eligible.filter(id=>!analytical.has(id)).slice(0,32).map(right=>({candidateId:s.candidateId,articleIds:[left,right]})))
  });if(!pairs.length)break;const chosen=rank(pairs,p=>p.articleIds,p=>p.candidateId+'|'+p.articleIds.join('|'))[0];add(chosen.articleIds,'existing_theme_analysis_contrast');usedThemes.add(chosen.candidateId);anchors.push({kind:'unconfirmed_theme_analysis_contrast',...chosen})
 }
 while(selected.size<50){const next=rank(rows.filter(r=>!selected.has(r.id)),r=>[r.id],r=>r.id)[0];add([next.id],'overlapping_neutral_slice_coverage')}
 const reviewOrder=[...selected].sort((a,b)=>compare(digest([CALIBRATION_SEED,'review-order',a]),digest([CALIBRATION_SEED,'review-order',b])))
 const coverage=Object.entries(CALIBRATION_TARGETS).map(([slice,target])=>({slice,target,available:rows.filter(r=>slices.get(r.id)!.has(slice)).length,selected:reviewOrder.filter(id=>slices.get(id)!.has(slice)).length}))
 const groupCoverage=temporal.equivalentCandidates.map(g=>({...g,selectedArticleIds:g.articleIds.filter(id=>selected.has(id))})).filter(g=>g.selectedArticleIds.length>=2)
 return {records:reviewOrder.map(id=>lookup.get(id)!),ids:reviewOrder,coverage,anchors,trace,groupCoverage,shortfalls:coverage.filter(c=>c.selected<c.target),memberships:reviewOrder.map(id=>({id,slices:[...slices.get(id)!].sort()})),requestedAuthors:requested.map(r=>({id:r.id,authors:verifiedRequestedAuthors(r)}))}
}
