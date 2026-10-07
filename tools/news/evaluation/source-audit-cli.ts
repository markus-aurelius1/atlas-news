/** Explicit Job B research command; writes only bounded metadata in ignored immutable artifact roots. */
import { readFileSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { NEWS_SOURCES } from '../../../src/current-affairs/sources.ts'
import { feedShards } from '../../../src/current-affairs/shards.ts'
import { listingMetadata } from './discovery.ts'
import { collectShard } from './collect.ts'
import { writeArtifact } from './report.ts'
import { sourceAudit } from './source-audit.ts'
import type { DiscoveryReference } from './source-audit.ts'
import { requireThat } from './core.ts'
const [mode, root] = process.argv.slice(2)
requireThat(['capture','listings'].includes(mode) && root?.startsWith('tools/news/evaluation/data/'), 'Usage: node tools/news/evaluation/source-audit-cli.ts capture|listings tools/news/evaluation/data/UNIQUE_DIRECTORY')
if (mode === 'capture') {
writeArtifact(root+'/registry.json', NEWS_SOURCES)
writeArtifact(root+'/parser-manifest.json', ['src/current-affairs/feed.ts','src/current-affairs/validator-v3/metadata.ts','tools/news/evaluation/collect.ts','tools/news/evaluation/xml.ts','tools/news/evaluation/validate.ts'].map(path=>({path,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')})))
}
const captures = mode === 'listings' ? readdirSync(root).filter(f=>/^raw-.*\.json$/.test(f)).sort().map(f=>JSON.parse(readFileSync(root+'/'+f,'utf8'))) : []
if (mode === 'capture') for (const round of [1,2]) for (const [shardIndex,shard] of feedShards().entries()) {
  if (!shard.some(s=>/^(ie-|hindu-)/.test(s.id))) continue
  const capture = await collectShard({ captureId: root+':'+round+':'+shardIndex, shardIndex, clock: ()=>new Date().toISOString() })
  writeArtifact(root+'/raw-'+round+'-'+shardIndex+'.json',capture); captures.push(capture)
  console.log('capture', round, shardIndex, capture.sources.filter(s=>/^(ie-|hindu-)/.test(s.sourceId)).map(s=>[s.sourceId,s.status,s.httpStatus,s.countAfter]))
}
const listings = [
  { url: 'https://indianexpress.com/profile/columnist/pratap-bhanu-mehta/', publisher: 'Indian Express', authorId: 'author:pratap-bhanu-mehta' },
  { url: 'https://indianexpress.com/profile/author/c-raja-mohan/', publisher: 'Indian Express', authorId: 'author:c-raja-mohan' },
  ...NEWS_SOURCES.filter(s=>/^(ie-|hindu-)/.test(s.id)).map(s=>({ url: s.feedUrl.replace(/feed\/$/,'').replace(/feeder\/default.rss$/,''), publisher: s.publisher, authorId: '' })),
]
const inventory: DiscoveryReference[] = [], health: { url:string; status:number|null; failure:string|null; entries:number }[] = []
for (const listing of listings) {
  let status: number | null = null
  const controller = new AbortController(), timer = setTimeout(()=>controller.abort(),10000)
  try {
    const response = await fetch(listing.url,{ signal: controller.signal, redirect:'error', credentials:'omit', headers: { 'User-Agent':'TarsCurrentAffairs/1.0 (RSS link reader)' } }); status=response.status
    requireThat(response.ok && response.body,'http')
    const reader=response.body.getReader(), decoder=new TextDecoder(); let html='', bytes=0
    try { while(true) { const chunk=await reader.read(); if(chunk.done) break; bytes+=chunk.value.byteLength; requireThat(bytes<=4*1024*1024,'too_large'); html+=decoder.decode(chunk.value,{stream:true}) } } finally { await reader.cancel() }
    html+=decoder.decode()
    const rows = listingMetadata(html, listing, new Date().toISOString())
    inventory.push(...rows);health.push({url:listing.url,status,failure:null,entries:rows.length})
  } catch (error) { health.push({url:listing.url,status,failure:controller.signal.aborted?'timeout':error instanceof Error?error.message:'network',entries:0}) }
  finally { clearTimeout(timer) }
}
const suffix = mode === 'listings' ? '-v2' : ''
writeArtifact(root+'/inventory'+suffix+'.json',inventory);writeArtifact(root+'/listing-health'+suffix+'.json',health)
const report=sourceAudit(captures,NEWS_SOURCES,inventory,new Date().toISOString())
writeArtifact(root+'/audit'+suffix+'.json',report)
console.log(JSON.stringify({funnel:report.funnel,availability:report.availability,authors:report.authors.map(a=>({...a,urls:undefined})),listingHealth:health},null,2))
