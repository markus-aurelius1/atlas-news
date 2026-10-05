/** Deterministic offline inventory; validates the independently bundled official outline without changing the baseline map. */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { validateSoiBoundary } from './atlas-build/lib/soi-boundary.mjs'
const sha=b=>createHash('sha256').update(b).digest('hex')
const out='public/atlas-assets/v1';mkdirSync(out,{recursive:true})
const meta=JSON.parse(readFileSync(join(out,'india-boundary-source.json'),'utf8'))
const boundary=JSON.parse(readFileSync(join(out,'india-controlled-border.geojson'),'utf8'))
if(meta.authority!=='Survey of India'||! /^[a-f0-9]{64}$/.test(meta.sourceSha256)||!boundary.features.every(f=>f.properties.authority==='survey-of-india'&&f.properties.sourceSha256===meta.sourceSha256))throw new Error('Official boundary provenance mismatch')
const geometry=validateSoiBoundary(boundary)
if(JSON.stringify(geometry)!==JSON.stringify(meta.geometry))throw new Error('Official boundary geometry metadata mismatch')
console.log('Atlas boundary: validated Survey of India archive '+meta.sourceSha256)
const pyq=JSON.parse(readFileSync('public/pyq-atlas/v1/manifest.json'))
const hotspots={}
for(const p of pyq.papers){const pack=JSON.parse(readFileSync(join('public/pyq-atlas/v1',p.questions)));for(const q of pack.questions){for(const id of new Set(q.relations.filter(r=>r.quizIncluded&&!['incidental','distractor'].includes(r.semanticRole)).map(r=>r.placeId))){hotspots[id]??={CSE:0,PCS:0,CDS:0};hotspots[id][q.family]++}}}
writeFileSync(join(out,'pyq-hotspots.json'),JSON.stringify({schema:'atlas-pyq-hotspots/v1',canonicalManifestHash:pyq.identity.manifestHash,places:Object.fromEntries(Object.entries(hotspots).sort(([a],[b])=>a.localeCompare(b)))},null,2)+'\n')
const files=[]
const walk=dir=>{for(const name of readdirSync(dir,{withFileTypes:true})){const path=join(dir,name.name);if(name.isDirectory())walk(path);else{const bytes=readFileSync(path),url=path.replaceAll('\\','/').replace(/^public\//,'');files.push({id:url,path:url,version:sha(bytes),bytes:bytes.length,tier:url.startsWith('atlas/v1/india')?'INDIA':'CORE',bundled:true,compatibility:'atlas-data/v2 + atlas-pyq/v1',removable:false})}}}
walk('public/atlas/v1');walk('public/pyq-atlas/v1');walk(out)
// Exclude this manifest from its own content identity.
const assets=files.filter(f=>f.path!=='atlas-assets/v1/manifest.json').sort((a,b)=>a.id.localeCompare(b.id))

const manifest={schema:'tars-atlas-assets/v1',version:sha(JSON.stringify(assets)),renderer:'tars-svg/v1',indiaBoundaryPolicy:'Official Survey of India outline is separately bundled and precached with archive provenance. Baseline physical Atlas sheets, projection and cartography remain unchanged.',tiers:{CORE:{policy:'Always bundled and precached. Complete curated study data and world context.'},INDIA:{policy:'Bundled India vectors, overlays, relief and official outline.'},REGIONAL:{policy:'Optional verified packs only; none published.',packs:[]},ONLINE:{policy:'No online map provider.',cacheBudgetBytes:0}},assets,totalBytes:assets.reduce((n,a)=>n+a.bytes,0)}
writeFileSync(join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n')
console.log('Atlas assets: '+assets.length+' files, '+manifest.totalBytes+' bytes')
