import { describe, it, expect, vi } from 'vitest'
import { parseFeed, dedupeUrls } from '../feed'
import { NEWS_SOURCES, LEGACY_NEWS_SOURCES, MAX_NEWS_SOURCES } from '../sources'
import { articleMetadata, retainArticles, readArchive, restoreArticles } from '../archive'
import { IDBFactory } from 'fake-indexeddb'
import { sourceIntelligence } from './source-intelligence'
import { curatedAuthorEvidence, AUTHOR_REGISTRY } from './author-registry'
import { optionalMetadata, METADATA_LIMITS, cleanFeedResponse } from './metadata'
import { feedShards, mergeShards, FEED_SHARDS, LEGACY_FEED_SHARDS, FEED_REGISTRY_GENERATION, LEGACY_REGISTRY_GENERATION, requestLayout } from '../shards'
import { onRequest } from '../../../functions/api/current-affairs'
import { pinnedArticle } from '../../sync/adapters'
import type { NewsItem, FeedResponse } from '../types'
const source = NEWS_SOURCES.find(s=>s.id==='ie-explained')!
const columns = NEWS_SOURCES.find(s=>s.id==='ie-columns')!
const rss = (fields='', url='https://indianexpress.com/article/a') => '<rss><channel><item><title>Pratap Bhanu Mehta discussed C. Raja Mohan</title><link>'+url+'</link>'+fields+'<content:encoded>FORBIDDEN BODY</content:encoded></item></channel></rss>'
const row = (fields='', s=source) => parseFeed(rss(fields),s)[0]
describe('Job B source and author metadata',()=>{
  it.each([['dc:creator','rss:dc:creator'],['author','rss:author']])('parses RSS %s with explicit provenance', (tag,provenance)=>{
    const r=row('<'+tag+'>Pratap Bhanu Mehta</'+tag+'><category>Polity</category>')
    expect(r.bylines).toEqual([{name:'Pratap Bhanu Mehta',provenance,sourceId:source.id}]);expect(r.categories).toEqual(['Polity'])
    expect(curatedAuthorEvidence(r).map(a=>a.authorId)).toEqual(['author:pratap-bhanu-mehta'])
    expect(JSON.stringify(r)).not.toContain('FORBIDDEN BODY')
  })
  it('parses namespaced Atom authors, multiple authors, category terms and updated metadata without content',()=>{
    const xml='<atom:feed><atom:entry><atom:title>A</atom:title><atom:link href="https://indianexpress.com/article/a"/><atom:author><atom:name>C. Raja Mohan</atom:name><atom:email>not-retained@example.org</atom:email></atom:author><atom:author><atom:name>Pratap Bhanu Mehta</atom:name></atom:author><atom:author><atom:name/></atom:author><atom:category term="Security"/><atom:updated>2026-10-07T10:00:00Z</atom:updated><atom:content>FORBIDDEN BODY</atom:content></atom:entry></atom:feed>'
    const r=parseFeed(xml,source)[0];expect(r.bylines).toHaveLength(2);expect(curatedAuthorEvidence(r)).toHaveLength(2);expect(r.categories).toEqual(['Security']);expect(r.updatedAt).toBe('2026-10-07T10:00:00.000Z');expect(JSON.stringify(r)).not.toContain('not-retained@')
  })
  it('uses explicit Atom feed authors when the entry has none; never overrides an explicit empty entry author',()=>{
    const entry='<entry><title>T</title><link href="https://indianexpress.com/article/a"/></entry>'
    const xml='<feed><author><name>C. Raja Mohan</name></author>'+entry+'</feed>'
    expect(curatedAuthorEvidence(parseFeed(xml,source)[0])).toHaveLength(1)
    expect(curatedAuthorEvidence(parseFeed(xml.replace('</entry>','<author><name/></author></entry>'),source)[0])).toEqual([])
  })
  it('missing/empty authors and names mentioned in title/description do not become bylines',()=>{
    for(const fields of ['', '<author/>','<description>Pratap Bhanu Mehta and C. Raja Mohan</description>'])expect(curatedAuthorEvidence(row(fields))).toEqual([])
  })
  it('ambiguous combined authors, substring names and unknown authors gain no identity',()=>{
    for(const name of ['Pratap Bhanu Mehta and C. Raja Mohan','Dr Pratap Bhanu Mehta','Pratap Bhanu Mehta Jr','Unknown Author','pbmehta@example.com'])expect(curatedAuthorEvidence(row('<author>'+name+'</author>'))).toEqual([])
    expect(curatedAuthorEvidence(row('<author>pb@example.com (Pratap Bhanu Mehta)</author>'))).toHaveLength(1)
  })
  it('supports verified aliases only, bound to their publisher, with review provenance',()=>{
    expect(AUTHOR_REGISTRY).toHaveLength(2)
    for(const author of AUTHOR_REGISTRY){expect(author.evidenceUrl).toMatch(/^https:\/\/indianexpress.com\/profile\//);expect(author.version).toBe(1);expect(author.reviewedAt).toBe('2026-10-07');for(const alias of author.aliases)expect(curatedAuthorEvidence(row('<dc:creator>'+alias+'</dc:creator>'))[0].authorId).toBe(author.id)}
  })
  it('host/source/publisher spoofing cannot establish TH/IE or curated author evidence',()=>{
    const fields='<dc:creator>Pratap Bhanu Mehta</dc:creator>'
    const forged=[parseFeed(rss(fields,'https://indianexpress.com.evil.test/article/a'),source)[0],parseFeed(rss(fields,'https://thehindu.com/article/a'),source)[0],parseFeed(rss(fields,'https://indianexpress.com:8443/article/a'),source)[0],{...row(fields),sourceId:'unknown'},parseFeed(rss(fields),{...source,feedUrl:'https://evil.test/feed'})[0],{...row(fields),publisher:'The Hindu'}, {...row(fields),sourceId:'unknown',memberships:[{sourceId:'unknown',feedUrl:source.feedUrl,section:source.section}]}]
    for(const r of forged){expect(curatedAuthorEvidence(r)).toEqual([]);expect(sourceIntelligence(r).verifiedPublisher).toBeNull()}
    const hindu=NEWS_SOURCES.find(s=>s.id==='hindu-science')!
    expect(sourceIntelligence(parseFeed(rss(fields,'https://thehindu.com.evil.test/article/a'),hindu)[0]).verifiedPublisher).toBeNull()
  })
  it('merges same URL from general and specialist feeds deterministically, preserves all memberships, does not mutate input',()=>{
    const general=row('<description>Short</description><category>India</category>')
    const specialist=row('<description>A longer publisher-provided description</description><dc:creator>C. Raja Mohan</dc:creator><category>Analysis</category>',columns)
    const original=structuredClone([general,specialist]), a=dedupeUrls(original), b=dedupeUrls([specialist,general])
    expect(a).toEqual(b);expect(original).toEqual([general,specialist]);expect(a[0].memberships?.map(m=>m.sourceId)).toEqual(['ie-columns','ie-explained']);expect(a[0].categories).toEqual(['Analysis','India']);expect(a[0].description).toBe(specialist.description);expect(curatedAuthorEvidence(a[0])).toHaveLength(1)
  })
  it('metadata limits apply to parser, merge, archive and dirty optional values',()=>{
    const fields=Array.from({length:45},(_,k)=>'<category>'+k+'x'.repeat(300)+'</category><dc:creator>'+k+'y'.repeat(300)+'</dc:creator>').join('')
    const r=row(fields);expect(r.categories).toHaveLength(METADATA_LIMITS.categories);expect(r.bylines).toHaveLength(METADATA_LIMITS.bylines);expect(r.bylines!.every(b=>b.name.length<=160)).toBe(true)
    const clean=articleMetadata({...r,title:'t'.repeat(1000),description:'d'.repeat(2000),body:'DROP',categories:[null,{},'z'.repeat(400)],bylines:[null,{},...r.bylines!]} as unknown as NewsItem,1)!
    expect(clean.title).toHaveLength(400);expect(clean.description).toHaveLength(600);expect(clean.categories).toEqual(['z'.repeat(160)]);expect(JSON.stringify(clean)).not.toContain('DROP')
    expect(optionalMetadata({...r,memberships:Array(300).fill(r.memberships![0])}).memberships).toHaveLength(1)
    expect(parseFeed(rss('', 'https://indianexpress.com/'+ 'x'.repeat(2100)),source)).toEqual([])
    const cache = cleanFeedResponse({ version:1, fetchedAt:'2026-10-07T10:00:00Z',items:[{...r,body:'DROP',description:'d'.repeat(2000),publishedAt:{body:'DROP'},memberships:[{...r.memberships![0],body:'DROP'}],thumbnailUrl:'javascript:bad'}],sources:[],body:'DROP' } as unknown as FeedResponse)
    expect(JSON.stringify(cache)).not.toContain('DROP');expect(cache.items[0].thumbnailUrl).toBeUndefined();expect(cache.items[0].description).toHaveLength(600)
  })
  it('old archive rows and new bounded fields survive read/backup restore and pinned metadata cleaners without a store migration',async()=>{
    const db=new IDBFactory(),old=row();delete old.memberships;delete old.categories;delete old.bylines
    await retainArticles([old,row('<dc:creator>C. Raja Mohan</dc:creator>')],10,db)
    const rows=await readArchive(db);expect(rows).toHaveLength(1)
    const fresh=new IDBFactory();expect(await restoreArticles(rows,fresh)).toBe(1);expect((await readArchive(fresh))[0].bylines![0].name).toBe('C. Raja Mohan')
    expect(pinnedArticle({k:rows[0].url,v:JSON.stringify(rows[0]),d:0})?.bylines).toEqual(rows[0].bylines)
    expect(articleMetadata(old,10)).not.toBeNull()
  })
  it('registry stays below 100 sources, retains the legacy 77-source layout, and uses at most six upstream requests per shard',()=>{
    expect(NEWS_SOURCES).toHaveLength(86);expect(NEWS_SOURCES.length).toBeLessThanOrEqual(MAX_NEWS_SOURCES);expect(LEGACY_NEWS_SOURCES).toHaveLength(77);expect(LEGACY_FEED_SHARDS).toHaveLength(13);expect(FEED_SHARDS).toHaveLength(15);expect(feedShards().every(s=>s.length<=6)).toBe(true)
    expect(FEED_REGISTRY_GENERATION).not.toBe(LEGACY_REGISTRY_GENERATION);expect(requestLayout(new URLSearchParams())).toEqual(LEGACY_FEED_SHARDS)
  })
  it('generation mismatch and individual source failure keep previous usable coverage',()=>{
    const item=row('<description>Cached</description>')
    const previous:FeedResponse={version:1,fetchedAt:'2026-10-07T08:00:00Z',items:[item],sources:[]}
    const fresh:FeedResponse={version:1,registryGeneration:FEED_REGISTRY_GENERATION,fetchedAt:'2026-10-07T10:00:00Z',items:[],sources:[{sourceId:source.id,status:'failed',count:0}]}
    expect(mergeShards([fresh],previous,FEED_SHARDS,FEED_REGISTRY_GENERATION)?.items[0].url).toBe(item.url)
    expect(mergeShards([{...fresh,registryGeneration:'old'}],previous,FEED_SHARDS,FEED_REGISTRY_GENERATION)).toBeNull()
    expect(mergeShards([{...fresh,sources:[]}],previous,FEED_SHARDS,FEED_REGISTRY_GENERATION)?.items[0].url).toBe(item.url)
  })
  it('unknown generation fetches nothing; legacy requests still collect their original shard',async()=>{
    const fetcher=vi.fn(async()=>new Response('<rss><channel/></rss>'));vi.stubGlobal('fetch',fetcher)
    try{const failed=await onRequest({request:new Request('https://tars.test/api/current-affairs?shard=0&generation=unknown'),waitUntil:()=>{}});expect(failed.status).toBe(409);expect(fetcher).not.toHaveBeenCalled()
      const legacy=await onRequest({request:new Request('https://tars.test/api/current-affairs?shard=0'),waitUntil:()=>{}});expect(legacy.status).toBe(200);expect(fetcher.mock.calls).toHaveLength(LEGACY_FEED_SHARDS[0].length);expect((await legacy.json()).registryGeneration).toBe(LEGACY_REGISTRY_GENERATION)
    }finally{vi.unstubAllGlobals()}
  })
})
