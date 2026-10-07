/** A2a corpus construction only. None of these neutral sampling/grouping predicates are runtime classifiers. */
import type { Observation, GoldRecord, LeakageIdentity, Sampling } from './contracts.ts'
import { EMPTY_LABELS } from './contracts.ts'
import { digest, ordered, requireThat } from './core.ts'
import { splitBootstrap, leakageIdentities, validatePartitionManifest } from './split.ts'
import { validateCorpus } from './validate.ts'
import { curatedAuthorEvidence } from '../../../src/current-affairs/validator-v3/author-registry.ts'
import { observationItem } from './source-audit.ts'
export const BOOTSTRAP_SEED = 'tars-upsc-a2a-2026-10-07/1'
export const SPLIT_SEED = 'tars-upsc-a2a-split/1'
export const RUBRIC_VERSION = 'tars-upsc-rubric/v1+a2a-primary-human/2'
const distinct = (a: string[]) => [...new Set(a)].sort()
const words = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []
const stop = new Set('the a an of to in on at for and or with by from as is are was were has have had this that it its into over after before amid says said say new india indian what why how can will more than not who their about against explained opinion today live latest news upsc key essentials'.split(' '))
const significant = (s: string) => distinct(words(s).filter(w => w.length >= 3 && !stop.has(w) && !/^\d+$/.test(w)))
export function articleFrame(observations: Observation[]) {
  const byUrl = new Map<string, Observation[]>()
  for (const o of ordered(observations)) byUrl.set(o.metadata.url, [...byUrl.get(o.metadata.url) ?? [], o])
  return [...byUrl].sort(([a],[b])=>a.localeCompare(b,'en')).map(([url,rows])=>({url,rows,selected:[...rows].sort((a,b)=>b.capturedAt.localeCompare(a.capturedAt,'en') || a.id.localeCompare(b.id,'en'))[0]}))
}
export type FrameArticle = ReturnType<typeof articleFrame>[number]
const text = (a: FrameArticle) => distinct(a.rows.map(o=>[o.metadata.title,o.metadata.description,...o.metadata.categories].join(' '))).join(' ').toLowerCase()
const hasSource = (a: FrameArticle, re: RegExp) => a.rows.some(o=>re.test(o.sourceId))
const hasSection = (a: FrameArticle, re: RegExp) => a.rows.some(o=>o.metadata.memberships.some(m=>re.test(m.section)))
export const COVERAGE_RULES = [
  'requested_authors','ie_upsc','ie_explained','ie_opinion','th_opinion','science','environment','security_terms','ir_terms','economy','missing_description','single_source','party_terms','foreign_domestic_terms','institution_terms','recurring_metadata',
] as const
export function coverageTags(a: FrameArticle, recurring = new Set<string>()): string[] {
  const t=text(a)
  return [
    a.rows.some(o=>curatedAuthorEvidence(observationItem(o.metadata)).length>0) && 'requested_authors',
    hasSource(a,/^ie-upsc/) && 'ie_upsc', hasSource(a,/^ie-explained/) && 'ie_explained',
    hasSource(a,/^ie-(columns|editorial)$/) && 'ie_opinion', hasSource(a,/^hindu-(opinion|columns|op-ed|lead|editorial)$/) && 'th_opinion',
    (hasSection(a,/science|sci-tech/i) || /\b(nasa|isro|quantum|scientific|space mission)\b/.test(t)) && 'science',
    (hasSection(a,/environment|climate/i) || /\b(climate|biodiversity|emissions|conservation)\b/.test(t)) && 'environment',
    /\b(defence|defense|military|security|terror|cyber|missile|navy|army|border)\b/.test(t) && 'security_terms',
    /\b(diplomacy|diplomatic|treaty|geopolitic\w*|iran|israel|ukraine|russia|nato|united nations|bilateral)\b/.test(t) && 'ir_terms',
    (hasSection(a,/econom/i) || /\b(inflation|gdp|rbi|fiscal|monetary|trade|tariff)\b/.test(t)) && 'economy',
    !a.selected.metadata.description && 'missing_description', distinct(a.rows.map(o=>o.sourceId)).length===1 && 'single_source',
    /\b(bjp|congress|candidate|campaign|alliance|party|election|polls)\b/.test(t) && 'party_terms',
    /\b(trump|us congress|white house|american|uk election|british|chinese|french|german|japan)\b/.test(t) && 'foreign_domestic_terms',
    /\b(court|constitution\w*|judicial|parliament|commission|governance|federal|law|reform)\b/.test(t) && 'institution_terms',
    recurring.has(a.url) && 'recurring_metadata',
  ].filter((v):v is string=>typeof v==='string')
}
// Explicit recurring phrases only create conservative partition constraints, never factual event/novelty labels.
export const THEME_PATTERNS = [
  ['sir_electoral_rolls',/\b(sir|special intensive revision|electoral rolls?)\b/i],
  ['gst',/\b(gst|goods and services tax)\b/i], ['russia_ukraine',/\b(ukraine|ukrainian|russia|russian)\b/i],
  ['middle_east_conflict',/\b(iran|iranian|israel|israeli|gaza|hamas|hezbollah|hormuz)\b/i],
  ['us_tariffs',/\b(tariffs?|trade war)\b/i], ['climate_change',/\b(climate change|global warming|cop30|cop31)\b/i],
  ['electoral_politics',/\b(election|elections|campaign|candidate|polls)\b/i], ['judicial_independence',/\b(judicial independence|judicial reform|judiciary)\b/i],
  ['india_china',/\b(china|chinese)\b/i], ['central_banking',/\b(rbi|reserve bank|monetary policy|repo rate)\b/i],
] as const
export function recurringUrls(frame: FrameArticle[]): Set<string> {
  const result=new Set<string>()
  for(const [,re] of THEME_PATTERNS) { const rows=frame.filter(a=>re.test(text(a))); if(rows.length>=2)rows.forEach(a=>result.add(a.url)) }
  return result
}
export function buildSample(observations: Observation[], namespace: string, target=1000) {
  const frame=articleFrame(observations), size=Math.min(target,frame.length), representativeSize=Math.round(size*0.58)
  const window={start:observations.map(o=>o.capturedAt).sort()[0],end:observations.map(o=>o.capturedAt).sort().at(-1)!}
  requireThat(size>0,'No raw supply')
  const cells=new Map<string,FrameArticle[]>()
  for(const a of frame) {
    const cell=[a.selected.metadata.publisher,a.selected.sourceId,a.rows.map(o=>o.capturedAt.slice(0,10)).sort()[0]].join('|')
    cells.set(cell,[...cells.get(cell)??[],a])
  }
  const allocation=[...cells].sort(([a],[b])=>a.localeCompare(b,'en')).map(([id,rows])=>({id,rows,take:Math.floor(representativeSize*rows.length/frame.length),remainder:representativeSize*rows.length/frame.length%1}))
  let extra=representativeSize-allocation.reduce((s,c)=>s+c.take,0)
  for(const c of [...allocation].sort((a,b)=>b.remainder-a.remainder || a.id.localeCompare(b.id,'en')))if(extra-->0)c.take++
  const selected: {article:FrameArticle;panel:Sampling['panel'];stratum:string;probability:number|null;denominator:number}[]=[]
  const used=new Set<string>()
  for(const cell of allocation)for(const a of [...cell.rows].sort((a,b)=>digest([BOOTSTRAP_SEED,cell.id,a.url]).localeCompare(digest([BOOTSTRAP_SEED,cell.id,b.url]),'en')).slice(0,cell.take)) {
    selected.push({article:a,panel:'representative',stratum:cell.id,probability:cell.take/cell.rows.length,denominator:cell.rows.length});used.add(a.url)
  }
  const recurring=recurringUrls(frame), tags=new Map(frame.map(a=>[a.url,coverageTags(a,recurring)]))
  const queues=COVERAGE_RULES.map(rule=>({rule,rows:frame.filter(a=>!used.has(a.url)&&tags.get(a.url)!.includes(rule)).sort((a,b)=>digest([BOOTSTRAP_SEED,rule,a.url]).localeCompare(digest([BOOTSTRAP_SEED,rule,b.url]),'en'))}))
  const add=(a:FrameArticle,rule:string,denominator:number)=>{selected.push({article:a,panel:'coverage',stratum:rule,probability:null,denominator});used.add(a.url)}
  // Census of observed requested-author URLs, irrespective of any machine acceptance.
  for(const a of queues[0].rows)if(selected.length<size)add(a,queues[0].rule,queues[0].rows.length)
  while(selected.length<size) {
    let added=0
    for(const q of queues.slice(1)) { const a=q.rows.find(a=>!used.has(a.url));if(a&&selected.length<size){add(a,q.rule,q.rows.length);added++} }
    if(!added)break
  }
  for(const a of frame.filter(a=>!used.has(a.url)).sort((a,b)=>digest([BOOTSTRAP_SEED,'fallback',a.url]).localeCompare(digest([BOOTSTRAP_SEED,'fallback',b.url]),'en')))if(selected.length<size)add(a,'coverage_supply_fallback',frame.length-representativeSize)
  const entries=selected.map(s=>({id:'article:'+digest([namespace,s.article.url]),url:s.article.url,observationIds:s.article.rows.map(o=>o.id).sort(),metadataObservationId:s.article.selected.id,
    coverageTags:tags.get(s.article.url)!,sampling:{panel:s.panel,stratum:s.stratum,seed:BOOTSTRAP_SEED,inclusionProbability:s.probability,populationDenominator:s.denominator,window,manifestHash:'0'.repeat(64),synthetic:false} satisfies Sampling})).sort((a,b)=>a.id.localeCompare(b.id,'en'))
  const payload={version:'tars-bootstrap-sample/v1',namespace,seed:BOOTSTRAP_SEED,target,actual:entries.length,observationsHash:digest(ordered(observations)),window,representativeCells:allocation.map(c=>({id:c.id,population:c.rows.length,selected:c.take,probability:c.take/c.rows.length})),coveragePools:queues.map(q=>({rule:q.rule,populationAfterRepresentative:q.rows.length,assigned:entries.filter(e=>e.sampling.panel==='coverage'&&e.sampling.stratum===q.rule).length})),entries,selectionPolicy:'Representative probability draw on full disjoint frame first; requested-author census then overlapping neutral coverage queues in deterministic rotation. Coverage probabilities unavailable. No validator scores/labels.'}
  const hash=digest(payload);entries.forEach(e=>e.sampling.manifestHash=hash)
  return {...payload,hash}
}
export function groupMetadata(observations: Observation[]) {
  const revisions=[...new Map(observations.map(o=>[o.metadata.url+'|'+o.metadataHash,o])).values()]
  const hints=leakageIdentities(revisions),frame=articleFrame(observations)
  const rows=hints.identities.map(r=>({...r,firstObservedAt:frame.find(a=>a.url===r.url)!.rows.map(o=>o.capturedAt).sort()[0],lastObservedAt:frame.find(a=>a.url===r.url)!.rows.map(o=>o.capturedAt).sort().at(-1)!}))
  const lookup=new Map(rows.map(r=>[r.url,r])), edges:{left:string;right:string;kind:string;key:string}[]=[]
  const signatures=new Map<string,string[]>(),titleTokens=new Map<string,string[]>()
  for(const a of frame) {
    for(const o of a.rows) { const signature=words(o.metadata.title).join(' '); if(signature)signatures.set(signature,distinct([...signatures.get(signature)??[],a.url])) }
    titleTokens.set(a.url,distinct(a.rows.flatMap(o=>significant(o.metadata.title))))
    for(const [name,re] of THEME_PATTERNS)if(re.test(text(a)))lookup.get(a.url)!.themeIds.push('constraint:theme:'+name)
  }
  for(const [title,urls] of signatures)if(urls.length>1)for(const url of urls)lookup.get(url)!.syndicationIds.push('constraint:title:'+digest(title))
  const candidates=new Map<string,Set<string>>()
  for(const [url,tokens] of titleTokens)for(let i=0;i<tokens.length;i++)for(const token of tokens.slice(i+1)) {
    const key=tokens[i]+'|'+token;candidates.set(key,new Set([...candidates.get(key)??[],url]))
  }
  const pairs=new Set<string>()
  for(const urls of candidates.values())if(urls.size<=100) {const list=[...urls].sort();for(let i=0;i<list.length;i++)for(const right of list.slice(i+1))pairs.add(list[i]+'\n'+right)}
  for(const pair of [...pairs].sort()) {
    const [left,right]=pair.split('\n'),a=titleTokens.get(left)!,b=titleTokens.get(right)!,common=a.filter(t=>b.includes(t))
    // Broad grouping constraints absorb close paraphrases and recurring developments. They do not assert equivalence.
    if(common.length<3 || common.length/Math.min(a.length,b.length)<0.6)continue
    const key='constraint:overlap:'+digest([left,right]);lookup.get(left)!.developmentIds.push(key);lookup.get(right)!.developmentIds.push(key)
    edges.push({left,right,kind:'conservative_headline_overlap',key})
  }
  rows.forEach(r=>{r.syndicationIds=distinct(r.syndicationIds);r.themeIds=distinct(r.themeIds);r.developmentIds=distinct(r.developmentIds)})
  return {identities:rows satisfies LeakageIdentity[],lexicalHints:hints,edges,method:'A1 trigram >=0.8; normalized exact titles including short titles; conservative >=3 significant headline tokens with overlap/min >=0.6; explicit running-theme constraints across capture dates',semanticAudit:'awaiting_primary_human_family_audit; lexical constraints cannot certify semantic separation'}
}
export function bootstrapCorpus(observations:Observation[],namespace:string,target=1000) {
  const sampling=buildSample(observations,namespace,target),ids=new Set(sampling.entries.flatMap(e=>e.observationIds)),sampledObservations=ordered(observations.filter(o=>ids.has(o.id)))
  const grouping=groupMetadata(sampledObservations),partitions=splitBootstrap(grouping.identities,SPLIT_SEED)
  validatePartitionManifest(partitions)
  const lookup=new Map(observations.map(o=>[o.id,o])), assignments=new Map(partitions.assignments.map(a=>[a.url,a.partition]))
  const corpus:GoldRecord[]=sampling.entries.map(e=>({version:'tars-news-gold/v1',id:e.id,observationIds:e.observationIds,metadata:structuredClone(lookup.get(e.metadataObservationId)!.metadata),sampling:e.sampling,partition:assignments.get(e.url)!,review:{status:'unreviewed',annotations:[],adjudication:null},gold:structuredClone(EMPTY_LABELS)}))
  validateCorpus(corpus,sampledObservations)
  return {sampling,sampledObservations,grouping,partitions,corpus}
}
export function blindExport(corpus: GoldRecord[],observations:Observation[]) {
  const lookup=new Map(observations.map(o=>[o.id,o]))
  return corpus.map(r=>({id:r.id,partition:r.partition,metadata:structuredClone(r.metadata),observedFeeds:distinct(r.observationIds.flatMap(id=>lookup.get(id)!.metadata.memberships.map(m=>JSON.stringify(m)))).map(s=>JSON.parse(s)),
    metadataObservationId:r.observationIds.filter(id=>digest(lookup.get(id)!.metadata)===digest(r.metadata)).sort((a,b)=>lookup.get(b)!.capturedAt.localeCompare(lookup.get(a)!.capturedAt,'en')||a.localeCompare(b,'en'))[0],
    observations:r.observationIds.map(id=>{const o=lookup.get(id)!;return {id,capturedAt:o.capturedAt,metadataHash:o.metadataHash}}),
    revisions:[...new Map(r.observationIds.map(id=>{const o=lookup.get(id)!;return [o.metadataHash,{metadata:o.metadata,observationIds:r.observationIds.filter(other=>lookup.get(other)!.metadataHash===o.metadataHash)}]})).values()],
    annotation:{reviewerId:null,reviewedAt:null,rubricVersion:RUBRIC_VERSION,disposition:null,labels:structuredClone(EMPTY_LABELS),evidence:[]}}))
}
export function metadataStudy(corpus:GoldRecord[],observations:Observation[],responses:{id:string;labels:GoldRecord['gold']}[]=[]) {
  const frame=articleFrame(observations),byUrl=new Map(frame.map(a=>[a.url,a])),byId=new Map(responses.map(r=>[r.id,r]))
  requireThat(new Set(responses.map(r=>r.id)).size===responses.length,'Duplicate sufficiency response')
  requireThat(responses.every(r=>corpus.some(c=>c.id===r.id)),'Unobserved response')
  const slice=(r:GoldRecord):string[]=>{
    const a=byUrl.get(r.metadata.url)!,tags=coverageTags(a),m=r.metadata
    return ['all',r.sampling.panel,r.partition, m.publisher==='Indian Express'?(m.description?'ie_with_description':'ie_without_description'):null,m.publisher==='The Hindu'?(m.description?'th_with_description':'th_without_description'):null,
      tags.includes('ie_opinion')||tags.includes('th_opinion')?'editorials_columns_proxy':null,tags.includes('ie_explained')?'explainers_proxy':null,tags.includes('science')?'science_proxy':null,tags.includes('security_terms')?'security_terms_proxy':null,tags.includes('requested_authors')?'requested_authors':null,
      !tags.some(t=>['ie_opinion','th_opinion','ie_explained','ie_upsc'].includes(t))?'ordinary_news_proxy':null,
      ...a.rows.flatMap(o=>curatedAuthorEvidence(observationItem(o.metadata)).map(a=>a.authorId)),
      ...(['editorial','column','explainer'].includes(byId.get(r.id)?.labels.contentType??'')?['human_content_type:'+byId.get(r.id)!.labels.contentType]:[]),
      byId.get(r.id)?.labels.primarySubject==='Sci-Tech'?'human_science':null,byId.get(r.id)?.labels.primarySubject==='Security'?'human_security':null,
    ].filter((s):s is string=>!!s)
  }
  for(const response of responses) {
    const suff=response.labels.metadataSufficiency
    if(!suff)continue
    requireThat(['sufficient','limited','insufficient'].includes(suff.level),'Unknown sufficiency level')
    requireThat(suff.missingFields.every(f=>['title','description','bylines','categories','publication_time','scope','development','angle'].includes(f)), 'Unknown missing metadata field')
    requireThat(suff.level==='sufficient'?suff.missingFields.length===0:suff.missingFields.length>0,'Sufficiency needs consistent missing-field reasons')
  }
  const names=distinct(['ie_with_description','ie_without_description','th_with_description','th_without_description','editorials_columns_proxy','explainers_proxy','science_proxy','security_terms_proxy','requested_authors','ordinary_news_proxy','human_science','human_security','human_content_type:editorial','human_content_type:column','human_content_type:explainer',...corpus.flatMap(slice)])
  return {version:'tars-metadata-sufficiency/v1',status:responses.length?'human_review_in_progress':'awaiting_adjudication',qualityMetrics:null,note:'Presence and neutral source/text proxies are not semantic sufficiency or human subject/content-type gold. Rates remain null without reviewed denominator; missing-field rates among assessed rows only.',slices:names.map(name=>{
    const rows=corpus.filter(r=>slice(r).includes(name)),assessed=rows.flatMap(r=>byId.get(r.id)?.labels.metadataSufficiency??[]),counts={sufficient:0,limited:0,insufficient:0},missing:Record<string,number>={}
    assessed.forEach(a=>{counts[a.level]++;a.missingFields.forEach(f=>missing[f]=(missing[f]??0)+1)})
    return {slice:name,total:rows.length,assessed:assessed.length,pending:rows.length-assessed.length,counts,rates:Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,assessed.length?v/assessed.length:null])),missingFields:missing,
      availability:{missingDescription:rows.filter(r=>!r.metadata.description).length,missingByline:rows.filter(r=>!r.metadata.bylines.length).length,missingCategories:rows.filter(r=>!r.metadata.categories.length).length}}
  })}
}
