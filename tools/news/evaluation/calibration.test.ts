/** Synthetic selection-contract tests only; never human gold. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { selectCalibration,verifiedRequestedAuthors } from './calibration.ts'
import type { CalibrationRecord } from './calibration.ts'
import { EMPTY_LABELS } from './contracts.ts'
const clock='2026-10-07T13:40:55.600Z'
function fixture(){
 const records=Array.from({length:70},(_,i)=>({id:'synthetic:'+String(i).padStart(3,'0'),partition:i%4?'development':'validation',metadataObservationId:'obs:'+i,observations:[],observedFeeds:[],revisions:[],metadata:{url:'https://example.test/'+i,title:'Synthetic article '+i,description:i%2?'Synthetic description':'',publisher:i%3===0?'Indian Express':i%3===1?'The Hindu':'Synthetic publisher '+i,memberships:[{sourceId:'synthetic:'+i%8,feedUrl:'https://example.test/feed/'+i%8,section:i%4===0?'Opinion':'News'}],categories:[],bylines:i<8?[{name:i<3?'Pratap Bhanu Mehta':'C. Raja Mohan',provenance:'rss:dc:creator'}]:[],publishedAt:clock,updatedAt:null},annotation:{reviewerId:null,reviewedAt:null,rubricVersion:'synthetic',disposition:null,labels:structuredClone(EMPTY_LABELS),evidence:[]}})) as CalibrationRecord[]
 const tags=['ie_explained','ie_upsc','science','environment','security_terms','ir_terms','economy','institution_terms','party_terms','foreign_domestic_terms','single_source']
 const sampling={entries:records.map((r,i)=>({id:r.id,coverageTags:[tags[i%tags.length]],sampling:{panel:i%2?'representative':'coverage'}}))}
 const temporal={equivalentCandidates:[0,1,2].map(i=>({candidateId:'synthetic-group:'+i,articleIds:records.slice(8+i*2,10+i*2).map(r=>r.id)})),sequences:[{candidateId:'synthetic-theme',constraint:'synthetic',articleIds:records.slice(14,22).map(r=>r.id)}],analyticalArticleIds:records.filter((_,i)=>i%2===0).map(r=>r.id)}
 return {records,sampling,temporal}
}
test('50 original identities; requested-author census; blank labels and parent inputs untouched',()=>{
 const f=fixture(),before=JSON.stringify(f),s=selectCalibration(f.records,f.sampling,f.temporal,clock)
 assert.equal(s.ids.length,50);assert.equal(new Set(s.ids).size,50);assert.equal(s.requestedAuthors.length,8)
 assert.ok(f.records.slice(0,8).every(r=>s.ids.includes(r.id)));assert.ok(s.records.every(r=>f.records.includes(r)))
 assert.equal(JSON.stringify(f),before);assert.ok(s.records.every(r=>r.annotation.labels.value===null));assert.equal(s.groupCoverage.length,3)
})
test('selection ignores prediction/prestige root fields and input ordering',()=>{
 const f=fixture(),first=selectCalibration(f.records,f.sampling,f.temporal,clock)
 const poisoned=f.records.map((r,i)=>({...r,v2Score:i,accepted:i%2===0,ownerCuratedPositive:i%3===0,predictedSubject:'invented'})).reverse()
 const again=selectCalibration(poisoned,{entries:[...f.sampling.entries].reverse()},{...f.temporal,equivalentCandidates:[...f.temporal.equivalentCandidates].reverse(),sequences:[...f.temporal.sequences].reverse()},clock)
 assert.deepEqual(again.ids,first.ids)
})
test('requested authors require exact normalized legitimate bylines; absent metadata is never guessed',()=>{
 const {records}=fixture(),r=structuredClone(records[0]);r.metadata.bylines=[{name:'Aanya Mehta',provenance:'rss:dc:creator'}]
 assert.deepEqual(verifiedRequestedAuthors(r),[]);r.metadata.bylines=[];r.metadata.title='Pratap Bhanu Mehta says something';assert.deepEqual(verifiedRequestedAuthors(r),[])
 assert.throws(()=>selectCalibration(records.slice(0,49),{entries:[]},{equivalentCandidates:[],sequences:[],analyticalArticleIds:[]},clock),/50 unique/)
})
