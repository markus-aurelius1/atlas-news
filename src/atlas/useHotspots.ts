/** Tiny build-derived PYQ metadata; never loads question packs merely to decorate the map. */
import { useEffect, useState } from 'react'
let ids:ReadonlySet<string>|null=null
let pending:Promise<ReadonlySet<string>>|null=null
export function useHotspots(enabled:boolean) {
  const [value,setValue]=useState(ids)
  useEffect(()=>{if(!enabled)return;let live=true;pending??=fetch(`${import.meta.env.BASE_URL}atlas-assets/v1/pyq-hotspots.json`).then(r=>{if(!r.ok)throw new Error('Hotspots unavailable');return r.json()}).then(m=>ids=new Set(Object.keys(m.places)));pending.then(v=>{if(live)setValue(v)}).catch(()=>{pending=null});return()=>{live=false}},[enabled])
  return enabled?value:undefined
}
