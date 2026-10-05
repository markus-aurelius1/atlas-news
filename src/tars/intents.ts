/** Conservative natural commands produce structured proposals. Ambiguous names remain search results. */
import type { Place } from '@/atlas/types'
import type { ActionId, ActionInputs } from './registry'
import type { TarsContext } from './context'
export interface Intent { action:ActionId; input:ActionInputs[ActionId]; title:string }
export const normalizeName=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()
/** An unresolved exact place name needs an explicit choice, including in the palette. */
export function ambiguousPlaceRequest(text:string,places:Place[]) {
  const open=text.trim().match(/^(?:open|show|find)\s+(.+)$/i)
  if(!open)return false
  const name=normalizeName(open[1])
  return places.filter(p=>[p.id,p.name,...(p.aka??[])].some(alias=>normalizeName(alias)===name)).length>1
}
export function parseIntent(text:string,_c:TarsContext,places:Place[]=[]):Intent|null {
  const q=text.trim(), n=normalizeName(q)
  if(/^review (?:places |atlas )?due(?: today)?$/.test(n)||n==='review places due today')return {action:'review.startDue',input:{},title:'Review places due today'}
  const pyq=n.match(/^show (cse|pcs|cds) questions(?: for (.+))?$/)
  if(pyq){const kinds:Record<string,string>={straits:'strait',strait:'strait',rivers:'river',parks:'park',islands:'island',passes:'pass',cities:'city',lakes:'lake',countries:'country',states:'state'};if(pyq[2]&&!kinds[pyq[2]])return null;return {action:'pyq.reviewForPlace',input:{family:pyq[1].toUpperCase() as 'CSE'|'PCS'|'CDS',...(pyq[2]?{kind:kinds[pyq[2]]}:{})},title:`Show ${pyq[1].toUpperCase()} questions${pyq[2]?` for ${pyq[2]}`:''}`}}
  const year=n.match(/^show places from (\d{4}) (cse|pcs|cds)$/)
  if(year)return {action:'pyq.reviewForPlace',input:{year:Number(year[1]),family:year[2].toUpperCase() as 'CSE'|'PCS'|'CDS',mode:'places'},title:`Places from ${year[1]} ${year[2].toUpperCase()}`}
  const open=q.match(/^(?:open|show|find)\s+(.+)$/i)
  if(open){const name=normalizeName(open[1]);const matches=places.filter(p=>[p.id,p.name,...(p.aka??[])].some(alias=>normalizeName(alias)===name));if(matches.length===1)return {action:'atlas.openPlace',input:{placeId:matches[0].id},title:`Open ${matches[0].name}`}}
  return null
}
export const searchScore=(text:string,query:string)=>{
  const t=normalizeName(text),words=normalizeName(query).split(' ').filter(Boolean)
  if(!words.length)return 0
  if(words.some(w=>!t.includes(w)))return 0
  return words.reduce((s,w)=>s+(t===w?8:t.startsWith(w)?4:t.includes(' '+w)?2:1),0)
}
