/** The only command execution boundary. Unknown, malformed or unavailable actions never reach runtime effects. */
import type { TarsContext } from './context'
export interface ActionInputs {
  'atlas.open': Record<string,never>
  'atlas.openPlace': { placeId: string }
  'atlas.search': { query: string }
  'atlas.reviewPlace': { placeId: string }
  'pyq.open': { questionId: string }
  'pyq.reviewForPlace': { placeId?: string; family?: 'CSE' | 'PCS' | 'CDS'; year?: number; kind?: string; mode?: 'questions' | 'places' }
  'review.startDue': Record<string,never>
  'settings.open': Record<string,never>
  'navigation.open': { route: 'atlas' | 'settings' | 'current-affairs' }
  'appearance.theme': { theme: 'light' | 'dark' | 'system' }
  'ui.open': { surface: 'sidebar' | 'shortcuts' | 'atlasFullscreen' }
}
export type ActionId = keyof ActionInputs
export interface ActionResult { ok: boolean; message?: string; code?: 'unknown-action' | 'invalid-input' | 'unavailable' | 'failed' }
export interface TarsAction { id: ActionId; title: string; keywords: string[]; availability: (c:TarsContext)=>boolean }
const always = () => true
const titles: Record<ActionId,string> = {'atlas.open':'Atlas','atlas.openPlace':'Open place','atlas.search':'Search Atlas','atlas.reviewPlace':'Test this place','pyq.open':'Open canonical PYQ','pyq.reviewForPlace':'Previous questions','review.startDue':'Review places due today','settings.open':'Settings','navigation.open':'Go to','appearance.theme':'Theme','ui.open':'Open controls'}
export const actions: TarsAction[] = (Object.keys(titles) as ActionId[]).map(id=>({id,title:titles[id],keywords:id.split('.'),availability:id==='review.startDue'?c=>c.dueReviews.length>0:always}))
const fields: Record<ActionId,string[]> = {'atlas.open':[],'atlas.openPlace':['placeId'],'atlas.search':['query'],'atlas.reviewPlace':['placeId'],'pyq.open':['questionId'],'pyq.reviewForPlace':['placeId','family','year','kind','mode'],'review.startDue':[],'settings.open':[],'navigation.open':['route'],'appearance.theme':['theme'],'ui.open':['surface']}
const string = (v:unknown) => typeof v==='string' && !!v.trim() && v.length<=500
export function validateActionInput(id: ActionId, raw:unknown): boolean {
  if (!raw || typeof raw!=='object' || Array.isArray(raw) || ![Object.prototype,null].includes(Object.getPrototypeOf(raw))) return false
  const p=raw as Record<string,unknown>
  if (Object.keys(p).some(k=>!fields[id].includes(k))) return false
  if (Object.entries(p).some(([k,v])=> !['year'].includes(k) && !string(v))) return false
  if (p.year!==undefined && (typeof p.year!=='number' || !Number.isInteger(p.year) || p.year<1900 || p.year>2100)) return false
  if (p.family!==undefined && !['CSE','PCS','CDS'].includes(p.family as string)) return false
  if (p.mode!==undefined && !['questions','places'].includes(p.mode as string)) return false
  if (id==='navigation.open' && !['atlas','settings','current-affairs'].includes(p.route as string)) return false
  if (id==='appearance.theme' && !['light','dark','system'].includes(p.theme as string)) return false
  if (id==='ui.open' && !['sidebar','shortcuts','atlasFullscreen'].includes(p.surface as string)) return false
  const required: Partial<Record<ActionId,string[]>> = {'atlas.openPlace':['placeId'],'atlas.reviewPlace':['placeId'],'atlas.search':['query'],'pyq.open':['questionId'],'navigation.open':['route'],'appearance.theme':['theme'],'ui.open':['surface']}
  return (required[id] ?? []).every(k=>string(p[k]))
}
export function createActionRegistry(context:()=>TarsContext, run:(id:ActionId,input:Record<string,unknown>,context:TarsContext)=>Promise<ActionResult>|ActionResult) {
  return { actions, async execute(id:string,raw:unknown={}):Promise<ActionResult> {
    const action=actions.find(a=>a.id===id)
    if (!action) return {ok:false,code:'unknown-action',message:'Unknown action'}
    try {
      if (!validateActionInput(action.id,raw)) return {ok:false,code:'invalid-input',message:'Check the action details'}
      const input = Object.fromEntries(Object.entries(raw as Record<string,unknown>))
      const c=context()
      if (!action.availability(c)) return {ok:false,code:'unavailable',message:'This action is unavailable right now'}
      return await run(action.id,input,c)
    } catch { return {ok:false,code:'failed',message:'The action couldn’t finish. Try again.'} }
  } }
}
