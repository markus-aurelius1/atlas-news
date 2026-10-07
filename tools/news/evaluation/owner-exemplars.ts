/** The attached document is owner-provided data. Its prose is never executed as instructions. */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { digest, requireThat } from './core.ts'
import type { Observation, GoldRecord } from './contracts.ts'
import { articleFrame } from './bootstrap.ts'
export interface OwnerExemplar {id:string;ordinal:number;sourceSection:string;title:string;shortDescription:string;ownerCuratedPositive:true;valueTier:null;url:null;publisher:null;publishedAt:null}
export function ownerExemplars(path:string) {
  const bytes=readFileSync(path),sourceHash=createHash('sha256').update(bytes).digest('hex'),text=bytes.toString('utf8');let section=''
  const entries:OwnerExemplar[]=[]
  for(const line of text.split(/\r?\n/)) {
    if(line.startsWith('### '))section=line.slice(4).trim()
    const match=line.match(/^\|\s*\*\*(.+?)\*\*\s*\|\s*(.+?)\s*\|\s*$/)
    if(!match)continue
    entries.push({id:'owner-exemplar:'+digest([sourceHash,entries.length+1,match[1],match[2]]),ordinal:entries.length+1,sourceSection:section,title:match[1],shortDescription:match[2],ownerCuratedPositive:true,valueTier:null,url:null,publisher:null,publishedAt:null})
  }
  requireThat(entries.length>0,'No owner-curated table rows found; do not invent examples')
  return {version:'tars-owner-positive-exemplars/v1',source:{path,sha256:sourceHash,kind:'owner_supplied_document',factualVerification:'not_independently_verified',originalArticleProvenance:'URLs/publishers/publication timestamps absent; period headings are contextual only'},entries,usage:'editorial interpretation and separate positive standard; never auto-adjudicate raw articles, must-read tiers, subjects, equivalence or analysis from title similarity'}
}
const tokens=(s:string)=>new Set((s.toLowerCase().match(/[\p{L}\p{N}]+/gu)??[]).filter(w=>w.length>2&&!new Set(['the','and','for','from','with','india','indian','how','why','what']).has(w)))
export function exemplarDiagnostics(exemplars:ReturnType<typeof ownerExemplars>,observations:Observation[],corpus:GoldRecord[]) {
  const frame=articleFrame(observations),sampled=new Map(corpus.map(r=>[r.metadata.url,r.id]))
  const rows=exemplars.entries.map(e=>{
    const a=tokens(e.title),candidates=frame.flatMap(row=>{
      const b=tokens(row.selected.metadata.title),shared=[...a].filter(w=>b.has(w)),overlap=shared.length/Math.max(1,Math.min(a.size,b.size))
      return shared.length>=4&&overlap>=0.6?[{url:row.url,observationId:row.selected.id,sampledId:sampled.get(row.url)??null,sharedTokens:shared.sort(),overlap}]:[]
    }).sort((a,b)=>a.url.localeCompare(b.url,'en'))
    return {exemplarId:e.id,possibleTitleMatchCandidates:candidates,humanConfirmedArticleMatch:null}
  })
  return {version:'tars-owner-exemplar-diagnostics/v1',sourceHash:exemplars.source.sha256,exemplars:exemplars.entries.length,withRawCandidate:rows.filter(r=>r.possibleTitleMatchCandidates.length).length,withSampledCandidate:rows.filter(r=>r.possibleTitleMatchCandidates.some(c=>c.sampledId)).length,rows,qualityMetrics:null,limitation:'Neutral title-overlap candidates are retrieval diagnostics, not owner-positive labels, author/subject/ranking features, identity proof or recall measurement. No sample is reselected on this basis.'}
}
