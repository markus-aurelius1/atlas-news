/** Replay boundary for future E/F output. This validates supplied decisions; it never chooses/classifies/ranks. */
import type { Observation, EvidenceSpan, ReplayVersions } from './contracts.ts'
import { digest, instant, ordered, requireThat, unique } from './core.ts'
import { validateObservation } from './validate.ts'
import { checkEditorialOutputSchema } from './editorial-schema.ts'
import { EDITORIAL_POLICY } from './editorial-policy.ts'
export type CandidateState='rejected'|'qualified_duplicate_internal'|'qualified_unselected_internal'|'selected_reading_unit'
export interface EditorialUnit { id:string;readingNeedId:string;developmentId:string;themeId:string|null;kind:'development'|'distinct_analysis';representativeUrl:string;observationIds:string[];firstSelectedAt:string;updatedAt:string }
export interface EditorialOutput {
  version:'tars-editorial-output/v1';clock:string
  candidates:{url:string;state:CandidateState;readingNeedId:string|null;reasonCodes:string[]}[]
  readingUnits:EditorialUnit[];todayUnitIds:string[];archiveUnitIds:string[]
  replacements:{unitId:string;readingNeedId:string;developmentId:string;fromUrl:string;toUrl:string;at:string;reasonCodes:string[];evidence:EvidenceSpan[]}[]
}
export interface EditorialInput { observations:Observation[];history:Observation[];clock:string;versions:ReplayVersions;memory:{historyDays:number;strongRepeatComparisonDays:number};priorSelections:EditorialOutput[] }
export function validateEditorialOutput(output:EditorialOutput,input:EditorialInput) {
  checkEditorialOutputSchema(output)
  requireThat(output.version==='tars-editorial-output/v1'&&output.clock===input.clock,'Editorial output clock/version mismatch')
  requireThat(output.todayUnitIds.length<=EDITORIAL_POLICY.maxTodayUnits,'Today exceeds 50 visible reading units')
  unique(output.todayUnitIds,s=>s,'Today unit');unique(output.archiveUnitIds,s=>s,'Archive unit');unique(output.readingUnits,u=>u.id,'reading unit');unique(output.readingUnits,u=>u.readingNeedId,'reading need');unique(output.candidates,c=>c.url,'candidate URL')
  const observations=[...input.observations,...input.history],lookup=new Map(observations.map(o=>[o.id,o])),available=new Set(observations.map(o=>o.metadata.url)),units=new Map(output.readingUnits.map(u=>[u.id,u])),candidates=new Map(output.candidates.map(c=>[c.url,c]))
  const priorUnits=new Map(input.priorSelections.flatMap(p=>p.readingUnits.filter(u=>p.todayUnitIds.includes(u.id)||p.archiveUnitIds.includes(u.id))).map(u=>[u.id,u]))
  requireThat(output.candidates.every(c=>available.has(c.url)&&['rejected','qualified_duplicate_internal','qualified_unselected_internal','selected_reading_unit'].includes(c.state)),'Unseen candidate or unknown state')
  requireThat([...output.todayUnitIds,...output.archiveUnitIds].every(id=>units.has(id)),'Visible reading unit missing')
  unique(output.readingUnits.filter(u=>u.kind==='development'),u=>u.developmentId,'visible factual development')
  for(const unit of output.readingUnits) {
    requireThat(unit.id&&unit.readingNeedId&&unit.developmentId,'Stable reading/development identities required')
    requireThat(instant(unit.firstSelectedAt)<=instant(unit.updatedAt)&&instant(unit.updatedAt)<=instant(input.clock),'Future selected record')
    const prior=priorUnits.get(unit.id)
    if(prior)requireThat(prior.readingNeedId===unit.readingNeedId&&prior.developmentId===unit.developmentId&&prior.kind===unit.kind&&prior.firstSelectedAt===unit.firstSelectedAt,'Representative update cannot replace identity with a new development')
    else requireThat(unit.firstSelectedAt===input.clock&&output.todayUnitIds.includes(unit.id),'Archive cannot import unselected leftovers or invent past selection')
    if(output.todayUnitIds.includes(unit.id)) {
      requireThat(available.has(unit.representativeUrl)&&unit.observationIds.some(id=>lookup.get(id)?.metadata.url===unit.representativeUrl),'Today representative needs available raw provenance')
      const state=candidates.get(unit.representativeUrl)
      requireThat(state?.state==='selected_reading_unit'&&state.readingNeedId===unit.readingNeedId,'Only editorially selected units may be visible')
    }
    for(const id of unit.observationIds)requireThat(lookup.has(id)||input.priorSelections.some(p=>p.readingUnits.some(u=>u.id===unit.id&&u.observationIds.includes(id))),'Unit invented provenance')
    if(output.archiveUnitIds.includes(unit.id))requireThat(prior||output.todayUnitIds.includes(unit.id),'Archive must be selected historical reading record')
    if(output.archiveUnitIds.includes(unit.id)||output.todayUnitIds.includes(unit.id))requireThat(!candidates.has(unit.representativeUrl)||candidates.get(unit.representativeUrl)!.state==='selected_reading_unit','Rejected/duplicate/internal-only article exposed as Archive/Today')
    if(prior&&prior.representativeUrl!==unit.representativeUrl)requireThat(output.replacements.some(r=>r.unitId===unit.id&&r.fromUrl===prior.representativeUrl&&r.toUrl===unit.representativeUrl),'Representative change requires replacement record')
  }
  for(const r of output.replacements) {
    const prior=priorUnits.get(r.unitId),now=units.get(r.unitId)
    requireThat(prior&&now&&r.readingNeedId===prior.readingNeedId&&r.developmentId===prior.developmentId&&now.readingNeedId===r.readingNeedId&&now.developmentId===r.developmentId&&r.fromUrl===prior.representativeUrl&&r.toUrl===now.representativeUrl&&r.fromUrl!==r.toUrl,'Replacement must preserve one development/need, both URLs')
    requireThat(prior.observationIds.every(id=>now.observationIds.includes(id)),'Replacement must retain earlier observation provenance')
    requireThat(r.at===input.clock&&r.reasonCodes.length>0&&r.evidence.length>0,'Replacement requires clock-bound quality evidence')
    for(const s of r.evidence) {
      const o=lookup.get(s.observationId);requireThat(o,'Replacement evidence unavailable')
      const t=s.field==='bylines'?o.metadata.bylines.map(b=>b.name).join('\n'):s.field==='categories'?o.metadata.categories.join('\n'):o.metadata[s.field]
      requireThat(s.start>=0&&s.end>s.start&&s.end<=t.length,'Invalid replacement evidence')
    }
  }
}
function freeze<T>(value:T):T {if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value)}return value}
export function replayEditorial(input:EditorialInput,runner:(input:Readonly<EditorialInput>)=>EditorialOutput) {
  requireThat(Object.keys(input).every(k=>['observations','history','clock','versions','memory','priorSelections'].includes(k)),'Editorial replay cannot receive gold, exemplars or personal state')
  requireThat(input.memory.historyDays>0&&input.memory.strongRepeatComparisonDays>0&&input.memory.strongRepeatComparisonDays<=input.memory.historyDays,'Invalid configurable memory windows')
  requireThat(input.history.every(o=>instant(o.capturedAt)<instant(input.clock)&&instant(o.capturedAt)>=instant(input.clock)-input.memory.historyDays*86400000),'History outside configured metadata window')
  const all=[...input.observations,...input.history];unique(all,o=>o.id,'editorial observation')
  all.forEach(o=>{validateObservation(o);requireThat(instant(o.capturedAt)<=instant(input.clock)&&[o.metadata.publishedAt,o.metadata.updatedAt].every(t=>t===null||instant(t)<=instant(input.clock)),'Future editorial metadata')})
  input.priorSelections.forEach(p=>{checkEditorialOutputSchema(p);requireThat(p.readingUnits.every(u=>instant(u.updatedAt)<=instant(p.clock)),'Future selected unit history')})
  requireThat(input.priorSelections.every(p=>instant(p.clock)<instant(input.clock)),'Future selected history')
  const sorted=freeze(structuredClone({...input,observations:ordered(input.observations),history:ordered(input.history),priorSelections:[...input.priorSelections].sort((a,b)=>a.clock.localeCompare(b.clock,'en'))}))
  const output=runner(sorted);validateEditorialOutput(output,sorted)
  return {version:'tars-editorial-run/v1',clock:input.clock,versions:input.versions,memory:input.memory,inputHash:digest(sorted),outputHash:digest(output),output}
}
/** Actual capture times govern availability. Publisher backfill never becomes a fabricated past observation. */
export function replayEditorialSequence(timeline:Observation[],clocks:string[],versions:ReplayVersions,runner:(input:Readonly<EditorialInput>)=>EditorialOutput,memory={historyDays:14,strongRepeatComparisonDays:7}) {
  timeline.forEach(validateObservation);unique(timeline,o=>o.id,'timeline observation')
  requireThat(clocks.every((t,i)=>i===0||instant(t)>instant(clocks[i-1])),'Strictly increasing replay clocks required')
  const priorSelections:EditorialOutput[]=[]
  return clocks.map((clock,i)=>{
    const cutoff=instant(clock),historyStart=cutoff-memory.historyDays*86400000,previous=i?instant(clocks[i-1]):-Infinity
    const available=timeline.filter(o=>instant(o.capturedAt)<=cutoff&&[o.metadata.publishedAt,o.metadata.updatedAt].every(t=>t===null||instant(t)<=cutoff))
    const observations=available.filter(o=>instant(o.capturedAt)>previous),history=available.filter(o=>instant(o.capturedAt)<=previous&&instant(o.capturedAt)>=historyStart)
    const run=replayEditorial({observations,history,clock,versions,memory,priorSelections},runner)
    // Metadata is bounded by historyDays; represented need identities do not become fresh via a timed reset.
    priorSelections.push(run.output);return run
  })
}
