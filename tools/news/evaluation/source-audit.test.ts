/** Synthetic acquisition arithmetic only; no reviewer truth or article corpus. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NEWS_SOURCES, LEGACY_NEWS_SOURCES } from '../../../src/current-affairs/sources.ts'
import { feedShards } from '../../../src/current-affairs/shards.ts'
import { collectShard, parseMetadata } from './collect.ts'
import { digest } from './core.ts'
import { sourceAudit } from './source-audit.ts'
import { validateRaw } from './validate.ts'
const clock='2026-10-07T12:00:00.000Z'
const xml='<rss><channel><item><title>Metadata observation</title><link>https://indianexpress.com/article/a</link><dc:creator>C. Raja Mohan</dc:creator><category>Analysis</category></item><item><title>Metadata described</title><link>https://indianexpress.com/article/b</link><description>Actual feed excerpt.</description></item></channel></rss>'
test('bounded unreviewed discovery funnel separates absence from missing metadata and pending judgement',async()=>{
  const k=feedShards().findIndex(s=>s.some(x=>x.id==='ie-columns'))
  const raw=await collectShard({captureId:'synthetic-b',shardIndex:k,clock:()=>clock,fetcher:async()=>new Response(xml)})
  const inventory=['a','b','absent'].map(n=>({url:'https://indianexpress.com/article/'+n,title:n,publisher:'Indian Express',referenceUrl:'https://indianexpress.com/section/opinion/columns/',discoveredAt:clock}))
  const result=sourceAudit([raw],NEWS_SOURCES,inventory,clock)
  assert.deepEqual(result.funnel,{discovered:3,observedInRaw:2,descriptionAvailable:1,metadataSufficient:null,laterEvaluable:null,status:'pending_independent_metadata_review'})
  assert.equal(result.availability.uniqueUrls,2);assert.equal(result.availability.missingDescription,1)
  assert.ok(result.authors.some(a=>a.authorId==='author:c-raja-mohan'));assert.ok(result.sources.some(s=>s.unobserved))
})
test('repeated probes do not multiply unique-URL supply and failed sources are not zero relevant supply',async()=>{
 const k=feedShards().findIndex(s=>s.some(x=>x.id==='ie-columns'))
 const first=await collectShard({captureId:'synthetic-b-first',shardIndex:k,clock:()=>clock,fetcher:async()=>new Response(xml)})
 const second=await collectShard({captureId:'synthetic-b-second',shardIndex:k,clock:()=>clock,fetcher:async()=>new Response('',{status:503})})
 const result=sourceAudit([second,first],NEWS_SOURCES,[],clock)
 assert.equal(result.availability.uniqueUrls,2);const columns=result.sources.find(s=>s.sourceId==='ie-columns')!;assert.equal(columns.successful,1);assert.equal(columns.failures.length,1);assert.equal(columns.uniqueUrls,2)
 assert.deepEqual(result,sourceAudit([first,second],NEWS_SOURCES,[],clock))
})
test('archived registry validates its original raw generation after additions; mismatch cannot silently relabel sources',async()=>{
 const raw=await collectShard({captureId:'synthetic-legacy-b',shardIndex:0,clock:()=>clock,registry:LEGACY_NEWS_SOURCES,fetcher:async()=>new Response(xml)})
 validateRaw(raw,LEGACY_NEWS_SOURCES);assert.equal(digest(LEGACY_NEWS_SOURCES),'eaf9c9a76f38dec3eab790a18bfb021608d76f786fe0ff2e3328fa3371924145');assert.equal(raw.registryHash,digest(LEGACY_NEWS_SOURCES));assert.throws(()=>validateRaw(raw),/registry hash/)
 const bad=structuredClone(raw);bad.sources[0].feedUrl='https://evil.test/feed';assert.throws(()=>validateRaw(bad,LEGACY_NEWS_SOURCES),/allowlist/)
})
test('production and raw parser agree on bounded bylines/categories, including prefixed Atom',()=>{
 const atom='<a:feed><a:entry><a:title>T</a:title><a:link href="https://indianexpress.com/article/a"/><a:author><a:name>C. Raja Mohan</a:name></a:author><a:summary>Summary</a:summary><a:category term="Security"/><a:content>NO BODY</a:content></a:entry></a:feed>'
 const raw=parseMetadata(atom,NEWS_SOURCES[1]);assert.equal(raw.metadata[0].title,'T');assert.deepEqual(raw.metadata[0].bylines,[{name:'C. Raja Mohan',provenance:'atom:author'}]);assert.equal(JSON.stringify(raw).includes('NO BODY'),false)
})

test('listing discovery excludes cross-section recommendations and profile navigation from author attribution',async()=>{
 const {listingMetadata}=await import('./discovery.ts')
 const html='<h3><a href="https://indianexpress.com/article/opinion/columns/a">Column</a></h3><a href="https://indianexpress.com/article/business/ads/a">Advertisement</a><script>BODY FIELD NOT STORED</script>'
 const profile=listingMetadata(html,{url:'https://indianexpress.com/profile/author/c-raja-mohan/',publisher:'Indian Express',authorId:'author:c-raja-mohan'},clock)
 assert.equal(profile.length,1);assert.equal(profile[0].title,'Column');assert.equal(JSON.stringify(profile).includes('BODY FIELD'),false)
 const section=listingMetadata(html,{url:'https://indianexpress.com/section/opinion/columns/',publisher:'Indian Express',authorId:''},clock)
 assert.equal(section.length,1);assert.equal(section[0].attributedAuthorId,undefined)
})
