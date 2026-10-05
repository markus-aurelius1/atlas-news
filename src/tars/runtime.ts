/** Validated Atlas, News and shared shell actions. */
import { updateSettings } from '@/data/hooks'
import { useUi } from '@/app/ui-store'
import { navigate } from '@/app/router'
import { toast } from '@/ui/toast'
import { createActionRegistry, type ActionInputs, type ActionId, type ActionResult } from './registry'
import { currentContext } from './useContext'
const ok:ActionResult={ok:true}
const missing=(name:string):ActionResult=>({ok:false,code:'invalid-input',message:name+' is unavailable'})
const query=(values:Record<string,unknown>)=>new URLSearchParams(Object.entries(values).filter(([,v])=>v!==undefined&&v!==null).map(([k,v])=>[k,String(v)])).toString()
const registry=createActionRegistry(currentContext,async(id,p)=>{
  const ui=useUi.getState()
  switch(id) {
    case 'atlas.open':navigate('#/atlas');return ok
    case 'atlas.openPlace':case 'atlas.reviewPlace':case 'pyq.reviewForPlace': {
      const {loadAtlas}=await import('@/atlas/data');const atlas=await loadAtlas()
      if(p.placeId&&!atlas.byId.has(String(p.placeId)))return missing('Place')
      if(id==='pyq.reviewForPlace')navigate(`#/atlas?questions=1&${query(p)}`)
      else navigate(`#/atlas?${query({place:p.placeId,...(id==='atlas.reviewPlace'?{test:p.placeId}:{})})}`)
      return ok
    }
    case 'atlas.search':navigate(`#/atlas?search=${encodeURIComponent(String(p.query))}`);return ok
    case 'pyq.open': {
      const {getPyqCatalog,getPyqQuestion}=await import('@/atlas/pyq/catalog');const {manifest}=await getPyqCatalog()
      await getPyqQuestion(String(p.questionId),manifest);navigate(`#/atlas?pyq=${encodeURIComponent(String(p.questionId))}`);return ok
    }
    case 'review.startDue':navigate('#/atlas?review=1');return ok
    case 'settings.open':navigate('#/settings');return ok
    case 'navigation.open':navigate('#/'+p.route);return ok
    case 'appearance.theme':await updateSettings({theme:p.theme as 'light'|'dark'|'system'});return ok
    case 'ui.open': {
      if(p.surface==='sidebar')ui.toggleSidebar()
      else if(p.surface==='atlasFullscreen')window.dispatchEvent(new CustomEvent('tars:atlas-fullscreen'))
      else ui.set({ shortcutsOpen:true })
      return ok
    }
  }
})
export async function executeAction<K extends ActionId>(id:K,input:ActionInputs[K]) {
  const result=await registry.execute(id,input)
  if(!result.ok)toast({title:result.message??'Action unavailable'})
  return result
}
/** Open-language clients may call this after proposing a structured action. The same validator always runs. */
export const executeProposal=(id:string,input:unknown)=>registry.execute(id,input)
