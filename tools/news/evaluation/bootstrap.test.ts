/** Synthetic in-memory tooling tests only; no synthetic labels enter the captured natural corpus. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { digest } from './core.ts'
import { EMPTY_LABELS } from './contracts.ts'
import type { Observation, GoldRecord, Labels } from './contracts.ts'
import { observationId, validateCorpus, validateGold } from './validate.ts'
import { NEWS_SOURCES } from '../../../src/current-affairs/sources.ts'
import { PARSER_VERSION, REGISTRY_HASH } from './collect.ts'
import { buildSample, bootstrapCorpus, blindExport, metadataStudy, groupMetadata, RUBRIC_VERSION } from './bootstrap.ts'
import { freezeV2 } from './frozen-v2.ts'
import { applyPrimaryReview } from './bootstrap-review.ts'
import { validatePartitions } from './split.ts'
import { reviewerHtml } from './reviewer-ui.ts'
const CLOCK='2026-10-07T13:00:00.000Z'
function obs(id:string,title='Distinct fixture story '+id,extra:Partial<Observation['metadata']>={}):Observation {
  const s=NEWS_SOURCES.find(s=>s.id==='ie-columns')!
  const metadata={url:'https://indianexpress.com/article/fixture-'+id,title,description:'',publisher:s.publisher,memberships:[{sourceId:s.id,feedUrl:s.feedUrl,section:s.section}],categories:['Columns'],bylines:[],publishedAt:'2026-10-07T10:00:00.000Z',updatedAt:null,...extra}
  const base={captureId:'synthetic-a2a-test',sourceId:s.id,ordinal:0,capturedAt:CLOCK,parserVersion:PARSER_VERSION,registryHash:REGISTRY_HASH,metadataHash:digest(metadata),metadata}
  return {...base,id:observationId(base)}
}
test('representative draw remains separate from targeted coverage, repeated observations never multiply URLs',()=>{
  const rows=Array.from({length:100},(_,i)=>obs(String(i)))
  const copy={...rows[0],captureId:'synthetic-second-capture'};copy.id=observationId(copy)
  const a=buildSample([...rows,copy],'test',100),b=buildSample([copy,...rows].reverse(),'test',100)
  assert.equal(digest(a),digest(b));assert.equal(a.entries.length,100)
  assert.equal(a.entries.filter(e=>e.sampling.panel==='representative').length,58)
  assert.equal(a.entries.filter(e=>e.sampling.panel==='coverage').length,42)
  assert.ok(a.entries.filter(e=>e.sampling.panel==='coverage').every(e=>e.sampling.inclusionProbability===null))
  assert.equal(a.entries.find(e=>e.url===rows[0].metadata.url)!.observationIds.length,2)
})
test('observed requested-author census includes both exact legitimate identities even in sparse metadata',()=>{
  const rows=Array.from({length:100},(_,i)=>obs(String(i)))
  rows.push(obs('mehta','An opaque title',{bylines:[{name:'Pratap Bhanu Mehta',provenance:'rss:dc:creator'}]}),obs('mohan','Another opaque title',{bylines:[{name:'C. Raja Mohan',provenance:'rss:dc:creator'}]}))
  const s=buildSample(rows,'authors',50)
  for(const suffix of ['mehta','mohan'])assert.ok(s.entries.some(e=>e.url.endsWith(suffix)))
})
test('blind export removes sampling rationale, machine decisions and source-author privileges; gold remains empty',()=>{
  const b=bootstrapCorpus([obs('a')],'blind',1),blind=blindExport(b.corpus,b.sampledObservations)
  assert.deepEqual(blind[0].annotation.labels,EMPTY_LABELS)
  assert.deepEqual(b.corpus[0].gold,EMPTY_LABELS)
  const poisoned=structuredClone(b.corpus);Object.assign(poisoned[0],{score:999,expectedAnswer:'useful',curatedAuthor:true})
  const payload=JSON.stringify(blindExport(poisoned,b.sampledObservations))
  for(const key of ['sampling','stratum','coverageTags','inclusionProbability','score','expectedAnswer','curatedAuthor','predictedSubject'])assert.ok(!payload.includes('"'+key+'"'))
  assert.ok(reviewerHtml(blind).includes('Metadata sufficiency'))
})
test('short syndicated titles and related paraphrases cannot cross the split; identifiable themes stay together',()=>{
  const rows=[obs('a','RBI lowers repo rate'),obs('b','RBI lowers repo rate'),obs('c','Reserve bank monetary policy cuts repo rate'),obs('d','GST council revises compensation rules'),obs('e','Changes in GST rates for manufacturers'),obs('f','Quantum particles enable a novel scientific finding')]
  const b=bootstrapCorpus(rows,'split',6)
  validatePartitions(b.partitions.assignments)
  const partition=(id:string)=>b.partitions.assignments.find(r=>r.url.endsWith(id))!.partition
  assert.equal(partition('a'),partition('b'));assert.equal(partition('a'),partition('c'));assert.equal(partition('d'),partition('e'))
  const broken=structuredClone(b.partitions.assignments);broken.find(r=>r.url.endsWith('b'))!.partition=partition('a')==='development'?'validation':'development'
  assert.throws(()=>validatePartitions(broken),/leakage/)
  assert.match(groupMetadata(rows).semanticAudit,/awaiting/)
})
test('single primary-human adjudication is explicit and confined to bootstrap; A1 default requires two',()=>{
  const o=obs('review','Parliament passes constitutional amendment'),r=bootstrapCorpus([o],'review',1).corpus[0]
  const labels:Labels={...structuredClone(EMPTY_LABELS),value:'useful',primarySubject:'Polity',contentType:'news_report',partyPoliticsPrimary:false,partyMention:false,scope:'india_domestic',scopeReason:'Synthetic test only',novelty:{status:'uncertain',relativeTo:[],cutoff:CLOCK},rationale:'Synthetic test only',metadataSufficiency:{level:'sufficient',missingFields:[]},reviewBasis:'feed_metadata'}
  const responses=[{id:r.id,annotation:{reviewerId:'synthetic-human-id',reviewedAt:CLOCK,rubricVersion:RUBRIC_VERSION,disposition:'resolved' as const,labels,evidence:[{observationId:o.id,field:'title' as const,start:0,end:10}]}}]
  const reviewed=applyPrimaryReview([r],[o],responses)
  assert.equal(reviewed[0].review.annotations.length,1)
  validateCorpus(reviewed,[o],'implementation','bootstrap_primary_human')
  assert.throws(()=>validateGold(reviewed[0]),/Schema/)
  assert.throws(()=>validateGold({...reviewed[0],partition:'holdout_unseen'},'custodian','bootstrap_primary_human'),/bootstrap/)
  assert.throws(()=>applyPrimaryReview([r],[o],[{...responses[0],annotation:{...responses[0].annotation,reviewerId:null}}]),/Human identity/)
})
test('unresolvable human response preserves sufficiency without turning unknown value into gold rejection',()=>{
  const o=obs('unclear'),r=bootstrapCorpus([o],'unclear',1).corpus[0]
  const labels={...structuredClone(EMPTY_LABELS),metadataSufficiency:{level:'insufficient' as const,missingFields:['description' as const,'scope' as const]},reviewBasis:'feed_metadata' as const}
  const response={id:r.id,annotation:{reviewerId:'synthetic-human',reviewedAt:CLOCK,rubricVersion:RUBRIC_VERSION,disposition:'unresolvable' as const,labels,evidence:[{observationId:o.id,field:'title' as const,start:0,end:2}]}}
  const reviewed=applyPrimaryReview([r],[o],[response]);assert.deepEqual(reviewed[0].gold,EMPTY_LABELS)
  const report=metadataStudy(reviewed,[o],[{id:r.id,labels}]);assert.equal(report.slices.find(s=>s.slice==='all')!.counts.insufficient,1);assert.equal(report.qualityMetrics,null)
})
test('metadata-sufficiency reports zero assessed denominators as pending, including absent IE descriptions slice',()=>{
  const b=bootstrapCorpus([obs('sparse')],'suff',1),report=metadataStudy(b.corpus,b.sampledObservations)
  assert.equal(report.status,'awaiting_adjudication')
  assert.equal(report.slices.find(s=>s.slice==='all')!.rates.sufficient,null)
  assert.equal(report.slices.find(s=>s.slice==='ie_with_description')!.total,0)
  assert.equal(report.slices.find(s=>s.slice==='ie_without_description')!.availability.missingDescription,1)
})
test('frozen v2 uses explicit clock and identical raw revisions, with repeat/permutation equality and no gold input',()=>{
  const a=obs('v2-a','RBI revises banking regulation'),b=obs('v2-b','Party candidate launches campaign')
  const first=freezeV2([a,b],CLOCK,'test-base'),second=freezeV2([b,a],CLOCK,'test-base')
  assert.equal(digest(first),digest(second));assert.equal(first.traces.length,2)
  assert.equal(first.run.clock,CLOCK);assert.equal(first.qualityMetrics,null)
  assert.throws(()=>freezeV2([a],'2026-10-07T12:00:00.000Z','test'),/Future/)
})
