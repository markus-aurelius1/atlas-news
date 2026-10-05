/** Registry safety and retained Atlas commands after product reduction. */
import { describe,it,expect,vi } from 'vitest'
import { deriveContext,suggestActions } from './context'
import { createActionRegistry,validateActionInput,actions } from './registry'
import { ambiguousPlaceRequest,parseIntent } from './intents'
import type { Place } from '@/atlas/types'
const context=deriveContext({route:'atlas',today:'2026-10-03',exploration:null})
const nathu={id:'in.pass.nathu-la',name:'Nathu La',aka:['Nathula'],kind:'pass'} as Place
describe('Tars actions',()=>{

  it('validates retained inputs and refuses malformed filters',async()=>{
    const run=vi.fn(()=>({ok:true})), registry=createActionRegistry(()=>context,run)
    for(const [id,p] of [['unknown',{}],['atlas.openPlace',{}],['atlas.search',{query:'',sql:'erase'}],['appearance.theme',{theme:'neon'}],['pyq.reviewForPlace',{year:NaN}]]) expect((await registry.execute(id as string,p)).ok).toBe(false)
    expect(run).not.toHaveBeenCalled()
    expect(validateActionInput('pyq.reviewForPlace',{family:'CSE',year:2024,mode:'places'})).toBe(true)
    expect(validateActionInput('pyq.reviewForPlace',{family:'UPSC-CSE'})).toBe(false)
    expect(validateActionInput('navigation.open',{route:'current-affairs'})).toBe(true)
  })
  it('rechecks due-review availability and reports failed effects',async()=>{
    let c=context
    const run=vi.fn(()=>({ok:true})), registry=createActionRegistry(()=>c,run)
    expect((await registry.execute('review.startDue',{})).code).toBe('unavailable')
    c={...context,dueReviews:[nathu.id]}
    expect((await registry.execute('review.startDue',{})).ok).toBe(true)
    expect((await createActionRegistry(()=>c,()=>{throw Error('denied')}).execute('atlas.open',{})).code).toBe('failed')
    expect(actions.some(a=>a.id==='atlas.reviewPlace')).toBe(true)
  })
})
describe('Atlas intents and selection',()=>{
  it('retains place aliases, PYQ filters and due reviews',()=>{
    expect(parseIntent('Open Nathula',context,[nathu])?.input).toEqual({placeId:nathu.id})
    expect(parseIntent('Show CSE questions for straits',context)?.input).toEqual({family:'CSE',kind:'strait'})
    expect(parseIntent('Show places from 2024 CSE',context)?.input).toEqual({family:'CSE',year:2024,mode:'places'})
    expect(parseIntent('Review places due today',context)?.action).toBe('review.startDue')
    expect(parseIntent('Show CSE questions for legislatures',context)).toBeNull()
  })

  it('requires a choice for ambiguous names',()=>{
    const places=[nathu,{...nathu,id:'other'}]
    expect(ambiguousPlaceRequest('Open Nathu La',places)).toBe(true)
    expect(parseIntent('Open Nathu La',context,places)).toBeNull()
  })
  it('exposes selection only on Atlas and offers questions without awarding progress',()=>{
    const c=deriveContext({route:'current-affairs',today:context.today,exploration:null,selectedPlace:nathu.id,selectedPyq:'q'})
    expect(c.selectedPlace).toBeNull();expect(c.selectedPyq).toBeNull()
    expect(suggestActions(c)).toEqual([])
    expect(suggestActions({...context,selectedPlace:nathu.id})[0].input).toEqual({placeId:nathu.id})
  })
})
