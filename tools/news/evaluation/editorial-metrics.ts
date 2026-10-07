/** Pure assessment of supplied selection, authentic human labels and comparator sets. No selection algorithm. */
import type { GoldRecord, RunArtifact, Observation } from './contracts.ts'
import type { ReviewPolicy } from './validate.ts'
import { distribution, rate } from './metrics.ts'
import { requireThat } from './core.ts'
import { editorialMetadataStudy } from './editorial-study.ts'
import { EDITORIAL_POLICY } from './editorial-policy.ts'
import { validateEditorialJudgment } from './editorial-judgments.ts'
import type { EditorialJudgment } from './editorial-judgments.ts'
import { replayEditorial } from './editorial-replay.ts'
import type { EditorialOutput } from './editorial-replay.ts'
export function supportedDistinctAnalysis(r:GoldRecord,clock:string) {
  return !!r.gold.angleId&&['editorial','column','explainer','analysis'].includes(r.gold.contentType??'')&&r.gold.novelty?.status==='distinct_analysis'&&r.gold.novelty.cutoff===clock&&!!r.gold.materialDelta?.description&&r.gold.materialDelta.evidence.length>0
}
export function readingNeedIdentity(r:GoldRecord,clock:string) {return supportedDistinctAnalysis(r,clock)?'angle:'+r.gold.angleId:r.gold.storyId?'development:'+r.gold.storyId:'unknown:'+r.metadata.url}
export function editorialSelectionMetrics(records:GoldRecord[],run:RunArtifact,observations:Observation[],options:{judgments?:EditorialJudgment[];reviewPolicy?:ReviewPolicy;editorialOutput?:EditorialOutput;priorSelections?:EditorialOutput[];completeCandidatePoolJudged?:boolean;additionalCorePublishers?:string[]}={}) {
  if(options.editorialOutput)replayEditorial({observations,history:[],clock:run.clock,versions:run.versions,memory:{historyDays:14,strongRepeatComparisonDays:7},priorSelections:options.priorSelections??[]},()=>options.editorialOutput!)
  const judgments=options.judgments??[];judgments.forEach(j=>{requireThat(j.clock===run.clock,'Judgment/run cutoff mismatch');validateEditorialJudgment(j,observations,options.reviewPolicy)})
  const known=new Map(records.filter(r=>r.review.status==='adjudicated').map(r=>[r.metadata.url,r])),positives=[...known.values()].filter(r=>r.gold.value==='must_read'||r.gold.value==='useful')
  const selected=options.editorialOutput?options.editorialOutput.todayUnitIds.map(id=>options.editorialOutput!.readingUnits.find(u=>u.id===id)!.representativeUrl):run.units.map(u=>u.primaryUrl)
  const selectedKnown=selected.flatMap(url=>known.get(url)??[]),unjudged=selected.length-selectedKnown.length
  const resolvedFamilies=selectedKnown.filter(r=>!!r.gold.storyId||supportedDistinctAnalysis(r,run.clock)),ids=resolvedFamilies.map(r=>readingNeedIdentity(r,run.clock)),duplicateCount=ids.length-new Set(ids).size
  const positiveNeeds=new Map<string,GoldRecord[]>();for(const r of positives.filter(r=>r.gold.storyId||supportedDistinctAnalysis(r,run.clock))) {const id=readingNeedIdentity(r,run.clock);positiveNeeds.set(id,[...positiveNeeds.get(id)??[],r])}
  const selectedIds=new Set(selectedKnown.filter(r=>r.gold.value!=='reject').map(r=>readingNeedIdentity(r,run.clock)))
  const needRecall=(filter:(rows:GoldRecord[])=>boolean)=>{const needs=[...positiveNeeds].filter(([,rows])=>filter(rows));return rate(needs.filter(([id])=>selectedIds.has(id)).length,needs.length)}
  const analysis=positives.filter(r=>supportedDistinctAnalysis(r,run.clock)),analyses=new Set(analysis.map(r=>readingNeedIdentity(r,run.clock)))
  const relevantUnits=selectedKnown.filter(r=>r.gold.value!=='reject'),repeats=relevantUnits.filter(r=>r.gold.novelty?.cutoff===run.clock&&r.gold.novelty.status==='repeat'),temporalJudged=relevantUnits.filter(r=>r.gold.novelty?.cutoff===run.clock&&r.gold.novelty.status!=='uncertain'&&r.gold.novelty.status!=='not_applicable')
  const publisher=(url:string)=>observations.find(o=>o.metadata.url===url)?.metadata.publisher??'Unknown'
  const preferred=new Set<string>(EDITORIAL_POLICY.preferredComparablePublishers),core=new Set<string>([...EDITORIAL_POLICY.explicitlyNamedCorePublishers,...options.additionalCorePublishers??[]])
  const reps=judgments.filter(j=>j.kind==='representative_set'&&j.review.status==='adjudicated'&&selected.some(url=>j.articleUrls.includes(url)))
  let best=0,comparablePreferredAvailable=0,preferredWins=0,tribuneComparableLosses=0,secondaryUnjustified=0
  for(const j of reps) {
    const visible=selected.filter(url=>j.articleUrls.includes(url));if(visible.some(url=>j.gold.bestRepresentativeUrls.includes(url)))best++
    const comparablePreferred=j.gold.comparableUrls.some(url=>preferred.has(publisher(url)))
    if(comparablePreferred){comparablePreferredAvailable++;if(visible.some(url=>preferred.has(publisher(url))&&j.gold.bestRepresentativeUrls.includes(url)))preferredWins++}
    if(visible.some(url=>publisher(url)==='The Tribune')&&j.gold.comparableUrls.some(url=>core.has(publisher(url))))tribuneComparableLosses++
    if(visible.some(url=>!core.has(publisher(url)))&&!j.gold.secondaryJustification)secondaryUnjustified++
  }
  const required=judgments.filter(j=>j.kind==='reading_need'&&j.review.status==='adjudicated'&&j.gold.disposition==='selected_reading_unit')
  const requiredMap=new Map<string,{urls:Set<string>;mustRead:boolean;gain:number}>()
  for(const j of required){const old=requiredMap.get(j.gold.readingNeedId!);requiredMap.set(j.gold.readingNeedId!,{urls:new Set([...old?.urls??[],...j.articleUrls]),mustRead:old?.mustRead||j.gold.priority==='must_read',gain:Math.max(old?.gain??0,j.gold.priority==='must_read'?3:1)})}
  const coveredRequired=[...requiredMap].filter(([,n])=>selected.some(url=>n.urls.has(url)))
  const newInTheme=judgments.filter(j=>j.kind==='temporal_transition'&&j.review.status==='adjudicated'&&j.gold.relation==='related_material_new_development'&&j.gold.themeId&&j.historyObservationIds.length>0)
  const archive=options.editorialOutput?.archiveUnitIds.map(id=>options.editorialOutput!.readingUnits.find(u=>u.id===id)!)??[]
  const archiveJudgments=judgments.filter(j=>j.kind==='archive_entry'&&j.review.status==='adjudicated'),archiveInvalid=archive.filter(u=>archiveJudgments.some(j=>j.articleUrls.includes(u.representativeUrl)&&j.gold.disposition!=='selected_reading_unit'))
  const archiveReviewed=archive.filter(u=>archiveJudgments.some(j=>j.articleUrls.includes(u.representativeUrl)))
  const needGains=[...requiredMap].map(([id,n])=>({id,gain:n.gain})),sortedGains=needGains.map(n=>n.gain).sort((a,b)=>b-a),selectedUtility=needGains.filter(n=>coveredRequired.some(([id])=>id===n.id)).reduce((s,n)=>s+n.gain,0)
  const complete=requiredMap.size>0&&options.completeCandidatePoolJudged===true&&records.every(r=>r.review.status==='adjudicated')&&unjudged===0&&positives.every(r=>r.gold.storyId||supportedDistinctAnalysis(r,run.clock))
  return {
    policy:EDITORIAL_POLICY,metadataSufficiency:editorialMetadataStudy(judgments,observations),capacity:{visibleUnits:selected.length,ceiling:50,fillTarget:null,exceeded:selected.length>50},
    duplicateExposure:{...rate(duplicateCount,selected.length),desiredDirection:'approach_zero',resolvedFamilyUnits:resolvedFamilies.length,unknownFamilyUnits:selected.length-resolvedFamilies.length,status:resolvedFamilies.length===selected.length?'measured':'lower_bound_pending_human_family_judgments'},
    repeatExposure:{...rate(repeats.length,temporalJudged.length),desiredDirection:'approach_zero',unjudgedTemporalUnits:selected.length-temporalJudged.length,status:temporalJudged.length===selected.length?'measured':'pending_temporal_judgments'},
    curatedDailyNeedCoverage:{required:requiredMap.size,represented:coveredRequired.length,recall:rate(coveredRequired.length,requiredMap.size),mustRead:rate(coveredRequired.filter(([,n])=>n.mustRead).length,[...requiredMap.values()].filter(n=>n.mustRead).length),status:requiredMap.size?'conditional_human_daily_need_judgments':'pending_human_daily_need_judgments'},
    materialNewDevelopmentInExistingThemeRecall:rate(newInTheme.filter(j=>j.articleUrls.some(url=>selected.includes(url))).length,newInTheme.length),
    uniqueReadingNeedRecall:needRecall(()=>true),uniqueMustReadRecall:needRecall(rows=>rows.some(r=>r.gold.value==='must_read')),
    materialNewDevelopmentRecall:needRecall(rows=>rows.some(r=>r.gold.novelty?.cutoff===run.clock&&r.gold.novelty.status==='new_development')),
    distinctAnalysisRecall:rate([...analyses].filter(id=>selectedIds.has(id)).length,analyses.size),analysisIdentityWithoutSupportedDistinction:positives.filter(r=>r.gold.angleId&&!supportedDistinctAnalysis(r,run.clock)).length,
    representativeQuality:{bestReasonable:rate(best,reps.length),comparablyPreferred:rate(preferredWins,comparablePreferredAvailable),tribuneChosenDespiteComparableCore:tribuneComparableLosses,secondaryWithoutHumanJustification:secondaryUnjustified,pendingComparatorSets:judgments.filter(j=>j.kind==='representative_set'&&j.review.status!=='adjudicated').length,status:reps.length?'conditional_human_sets':'pending_human_representative_judgments'},
    archiveQuality:{entries:archive.length,reviewed:archiveReviewed.length,rejectedOrRedundantEntries:archiveInvalid.length,valid:rate(archiveReviewed.length-archiveInvalid.length,archiveReviewed.length),status:options.editorialOutput&&archiveReviewed.length===archive.length?'conditional_human_archive_judgments':'pending_editorial_replay_and_human_archive_judgments'},
    publisherDistribution:distribution(selected.map(publisher)),sourceConcentration:{tribuneCount:selected.filter(url=>publisher(url)==='The Tribune').length,tribuneLargest: selected.length>0&&publisher(selected[0])!=='Unknown'?distribution(selected.map(publisher)).counts['The Tribune']===Math.max(...Object.values(distribution(selected.map(publisher)).counts)):false,arbitraryDiversityReward:false},
    capacityQuality:{status:complete?'conditional_complete_human_pool':'pending_complete_human_candidate_pool',knownRequiredNeeds:requiredMap.size,unavoidableNeedOverflowLowerBound:complete?Math.max(0,requiredMap.size-50):null,uncappedKnownUtility:complete?sortedGains.reduce((s,n)=>s+n,0):null,utilityCeilingAt50:complete?sortedGains.slice(0,50).reduce((s,n)=>s+n,0):null,capacityUtilityLossLowerBound:complete?sortedGains.slice(50).reduce((s,n)=>s+n,0):null,selectionUtilityGapTo50Ceiling:complete?sortedGains.slice(0,50).reduce((s,n)=>s+n,0)-selectedUtility:null},
    rejectedVisible:selectedKnown.filter(r=>r.gold.value==='reject').length,unjudgedVisible:unjudged,nestedCoverageCredit:false,
  }
}
