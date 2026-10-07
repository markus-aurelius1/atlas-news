/** Candidate sequences, not human equivalence/novelty truth. Preserve actual capture clocks. */
import type { GoldRecord, Observation } from './contracts.ts'
import { digest } from './core.ts'
import { groupMetadata, articleFrame, coverageTags } from './bootstrap.ts'
import { EMPTY_EDITORIAL_LABELS } from './editorial-judgments.ts'
import type { EditorialJudgment, EditorialLabels } from './editorial-judgments.ts'
export function temporalPackage(corpus:GoldRecord[],observations:Observation[],clock:string) {
  const grouping=groupMetadata(observations),frame=articleFrame(observations),byUrl=new Map(frame.map(a=>[a.url,a])),byGold=new Map(corpus.map(r=>[r.metadata.url,r]))
  const keys=['syndicationIds','nearDuplicateIds','developmentIds'] as const,parent=new Map(corpus.map(r=>[r.metadata.url,r.metadata.url])),find=(s:string):string=>parent.get(s)===s?s:find(parent.get(s)!)
  const owners=new Map<string,string[]>()
  for(const row of grouping.identities)for(const kind of keys)for(const key of row[kind])owners.set(kind+':'+key,[...owners.get(kind+':'+key)??[],row.url])
  for(const urls of owners.values())for(const url of urls.slice(1))parent.set(find(url),find(urls[0]))
  const groups=new Map<string,string[]>();for(const url of parent.keys())groups.set(find(url),[...groups.get(find(url))??[],url])
  const equivalentCandidates=[...groups.values()].filter(urls=>urls.length>1).map(urls=>({candidateId:'family-candidate:'+digest(urls.sort()),articleIds:urls.map(url=>byGold.get(url)!.id),urls,humanRelation:null,humanDevelopmentId:null,basis:'lexical/exact-title/conservative-headline constraints only; may group related but distinct developments'}))
  const themeOwners=new Map<string,string[]>()
  for(const row of grouping.identities)for(const key of row.themeIds)themeOwners.set(key,[...themeOwners.get(key)??[],row.url])
  const sequences=[...themeOwners].sort(([a],[b])=>a.localeCompare(b,'en')).map(([key,urls])=>{
    const rows=urls.map(url=>byGold.get(url)!).sort((a,b)=>(a.metadata.publishedAt??'').localeCompare(b.metadata.publishedAt??'','en')||a.id.localeCompare(b.id,'en'))
    const publicationDays=[...new Set(rows.flatMap(r=>r.metadata.publishedAt?[r.metadata.publishedAt.slice(0,10)]:[]))].sort(),captureDays=[...new Set(urls.flatMap(url=>byUrl.get(url)!.rows.map(o=>o.capturedAt.slice(0,10))))].sort()
    return {candidateId:'sequence-candidate:'+digest(key),constraint:key,articleIds:rows.map(r=>r.id),publicationDays,captureDays,kind:captureDays.length>1?'actual_multiday_capture_candidate':'retrospective_publication_backfill_candidate',observations:rows.map(r=>({articleId:r.id,url:r.metadata.url,publishedAt:r.metadata.publishedAt,actualObservations:byUrl.get(r.metadata.url)!.rows.map(o=>({id:o.id,capturedAt:o.capturedAt,metadataHash:o.metadataHash}))})),humanThemeId:null,humanRelations:null}
  }).filter(s=>s.articleIds.length>=2)
  const analytical=corpus.filter(r=>{const tags=coverageTags(byUrl.get(r.metadata.url)!);return tags.some(t=>['ie_opinion','th_opinion','ie_explained'].includes(t))})
  const templates:EditorialJudgment[]=[]
  const add=(kind:EditorialJudgment['kind'],urls:string[],partition:EditorialJudgment['partition'])=>{
    const ids=urls.flatMap(url=>byUrl.get(url)!.rows.filter(o=>o.capturedAt<=clock&&[o.metadata.publishedAt,o.metadata.updatedAt].every(t=>!t||t<=clock)).map(o=>o.id))
    templates.push({version:'tars-editorial-judgment/v1',id:'editorial-review:'+digest([kind,urls,clock]),kind,partition,clock,articleUrls:urls,observationIds:[...new Set(ids)].sort(),historyObservationIds:[],review:{status:'unreviewed',annotations:[],adjudicatorId:null},gold:structuredClone(EMPTY_EDITORIAL_LABELS) as EditorialLabels})
  }
  for(const group of equivalentCandidates) add('representative_set',group.urls,byGold.get(group.urls[0])!.partition as 'development'|'validation')
  for(const r of corpus){add('reading_need',[r.metadata.url],r.partition as 'development'|'validation');add('archive_entry',[r.metadata.url],r.partition as 'development'|'validation')}
  // Actual older observations can be prior evidence at the final cutoff. Publication-only earlier dates are not history.
  for(const s of sequences) {
    const urls=s.observations.map(o=>o.url);add('temporal_transition',urls,byGold.get(urls[0])!.partition as 'development'|'validation')
    const last=templates.at(-1)!,all=last.observationIds,latest=Math.max(...all.map(id=>Date.parse(observations.find(o=>o.id===id)!.capturedAt)))
    last.historyObservationIds=all.filter(id=>Date.parse(observations.find(o=>o.id===id)!.capturedAt)<latest)
    last.observationIds=all.filter(id=>!last.historyObservationIds.includes(id))
    // Keep one available actual observation per candidate URL in the current side, even when there is no later revision.
    for(const url of urls)if(!last.observationIds.some(id=>observations.find(o=>o.id===id)!.metadata.url===url)) {const id=all.filter(id=>observations.find(o=>o.id===id)!.metadata.url===url).at(-1)!;last.observationIds.push(id);last.historyObservationIds=last.historyObservationIds.filter(other=>other!==id)}
  }
  const captureDays=[...new Set(observations.map(o=>o.capturedAt.slice(0,10)))].sort()
  return {version:'tars-temporal-candidates/v1',clock,captureDays,actualMultiDayCaptureSequences:sequences.filter(s=>s.captureDays.length>1).length,retrospectiveMultiPublicationDayThemeCandidates:sequences.filter(s=>s.publicationDays.length>1).length,candidateEquivalentGroups:equivalentCandidates.length,articlesInCandidateEquivalentGroups:new Set(equivalentCandidates.flatMap(g=>g.articleIds)).size,humanConfirmedEquivalentDevelopmentArticles:null,potentialDistinctAnalysisArticles:analytical.length,humanConfirmedDistinctAnalysis:null,equivalentCandidates,sequences,analyticalArticleIds:analytical.map(r=>r.id),judgmentTemplates:templates,semanticSufficiency:{equivalentRepeat:null,materialNewDevelopment:null,distinctAnalysis:null,status:'awaiting_human_judgments; field availability alone cannot establish a fundamental semantic limit'},limits:'One-day observations plus multi-publication-day backfill are not multi-day runtime memory evidence. No backdated captures or automatic human-equivalence/novelty labels. Extend prospectively in a later authorized capture window before temporal quality claims.'}
}
