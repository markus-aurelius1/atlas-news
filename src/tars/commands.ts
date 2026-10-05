/** Search, deterministic intents and contextual ranking all produce registry actions. */
import { useMemo } from 'react'
import { CheckCircle2, Expand, Keyboard, Map as MapIcon, Moon, Newspaper, Settings2, Sun, SunMoon, Target, Undo2, type LucideIcon } from 'lucide-react'
import { useSettings } from '@/data/hooks'
import { useAtlas } from '@/atlas/data'
import { currentUndoable, toast, undoLast, useToasts } from '@/ui/toast'
import { ambiguousPlaceRequest, parseIntent, searchScore } from './intents'
import { suggestActions } from './context'
import { actions, type ActionId } from './registry'
import { executeProposal } from './runtime'
import { useTarsContext } from './useContext'
/** The commands a learner ran most recently, newest first – offered again when the palette opens. */
const RECENT_KEY='tars.palette.recent'
const RECENT_MAX=4
export function recentCommands():string[] {
  try { const v=JSON.parse(localStorage.getItem(RECENT_KEY)??'[]'); return Array.isArray(v)?v.filter((x):x is string=>typeof x==='string').slice(0,RECENT_MAX):[] } catch { return [] }
}
/** Only the fixed commands are remembered: a search hit or a suggestion is for that moment. */
export function rememberCommand(id:string):void {
  if(/^(context-|place-|recent-|intent$|undo$)/.test(id))return
  try { localStorage.setItem(RECENT_KEY,JSON.stringify([id,...recentCommands().filter(x=>x!==id)].slice(0,RECENT_MAX))) } catch { /* storage unavailable */ }
}
export interface Command { id:string;section:string;label:string;hint?:string;keywords?:string;icon:LucideIcon;keys?:string;requiresChoice?:boolean;run:()=>void|Promise<void> }
export function useCommands(query:string):Command[] {
  const context=useTarsContext(),settings=useSettings(),atlas=useAtlas(),undoable=useToasts(s=>s.undoable)
  return useMemo(()=>{
    const command=(id:string,label:string,action:ActionId,input:Record<string,unknown>={},section='Go to',icon:LucideIcon=Target,hint?:string,keywords?:string):Command=>({id,label,section,icon,hint,keywords,run:async()=>{const r=await executeProposal(action,input);if(!r.ok)toast({title:r.message??'Action unavailable'})}})
    const base:Command[]=[
      command('go-atlas','Atlas','atlas.open',{},'Go to',MapIcon,'Freely explore every place','map geography'),
      command('go-pyq','Previous questions','pyq.reviewForPlace',{},'Atlas',CheckCircle2,'149 curated canonical questions','pyq cse pcs cds'),
      command('go-news','News','navigation.open',{route:'current-affairs'},'Go to',Newspaper,'Curated publisher links','news current affairs'),
      command('go-settings','Settings','settings.open',{},'Go to',Settings2,'Preferences'),
      ...(context.route==='atlas'?[command('atlas-full','Full-screen map','ui.open',{surface:'atlasFullscreen'},'Atlas',Expand)]:[]),
      command('theme-light','Theme: Ivory Atlas (Light)','appearance.theme',{theme:'light'},'Appearance',Sun,undefined,'light mode theme'),
      command('theme-dark','Theme: Midnight Atlas (Dark)','appearance.theme',{theme:'dark'},'Appearance',Moon,undefined,'dark mode theme'),
      command('theme-auto','Theme: System','appearance.theme',{theme:'system'},'Appearance',SunMoon,'Follow the system'),
      command('shortcuts','Keyboard shortcuts','ui.open',{surface:'shortcuts'},'Help',Keyboard),
    ]
    const q=query.trim()
    // The last thing that offered Undo can still be taken back from here after its toast has gone.
    const pending=undoable&&currentUndoable()
    const undo:Command[]=pending?[{id:'undo',section:'Undo',label:'Undo: '+pending.title,hint:'Take back the last action',keywords:'undo revert restore',icon:Undo2,run:()=>{undoLast()}}]:[]
    const recent=recentCommands().map(id=>base.find(c=>c.id===id)).filter((c):c is Command=>!!c).map(c=>({...c,id:'recent-'+c.id,section:'Recent'}))
    if(!q)return [...undo,...suggestActions(context).map((s,i)=>command('context-'+i,s.title,s.action as ActionId,s.input,'Next',Target)),...recent,...base.filter(c=>c.section!=='Appearance'||c.id==='theme-'+(settings.theme==='dark'?'light':'dark'))]
    const intent=parseIntent(q,context,atlas?.places??[])
    const ambiguousPlace=!intent&&ambiguousPlaceRequest(q,atlas?.places??[])
    const proposal=intent&&actions.find(a=>a.id===intent.action)?.availability(context)?[command('intent',intent.title,intent.action,intent.input as Record<string,unknown>,'Command',Target,'Run this action')]:[]
    const search=q.replace(/^(?:open|show|find)\s+/i,'')
    const placeHits=(atlas?.places??[]).map(p=>({p,s:searchScore([p.name,...(p.aka??[])].join(' '),search)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s||a.p.id.localeCompare(b.p.id)).slice(0,6).map(({p})=>command('place-'+p.id,p.name,'atlas.openPlace',{placeId:p.id},'Places',MapIcon,p.subtitle??p.kind))
    const matches=base.map(c=>({c,s:searchScore(c.label+' '+(c.keywords??''),q)})).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).map(x=>x.c)
    const undoHit=undo.filter(c=>searchScore(c.label+' '+c.keywords,q)>0)
    return [...proposal,...undoHit,...placeHits,...matches].map(c=>ambiguousPlace?{...c,requiresChoice:true,section:c.section==='Places'?'Choose a place':c.section}:c)
  },[query,context,settings.theme,atlas,undoable])
}
