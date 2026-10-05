/** Asset bytes, meaningful hotspot roles and curation are independently verifiable. */
import { it,expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { indexAtlas } from './data'
import { matchesPyq } from './pyq/browse'
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'))
const atlas=indexAtlas(read('public/atlas/v1/places.json'))
const m=read('public/atlas-assets/v1/manifest.json')
it('asset manifest records exact hashes/sizes and stays within per-file precache limits',()=>{for(const a of m.assets){const bytes=readFileSync('public/'+a.path);expect(bytes.length).toBe(a.bytes);expect(createHash('sha256').update(bytes).digest('hex')).toBe(a.version);expect(bytes.length).toBeLessThan(3*1024*1024)}expect(m.totalBytes).toBe(m.assets.reduce((n:number,a:{bytes:number})=>n+a.bytes,0));expect(m.tiers.REGIONAL.packs).toEqual([]);expect(m.tiers.ONLINE.cacheBudgetBytes).toBe(0)})
it('hotspot families count questions once and exclude every distractor/incidental relation',()=>{const manifest=read('public/pyq-atlas/v1/manifest.json'),counts:Record<string,Record<string,number>>={};let total=0;for(const paper of manifest.papers){for(const q of read('public/pyq-atlas/v1/'+paper.questions).questions){total++;const ids=new Set<string>(q.relations.filter((r:{semanticRole:string;quizIncluded:boolean})=>r.quizIncluded&&!['incidental','distractor'].includes(r.semanticRole)).map((r:{placeId:string})=>r.placeId));for(const id of ids){expect(atlas.byId.has(id)).toBe(true);counts[id]??={CSE:0,PCS:0,CDS:0};counts[id][q.family]++}expect(matchesPyq(q,{family:q.family,year:q.exam.year},atlas)).toBe(true)}}expect(total).toBe(149);expect(read('public/atlas-assets/v1/pyq-hotspots.json').places).toEqual(counts)})
