/** Entirely synthetic in-memory contract examples; no captured or final corpus is created. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Ajv } from 'ajv'
import { NEWS_SOURCES } from '../../../src/current-affairs/sources.ts'
import { feedShards } from '../../../src/current-affairs/shards.ts'
import { collectShard, parseMetadata, REGISTRY_HASH, PARSER_VERSION } from './collect.ts'
import { digest, stableJson } from './core.ts'
import type { GoldRecord, Labels, LeakageIdentity, Observation, Prediction, ReplayVersions } from './contracts.ts'
import { EMPTY_LABELS } from './contracts.ts'
import { validateGold, validateCorpus, validateObservation, validateRaw, observationId } from './validate.ts'
import { sample, annotationExport, validateSamplingManifest } from './sample.ts'
import { splitBootstrap, validatePartitions, partitionManifest, validatePartitionManifest, leakageIdentities } from './split.ts'
import { replay, replaySequence, benchmarkReplay } from './replay.ts'
import { evaluate } from './evaluate.ts'
import { binary, rate, clustering, pairMetric, ndcg, groupedBootstrap, anchorPreference, agreement, distribution, diversityRegret } from './metrics.ts'
import { validateJudgment, evaluateEventPairs, evaluateSequence } from './judgments.ts'
import type { PairJudgment, SequenceJudgment } from './judgments.ts'
import { renderReport, writeArtifact } from './report.ts'

const CLOCK = '2026-10-07T12:00:00.000Z', CAPTURE = '2026-10-07T10:00:00.000Z'
const WINDOW = { start: '2026-10-07T00:00:00.000Z', end: CLOCK }
const versions: ReplayVersions = { policyId: 'synthetic-policy', policyHash: digest('policy'), indexHash: digest('index'), registryHash: REGISTRY_HASH, codeHash: digest('test-runner') }
function observation(id: string, changes: Partial<Observation['metadata']> = {}, capturedAt = CAPTURE): Observation {
  const source = NEWS_SOURCES[0]
  const metadata: Observation['metadata'] = { url: `https://example.test/${id}`, title: `Synthetic contract item ${id}`, description: 'Synthetic bounded description for unit testing.', publisher: source.publisher, memberships: [{ sourceId: source.id, feedUrl: source.feedUrl, section: source.section }], categories: [], bylines: [], publishedAt: null, updatedAt: null, ...changes }
  const base = { captureId: 'synthetic-test', sourceId: source.id, ordinal: 0, capturedAt, parserVersion: PARSER_VERSION, registryHash: REGISTRY_HASH, metadataHash: digest(metadata), metadata }
  return { ...base, id: observationId(base) }
}
function gold(o: Observation, value: Labels['value'] = 'useful', changes: Partial<Labels> = {}): GoldRecord {
  const labels: Labels = { ...structuredClone(EMPTY_LABELS), value, primarySubject: value === 'reject' ? 'not_applicable' : 'Economy', contentType: 'news_report', partyPoliticsPrimary: false, partyMention: false, scope: 'india_domestic', scopeReason: 'Synthetic domestic-policy premise.', storyId: 'story:' + o.metadata.url, themeId: null, angleId: null, novelty: { status: 'uncertain', relativeTo: [], cutoff: CLOCK }, rejectReasons: value === 'reject' ? ['no_substantive_value'] : [], rationale: 'Synthetic rubric application, never real gold.', metadataSufficiency: { level: 'sufficient', missingFields: [] }, reviewBasis: 'feed_metadata', ...changes }
  return { version: 'tars-news-gold/v1', id: 'synthetic:' + digest(o.metadata.url), observationIds: [o.id], metadata: o.metadata,
    // These unit cases emulate natural panel arithmetic; no dataset file is exported.
    sampling: { panel: 'representative', stratum: 'synthetic-arithmetic', seed: 'test', inclusionProbability: 1, populationDenominator: 4, window: WINDOW, manifestHash: digest('synthetic'), synthetic: false },
    review: { status: 'adjudicated', annotations: ['reviewer-a','reviewer-b'].map(reviewerId => ({ reviewerId, reviewedAt: CLOCK, rubricVersion: 'tars-upsc-rubric/v1', labels: structuredClone(labels), evidence: [{ observationId: o.id, field: 'title', start: 0, end: 1 }] })), adjudication: { adjudicatorId: 'adjudicator', reviewedAt: CLOCK, rationale: 'Synthetic consensus.', resolutionVersion: 'v1', labels: structuredClone(labels) } }, gold: labels, partition: 'development' }
}
function prediction(o: Observation, decision: Prediction['decision'] = 'accepted', primarySubject: Prediction['primarySubject'] = 'Economy'): Prediction {
  return { url: o.metadata.url, decision, primarySubject, eventId: 'event:' + o.metadata.url, themeId: null, angleId: null, novelty: 'uncertain' }
}
function identity(o: Observation, changes: Partial<LeakageIdentity> = {}): LeakageIdentity {
  return { url: o.metadata.url, aliases: [], syndicationIds: [], nearDuplicateIds: [], developmentIds: [], themeIds: [], angleIds: [], firstObservedAt: o.capturedAt, lastObservedAt: o.capturedAt, ...changes }
}
function report(observations: Observation[], records: GoldRecord[], predictions: Prediction[], units: { id: string; primaryUrl: string; memberUrls: string[] }[] = []) {
  const run = replay({ observations, history: [], clock: CLOCK, versions }, () => ({ articles: predictions, units }))
  const manifest = partitionManifest(records.map(r => ({ ...identity(observations.find(o => o.metadata.url === r.metadata.url)!), developmentIds: r.gold.storyId ? [r.gold.storyId] : [], themeIds: r.gold.themeId ? [r.gold.themeId] : [], angleIds: r.gold.angleId ? [r.gold.angleId] : [], partition: r.partition })), 'test', null)
  return evaluate(records, run, { observations, history: [], partition: 'development', partitions: manifest, bootstrapSeed: 'fixed' })
}

test('schemas are standalone draft-07 JSON Schema with closed metadata/raw contracts', () => {
  const schema = JSON.parse(readFileSync(new URL('./schema.json', import.meta.url), 'utf8'))
  const ajv = new Ajv({ strict: false, validateFormats: false }); ajv.addSchema(schema)
  assert.ok(ajv.compile(JSON.parse(readFileSync(new URL('./raw-schema.json', import.meta.url), 'utf8'))))
  assert.equal(schema.additionalProperties, false)
})
test('valid gold and referenced metadata survive; missing provenance and contradictory truth fail', () => {
  const o = observation('valid'), r = gold(o)
  validateCorpus([r], [o])
  assert.throws(() => validateGold({ ...r, observationIds: [] }))
  assert.throws(() => validateGold(gold(o, 'useful', { partyPoliticsPrimary: true })))
  assert.throws(() => validateGold(gold(o, 'useful', { scope: 'foreign_domestic_no_impact' })))
  assert.throws(() => validateGold(gold(o, 'reject', { rejectReasons: [] })))
  const bad = structuredClone(r); bad.review.adjudication!.labels.value = 'must_read'
  assert.throws(() => validateGold(bad), /disagree/)
})
test('global_systemic supported without India literal and ordinary foreign-domestic remains reject', () => {
  const o = observation('global'), r = gold(o, 'must_read', { primarySubject: 'International relations', scope: 'global_systemic', scopeReason: 'Synthetic systemic international governance mechanism.' })
  validateGold(r)
  validateGold(gold(o, 'reject', { scope: 'foreign_domestic_no_impact', rejectReasons: ['foreign_domestic_no_impact'] }))
})
test('independent reviewers, resolved adjudication, sufficiency and bounded spans enforced', () => {
  const o = observation('review'), r = gold(o)
  r.review.annotations[1].reviewerId = r.review.annotations[0].reviewerId
  r.review.annotations[1].reviewedAt = '2026-10-07T11:00:00.000Z'
  assert.throws(() => validateGold(r), /reviewer/)
  assert.throws(() => validateGold({ ...gold(o), review: { ...gold(o).review, adjudication: null } }))
  assert.throws(() => validateGold(gold(o, 'useful', { metadataSufficiency: { level: 'sufficient', missingFields: ['description'] } })))
  const beyond = gold(o); beyond.review.annotations[0].evidence[0].end = 9000
  assert.throws(() => validateCorpus([beyond], [o]), /beyond/)
})
test('article-body, predictions, cookies and credentials fields cannot enter raw/gold fixtures at any level', () => {
  const o = observation('unsafe'), r = gold(o)
  for (const field of ['articleBody','body','content:encoded','html','cookie','credentials','validatorScore','prediction']) {
    assert.throws(() => validateGold({ ...r, [field]: 'forbidden' }))
    assert.throws(() => validateGold({ ...r, metadata: { ...r.metadata, [field]: 'forbidden' } }))
    assert.throws(() => validateObservation({ ...o, metadata: { ...o.metadata, [field]: 'forbidden' } }))
  }
})
test('unreviewed, disputed and unresolvable truth never become negatives', () => {
  const a = observation('unknown'), b = observation('resolved')
  const unreviewed: GoldRecord = { ...gold(a), gold: structuredClone(EMPTY_LABELS), review: { status: 'unreviewed', annotations: [], adjudication: null } }
  for (const status of ['unreviewed','in_review','disputed','unresolvable'] as const) {
    const annotations=status==='unreviewed'?[]:gold(a).review.annotations.slice(0,status==='in_review'?1:2).map(annotation=>({...annotation,labels:{...structuredClone(EMPTY_LABELS),metadataSufficiency:{level:'insufficient' as const,missingFields:['description' as const]}}}))
    const r = { ...unreviewed, review: { ...unreviewed.review, status,annotations } }
    const result = report([a,b], [r,gold(b)], [prediction(a),prediction(b)])
    assert.equal(result.acceptance.naturalUnweightedDiagnostic.tp, 1)
    assert.equal(result.acceptance.naturalUnweightedDiagnostic.fp, 0)
    assert.equal(result.acceptance.naturalUnweightedDiagnostic.tn, 0)
    assert.equal(result.review.excludedUnresolved, 1)
  }
  assert.throws(() => validateGold({ ...unreviewed, gold: { ...EMPTY_LABELS, value: 'reject' } }))
})
test('deferred positive is a miss; metadata insufficiency remains independently measurable', () => {
  const o = observation('deferred'), r = gold(o, 'must_read', { metadataSufficiency: { level: 'limited', missingFields: ['description'] } })
  const result = report([o], [r], [prediction(o,'deferred')])
  assert.equal(result.acceptance.naturalUnweightedDiagnostic.fn, 1)
  assert.equal(result.acceptance.mustRead.recall.value, 0)
  assert.equal(result.acceptance.deferredPositiveMisses, 1)
  assert.equal(result.metadata.sufficiency.limited.positive, 1)
})
test('hand-computable precision recall F1, representative weights and protected slices', () => {
  const observations = ['a','b','c','d'].map(id => observation(id))
  const records = [gold(observations[0],'must_read',{ contentType:'column', primarySubject:'Security' }),gold(observations[1],'useful',{ contentType:'explainer', primarySubject:'Sci-Tech' }),gold(observations[2]),gold(observations[3],'reject',{partyPoliticsPrimary:true,rejectReasons:['party_primary']})]
  const result = report(observations, records, [prediction(observations[0]),prediction(observations[1],'deferred'),prediction(observations[2]),prediction(observations[3])])
  const m = result.acceptance.naturalUnweightedDiagnostic
  assert.equal(m.tp,2); assert.equal(m.fp,1); assert.equal(m.fn,1)
  assert.equal(m.precision.value,2/3); assert.equal(m.recall.value,2/3); assert.equal(m.f1.value,2/3)
  assert.equal(result.acceptance.protectedSlices.column.recall.value,1)
  assert.equal(result.acceptance.protectedSlices.science.recall.value,0)
  assert.equal(result.acceptance.partyFalsePositive.value,1)
  assert.equal(result.acceptance.protectedSlices.security.minimumPositiveSupportMet,false)
  const weighted = binary([{positive:true,accepted:true,weight:2},{positive:true,accepted:false,weight:4},{positive:false,accepted:true,weight:1}],true)
  assert.equal(weighted.precision.value,2/3); assert.equal(weighted.recall.value,1/3); assert.equal(weighted.f1.value,4/9)
  assert.equal(weighted.precision.interval95,null)
})
test('zero denominators are explicit; no perfect metric invented for empty corpus', () => {
  assert.equal(rate(0,0).value,null); assert.equal(rate(0,0).status,'undefined_zero_denominator')
  assert.equal(binary([]).f1.value,null); assert.equal(clustering([]).bCubed.f1,null)
  assert.equal(ndcg([],[],20).value,null)
})
test('subject abstention counts incorrect on positives including rejected/deferred positives', () => {
  const a = observation('subject-a'), b = observation('subject-b'), c = observation('subject-unknown')
  const result = report([a,b,c],[gold(a),gold(b),gold(c,'useful',{primarySubject:null})],[prediction(a),prediction(b,'rejected',null),prediction(c,'deferred',null)])
  assert.equal(result.representation.subjects.accuracy.value,0.5)
  assert.equal(result.representation.subjects.abstention.value,0.5)
  assert.equal(result.representation.subjects.selectiveAccuracy.value,1)
  assert.equal(result.representation.subjects.missingGoldPrimary,1)
  assert.equal(result.representation.subjects.perSubject.Economy.recall.value,0.5)
})
test('topic overlap cannot cover unique angles; primary versus expanded recall and duplicate exposure differ', () => {
  const os = ['angle-a','angle-b','duplicate'].map(id => observation(id))
  const records = os.map((o,i)=>gold(o,i===2?'useful':'must_read',{storyId:'same',themeId:'theme',angleId:i===1?'angle-two':'angle-one',contentType:'column',novelty:{status:'distinct_analysis',relativeTo:[],cutoff:CLOCK},materialDelta:{description:'Synthetic independently judged analytical distinction.',evidence:[{observationId:o.id,field:'title',start:0,end:1}]}}))
  const units = [{id:'u1',primaryUrl:os[0].metadata.url,memberUrls:[os[0].metadata.url,os[1].metadata.url]},{id:'u2',primaryUrl:os[2].metadata.url,memberUrls:[os[2].metadata.url]}]
  const result = report(os,records,os.map(o=>prediction(o)),units)
  assert.equal(result.selection.mustReadTopLevel.value,0.5)
  assert.equal(result.selection.mustReadExpanded.value,1)
  assert.equal(result.selection.analysisAngleRecall.value,0.5)
  assert.equal(result.selection.duplicateExposure.value,0.5)
})
test('pairwise and B-cubed clustering hand calculation; uncertain pairs excluded', () => {
  const m = clustering([{id:'a',gold:'one',predicted:'merged'},{id:'b',gold:'one',predicted:'merged'},{id:'c',gold:'two',predicted:'merged'}])
  assert.equal(m.pairs.precision.value,1/3); assert.equal(m.pairs.recall.value,1)
  assert.ok(Math.abs(m.bCubed.precision! - 5/9) < 1e-12); assert.equal(m.bCubed.recall,1)
  assert.ok(Math.abs(m.bCubed.f1! - 5/7) < 1e-12)
  assert.equal(pairMetric([{left:'a',right:'b',same:null,predictedSame:true}]).fp,0)
})
test('unjudged top-K retains full denominator, coverage and bounds, with pending nDCG', () => {
  const a=observation('rank-known'),b=observation('rank-unjudged')
  const result=report([a,b],[gold(a)],[prediction(a),prediction(b)],[{id:'u1',primaryUrl:a.metadata.url,memberUrls:[a.metadata.url]},{id:'u2',primaryUrl:b.metadata.url,memberUrls:[b.metadata.url]}])
  assert.equal(result.selection.topK[0].outputCount,2)
  assert.equal(result.selection.topK[0].judgementCoverage.value,0.5)
  assert.equal(result.selection.topK[0].precision,null)
  assert.deepEqual(result.selection.topK[0].precisionBounds,[0.5,1])
  assert.equal(result.selection.topK[0].ndcg.value,null)
})
test('group intervals, agreement and anchor utilities deterministic with explicit unresolved support', () => {
  const rows=[{g:'a',positive:true,accepted:true},{g:'b',positive:true,accepted:false}]
  const bootstrap=()=>groupedBootstrap(rows,r=>r.g,rs=>binary(rs).recall.value,'fixed')
  assert.deepEqual(bootstrap(),bootstrap())
  assert.equal(groupedBootstrap([rows[0]],r=>r.g,rs=>binary(rs).recall.value,'fixed').status,'insufficient_groups')
  assert.equal(agreement([{left:null,right:'reject'}]).agreement.value,null)
  assert.equal(anchorPreference([{preferredAvailable:true,comparable:null,selectedPreferred:true,materiallyInferiorOverride:null}]).preference.value,null)
})
test('URL/revision, aliases, syndication, near-duplicates, event, angle and theme leakage detected', () => {
  const a=identity(observation('split-a')),b=identity(observation('split-b'))
  for(const key of ['syndicationIds','nearDuplicateIds','developmentIds','angleIds','themeIds'] as const) assert.throws(()=>validatePartitions([{...a,[key]:['same'],partition:'development'},{...b,[key]:['same'],partition:'validation'}]),/leakage/)
  assert.throws(()=>validatePartitions([{...a,partition:'development'},{...b,aliases:[a.url+'?utm_source=revision'],partition:'validation'}]),/leakage/)
  assert.throws(()=>validatePartitions([{...a,partition:'development'},{...a,partition:'validation'}]),/Duplicate/)
})
test('bootstrap manifests deterministic under permutation, grouping stays whole without six weeks', () => {
  const os=['split-1','split-2','split-3','split-4'].map(id=>observation(id))
  const ids=os.map((o,i)=>identity(o,{developmentIds:[i<2?'shared':'event:'+i]}))
  const a=splitBootstrap(ids,'seed'),b=splitBootstrap([...ids].reverse(),'seed')
  assert.deepEqual(a,b); validatePartitionManifest(a)
  assert.equal(a.mode,'bootstrap'); assert.equal(a.holdoutsSealed,false)
  assert.equal(a.assignments.find(r=>r.url===os[0].metadata.url)!.partition,a.assignments.find(r=>r.url===os[1].metadata.url)!.partition)
  assert.throws(()=>validatePartitionManifest({...a,hash:digest('tampered')}),/integrity/)
})
test('later forward holdout permits only temporal theme continuity; unseen needs disjoint families', () => {
  const a={...identity(observation('past'),{themeIds:['running']}),partition:'development' as const}
  const b={...identity(observation('later',{},'2026-10-09T10:00:00.000Z'),{themeIds:['running']}),partition:'holdout_forward' as const}
  validatePartitions([a,b],CLOCK)
  assert.throws(()=>validatePartitions([a,{...b,partition:'holdout_unseen'}],CLOCK),/leakage/)
  assert.throws(()=>validatePartitions([{...a,developmentIds:['event']},{...b,developmentIds:['event']}],CLOCK),/leakage/)
  assert.throws(()=>validatePartitions([a,b]),/freeze/)
  assert.throws(()=>validateGold({...gold(observation('sealed')),partition:'holdout_unseen'}),/Sealed/)
})
test('sampling and blind exports deterministic under permutations/repeated source observations', () => {
  const first=observation('sample-a'),revision=observation('sample-a',{description:'Changed bounded metadata'},'2026-10-07T11:00:00.000Z'),second=observation('sample-b')
  const plan={namespace:'test-bootstrap',seed:'fixed',window:WINDOW,cells:[{id:'all',panel:'representative' as const,take:1,match:{}}]}
  const observations=[first,revision,second],manifest=sample(observations,plan)
  assert.deepEqual(manifest,sample([...observations].reverse(),plan))
  assert.equal(manifest.populations[0].population,2); assert.equal(manifest.entries[0].sampling.inclusionProbability,0.5)
  const records=annotationExport(manifest,observations)
  assert.equal(records[0].gold.value,null); assert.equal(records[0].review.status,'unreviewed')
  const text=stableJson(records)
  for(const forbidden of ['score','prediction','accepted','suggestedSubject']) assert.equal(text.includes('"'+forbidden+'"'),false)
  assert.throws(()=>sample(observations,{...plan,cells:[{...plan.cells[0],match:{score:1} as never}]}),/predictions/)
  assert.throws(()=>validateSamplingManifest({...manifest,unmatched:99},observations),/changed/)
})
test('collector retains pre-dedup metadata and membership, ignores bodies, captures available RSS/Atom fields', async () => {
  const shard=feedShards()[0],url='https://example.test/raw'
  const rss=`<rss><channel><item><title>Contract</title><link>${url}</link><description>Bounded summary</description><dc:creator>Test Author</dc:creator><category>Science</category><content:encoded>BODY MUST NEVER ENTER ARTIFACT</content:encoded></item><item><title>Duplicate membership</title><link>${url}</link></item></channel></rss>`
  const fetched:string[]=[]
  const raw=await collectShard({captureId:'synthetic-raw',shardIndex:0,clock:()=>CLOCK,fetcher:async(input,init)=>{
    fetched.push(String(input));assert.equal(init!.redirect,'error');assert.equal(init!.credentials,'omit');return new Response(rss,{status:200})
  }})
  validateRaw(raw)
  assert.equal(fetched.length,shard.length);assert.ok(fetched.every(url=>NEWS_SOURCES.some(s=>s.feedUrl===url)))
  assert.equal(raw.sources.flatMap(s=>s.observations).length,shard.length*2)
  assert.equal(new Set(raw.sources.flatMap(s=>s.observations).map(o=>o.sourceId)).size,shard.length)
  assert.equal(stableJson(raw).includes('BODY MUST'),false)
  assert.equal(raw.sources[0].observations[0].metadata.bylines[0].provenance,'rss:dc:creator')
  const atom=parseMetadata('<feed><entry><title>Atom</title><link href="https://example.test/atom"/><summary>Summary</summary><content>NO BODY</content><author><name>A Name</name><email>ignored@example.test</email></author><category term="Environment"/></entry></feed>',NEWS_SOURCES[0])
  assert.equal(atom.metadata[0].bylines[0].name,'A Name');assert.equal(stableJson(atom).includes('NO BODY'),false);assert.equal(stableJson(atom).includes('ignored@'),false)
})
test('source failure differs from empty successful feed, and invalid feed entries from genuine empty', async () => {
  const ids=feedShards()[0]
  const raw=await collectShard({captureId:'synthetic-health',shardIndex:0,clock:()=>CLOCK,fetcher:async(input)=> {
    if(String(input)===ids[0].feedUrl) return new Response('unavailable',{status:503})
    if(String(input)===ids[1].feedUrl) return new Response('<rss><channel><item><title>Missing URL</title></item></channel></rss>')
    return new Response('<rss><channel/></rss>')
  }})
  assert.equal(raw.sources[0].status,'failed');assert.equal(raw.sources[0].countBefore,null)
  assert.equal(raw.sources[1].status,'ok');assert.equal(raw.sources[1].invalidEntries,1);assert.equal(raw.sources[1].countAfter,0)
  assert.equal(raw.sources[2].status,'empty');assert.equal(raw.sources[2].countBefore,0)
  const bad=structuredClone(raw);(bad.sources[2] as unknown as Record<string,unknown>).body='forbidden'
  assert.throws(()=>validateRaw(bad))
})
test('collector rejects non-shards, redirects, malformed XML and DTDs without fallback or credentials', async () => {
  await assert.rejects(()=>collectShard({captureId:'bad',shardIndex:999,clock:()=>CLOCK}))
  assert.throws(()=>parseMetadata('<!DOCTYPE rss><rss><channel/></rss>',NEWS_SOURCES[0]))
  const raw=await collectShard({captureId:'synthetic-parse-fail',shardIndex:0,clock:()=>CLOCK,fetcher:async()=>new Response('<rss><broken>')})
  assert.ok(raw.sources.every(s=>s.failure==='parse'))
  const redirected=await collectShard({captureId:'synthetic-redirect',shardIndex:0,clock:()=>CLOCK,fetcher:async()=>new Response('',{status:302})})
  assert.ok(redirected.sources.every(s=>s.failure==='redirect'))
})
test('identical metadata/history/policy/clock replay deterministic and permutation stable with no gold features', () => {
  const os=[observation('replay-a'),observation('replay-b')],history=[observation('history',{},'2026-10-06T10:00:00.000Z')]
  const runner=(input: {observations:Observation[];history:Observation[]})=>({articles:input.observations.map(o=>prediction(o)),units:input.observations.map(o=>({id:o.id,primaryUrl:o.metadata.url,memberUrls:[o.metadata.url]}))})
  const a=replay({observations:os,history,clock:CLOCK,versions},runner)
  assert.deepEqual(a,replay({observations:[...os].reverse(),history:[...history].reverse(),clock:CLOCK,versions},runner))
  assert.throws(()=>replay({...{observations:os,history,clock:CLOCK,versions},gold:[]} as never,runner),/gold/)
  assert.throws(()=>replay({observations:os,history,clock:CLOCK,versions},input=>{input.observations[0].metadata.title='mutated';return {articles:[],units:[]}}),TypeError)
})
test('future observations/history and post-cutoff publisher revisions rejected, stale capture date never rewritten', () => {
  const old=observation('stale',{},'2026-10-06T10:00:00.000Z'),future=observation('future',{},'2026-10-08T10:00:00.000Z')
  const empty=()=>({articles:[],units:[]})
  assert.throws(()=>replay({observations:[future],history:[],clock:CLOCK,versions},empty),/Future/)
  assert.throws(()=>replay({observations:[],history:[future],clock:CLOCK,versions},empty),/Future/)
  assert.throws(()=>replay({observations:[observation('future-update',{updatedAt:'2026-10-08T10:00:00.000Z'})],history:[],clock:CLOCK,versions},empty),/publisher/)
  const seen:string[]=[];replay({observations:[],history:[old],clock:CLOCK,versions},input=>{seen.push(input.history[0].capturedAt);return empty()})
  assert.deepEqual(seen,['2026-10-06T10:00:00.000Z'])
})
test('chronological replay sequence excludes future metadata rather than lending it to earlier buckets', () => {
  const os=[observation('day1',{},'2026-10-06T10:00:00.000Z'),observation('day2'),observation('day3',{},'2026-10-08T10:00:00.000Z')]
  const seen: string[][]=[]
  const runs=replaySequence(os,['2026-10-06T12:00:00.000Z',CLOCK],versions,input=>{seen.push([...input.observations,...input.history].map(o=>o.metadata.url).sort());return {articles:[],units:[]}})
  assert.equal(runs.length,2);assert.equal(seen[0].length,1);assert.equal(seen[1].length,2)
})
test('bounded acquisition inventory is separate from conditional acceptance and selected recalls', () => {
  const a=observation('observed'),r=gold(a),run=replay({observations:[a],history:[],clock:CLOCK,versions},()=>({articles:[prediction(a)],units:[]}))
  const manifest=partitionManifest([{...identity(a),developmentIds:[r.gold.storyId!],partition:'development'}],'test',null)
  const result=evaluate([r],run,{observations:[a],history:[],partitions:manifest,partition:'development',bootstrapSeed:'fixed',coverageInventory:[a.metadata.url,'https://example.test/absent'].map((url,i)=>({id:'listing-'+i,url,publisher:'Test',referenceUrl:'https://example.test/section',listedAt:CAPTURE,reviewStatus:'adjudicated',value:'useful'}))})
  assert.ok('acquisitionRecall' in result.acquisition)
  assert.equal(result.acquisition.acquisitionRecall!.value,0.5)
  assert.equal(result.acceptance.naturalUnweightedDiagnostic.recall.value,1)
  assert.equal(result.selection.expandedNeedRecall.value,0)
})
test('report is explicit about pending quality, immutable outputs cannot overwrite files outside local artifact roots', () => {
  const o=observation('report'),result=report([o],[gold(o)],[prediction(o)])
  assert.match(renderReport(result),/pending_release/)
  assert.throws(()=>writeArtifact(join(tmpdir(),'validator-a1-prohibited.json'),result),/must stay/)
})
test('exact syndicated and close metadata paraphrases grouped without using validator outcomes',()=>{
  const a=observation('copy-a',{title:'Synthetic fiscal-policy explanation',description:'The synthetic fiscal council publishes a new detailed mechanism for economic governance accountability in budget management.'})
  const b=observation('copy-b',{title:a.metadata.title,description:a.metadata.description})
  const c=observation('copy-c',{title:a.metadata.title,description:a.metadata.description+' Explained.'})
  const hint=leakageIdentities([a,b,c])
  assert.deepEqual(hint,leakageIdentities([c,b,a]))
  assert.ok(hint.linkedPairs>=2)
  const manifest=splitBootstrap(hint.identities,'fixed')
  assert.equal(new Set(manifest.assignments.map(r=>r.partition)).size,1)
})
test('pair and sequence schemas reject unresolved truth, cannot-link violations detected, distinct needs preserved',()=>{
  const a=observation('judge-a'),b=observation('judge-b'),observations=[a,b]
  const base={version:'tars-news-judgment/v1' as const,id:'pair-test',partition:'development' as const,clock:CLOCK,reviewStatus:'adjudicated' as const,annotations:['reviewer-a','reviewer-b'].map(reviewerId=>({reviewerId,reviewedAt:CLOCK,rubricVersion:'v1',label:'related_distinct_development',evidence:[{observationId:a.id,field:'title' as const,start:0,end:1}]})),adjudicatorId:'judge',rationale:'Synthetic pair adjudication.'}
  const pair:PairJudgment={...base,kind:'event_pair',leftUrl:a.metadata.url,rightUrl:b.metadata.url,label:'related_distinct_development',cannotLink:true}
  validateJudgment(pair,observations)
  assert.throws(()=>validateJudgment({...pair,articleBody:'forbidden'},observations))
  assert.throws(()=>validateJudgment({...pair,reviewStatus:'disputed'},observations),/Unresolved/)
  assert.throws(()=>validateJudgment({...pair,label:'same_development'},observations),/cannot-link/)
  const run=replay({observations,history:[],clock:CLOCK,versions},()=>({articles:[{...prediction(a),eventId:'merged'},{...prediction(b),eventId:'merged'}],units:[{id:'shown',primaryUrl:a.metadata.url,memberUrls:[a.metadata.url]}]}))
  assert.equal(evaluateEventPairs([pair],run,observations).cannotLinkFailures,1)
  const sequence:SequenceJudgment={...base,id:'sequence-test',kind:'sequence',label:'sequence_reviewed',annotations:base.annotations.map(a=>({...a,label:'sequence_reviewed'})),historyObservationIds:[],needs:[{id:'distinct-a',qualifyingUrls:[a.metadata.url],novelty:'new_development',mustRead:true},{id:'distinct-b',qualifyingUrls:[b.metadata.url],novelty:'distinct_analysis',mustRead:true}]}
  assert.equal(evaluateSequence(sequence,run,observations).expanded.value,0.5)
})
test('rank utility, diversity-regret and distribution diagnostics hand-computable; repeat gains do not inflate nDCG',()=>{
  assert.equal(ndcg([3,1],[3,1],20).value,1)
  assert.equal(distribution(['Economy','Security']).entropy,1)
  assert.deepEqual(diversityRegret([{id:'a',gain:1}],[{id:'b',gain:3}]),{selectedUtility:1,qualityOnlyUtility:3,utilityLoss:2,uniqueMustReadLoss:1})
  const a=observation('gain-a'),b=observation('gain-b')
  const result=report([a,b],[gold(a,'must_read',{storyId:'same'}),gold(b,'useful',{storyId:'same'})],[prediction(a),prediction(b)],[{id:'a',primaryUrl:a.metadata.url,memberUrls:[a.metadata.url]},{id:'b',primaryUrl:b.metadata.url,memberUrls:[b.metadata.url]}])
  assert.equal(result.selection.topK[0].ndcg.value,1)
})
test('operational benchmark detects runner nondeterminism and keeps measurements separate from run hashes',()=>{
  const input={observations:[observation('benchmark')],history:[],clock:CLOCK,versions}
  const result=benchmarkReplay(input,()=>({articles:[],units:[]}),2)
  assert.equal(result.repetitions,2);assert.ok(result.p95Ms>=result.p50Ms)
  let i=0
  assert.throws(()=>benchmarkReplay(input,()=>({articles:[prediction(input.observations[0],i++%2?'accepted':'rejected')],units:[]}),2),/determinism/)
})
