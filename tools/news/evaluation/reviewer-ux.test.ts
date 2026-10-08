/** UI serialization and unchanged schema tests; fixtures never enter the natural corpus. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { runInNewContext } from 'node:vm'
import { reviewerSchemaAssets } from './reviewer-schema.ts'
import { reviewerHtml } from './reviewer-ui.ts'
import { EMPTY_LABELS } from './contracts.ts'
const metadata={url:'https://example.test/fixture',title:'Synthetic </script><script>unsafe()</script> title',description:'Synthetic description',publisher:'Synthetic publisher',memberships:[],categories:[],bylines:[],publishedAt:null,updatedAt:null}
const record={id:'synthetic-id',partition:'development',metadata,metadataObservationId:'obs:synthetic',observedFeeds:[],observations:[{id:'obs:synthetic',capturedAt:'2026-10-07T13:00:00.000Z',metadataHash:'synthetic'}],revisions:[{metadata,observationIds:['obs:synthetic']}],annotation:{reviewerId:null,reviewedAt:null,rubricVersion:'synthetic-rubric',disposition:null,labels:structuredClone(EMPTY_LABELS),evidence:[]}}
test('renderer strips forbidden root fields, escapes metadata scripts and provides no JSON editor',()=>{
 const html=reviewerHtml([{...record,score:987654,expectedAnswer:'machine-secret-answer',ownerCuratedPositive:'machine-secret-owner'}])
 assert.ok(!html.includes('987654')&&!html.includes('machine-secret-answer')&&!html.includes('machine-secret-owner'))
 assert.ok(!html.includes('</script><script>unsafe()'))
 assert.ok(html.includes('Technical details')&&html.includes('Advanced / story analysis'))
 assert.ok(!html.includes('id="answer"'))
 assert.ok(html.includes("connect-src 'none'"))
})
test('serialized blank annotations remain byte-equivalent labels with no sufficient or novelty default',()=>{
 const html=reviewerHtml([record]),payload=JSON.parse(html.match(/id="data">([^]*?)<\/script>/)![1])
 assert.deepEqual(payload[0].annotation.labels,EMPTY_LABELS)
 assert.equal(payload[0].annotation.labels.metadataSufficiency,null);assert.equal(payload[0].annotation.labels.novelty,null)
 assert.ok(!html.includes('<details id="technical" open')&&!html.includes('<details id="advanced" open'))
})
test('offline standalone validator uses unchanged canonical label vocabulary and closed evidence schema',()=>{
 const assets=reviewerSchemaAssets(),validate=runInNewContext(assets.validator+';validateAnnotationShape')
 const annotation={reviewerId:'synthetic',reviewedAt:'2026-10-07T13:00:00.000Z',rubricVersion:'synthetic',labels:{...structuredClone(EMPTY_LABELS)},evidence:[{observationId:'obs:synthetic',field:'title',start:0,end:1}]}
 assert.equal(validate(annotation),true)
 assert.equal(validate({...annotation,labels:{...annotation.labels,contentType:'invented'}}),false)
 assert.equal(validate({...annotation,labels:{...annotation.labels,value:'must_read'}}),false)
 assert.equal(validate({...annotation,labels:{...annotation.labels,value:'reject',rejectReasons:['other']}}),true)
 assert.equal(validate({...annotation,articleBody:'forbidden'}),false)
 assert.equal(validate({...annotation,evidence:[annotation.evidence[0],annotation.evidence[0]]}),false)
 assert.deepEqual(assets.vocabulary.scopes,['india_domestic','india_impact','global_knowledge','global_systemic','foreign_domestic_no_impact','unknown'])
 assert.ok(!assets.validator.includes('require('))
})
