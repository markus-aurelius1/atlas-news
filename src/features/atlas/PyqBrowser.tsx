/** Curated question catalogue, opened explicitly; only matching paper packs are requested. */
import { useEffect, useState } from 'react'
import type { AtlasData } from '@/atlas/data'
import { getPyqCatalog } from '@/atlas/pyq/catalog'
import { loadAtlasPyqPaper } from '@/atlas/pyq/loaders'
import { matchesPyq, type PyqFilter } from '@/atlas/pyq/browse'
import { meaningfulRelations } from '@/atlas/pyq/experience'
import type { AtlasPyqQuestion } from '@/atlas/pyq/types'
import { Sheet } from '@/ui/Sheet'
import { Select, Button } from '@/ui/controls'
export function PyqBrowser({filter,atlas,onClose,onOpen,onPlace}:{filter:PyqFilter|null;atlas:AtlasData;onClose:()=>void;onOpen:(id:string)=>void;onPlace:(id:string)=>void}) {
  return <Sheet open={!!filter} onClose={onClose} title="Previous questions" subtitle="149 curated Atlas questions · CDS is enrichment evidence" size="lg">{filter&&<Browse key={JSON.stringify(filter)} initial={filter} atlas={atlas} onOpen={onOpen} onPlace={onPlace}/>}</Sheet>
}
function Browse({initial,atlas,onOpen,onPlace}:{initial:PyqFilter;atlas:AtlasData;onOpen:(id:string)=>void;onPlace:(id:string)=>void}) {
  const [filter,setFilter]=useState<PyqFilter>({...initial,family:initial.family??(initial.placeId?'':'CSE')})
  const [questions,setQuestions]=useState<AtlasPyqQuestion[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(false),[retry,setRetry]=useState(0),[years,setYears]=useState<number[]>([])
  useEffect(()=>{let live=true;setLoading(true);setError(false);void(async()=>{
    const {manifest,index}=await getPyqCatalog()
    if(live)setYears([...new Set(manifest.papers.map(p=>p.year))].sort((a,b)=>b-a))
    const ids=filter.placeId ? new Set(index.places[filter.placeId]?.questionIds??[]) : null
    const entries=manifest.papers.filter(p=>(!filter.family||p.family===filter.family)&&(!filter.year||p.year===filter.year)&&(!ids||[...ids].some(id=>id.startsWith(p.paperId+'-Q'))))
    const packs=await Promise.all(entries.map(p=>loadAtlasPyqPaper(manifest,p.paperId)))
    if(live)setQuestions(packs.flatMap(p=>p.paper.questions).filter(q=>matchesPyq(q,filter,atlas)).sort((a,b)=>b.exam.year-a.exam.year||a.id.localeCompare(b.id)))
  })().catch(()=>{if(live)setError(true)}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[filter,atlas,retry])
  const mapped=[...new Set(questions.flatMap(q=>meaningfulRelations(q.relations).map(r=>r.placeId)))].map(id=>atlas.byId.get(id)).filter(p=>!!p).sort((a,b)=>a.name.localeCompare(b.name))
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2">
      <label className="min-w-32 flex-1 text-xs font-semibold">Exam<Select aria-label="Question exam" value={filter.family??''} onChange={e=>setFilter({...filter,family:e.target.value})}><option value="">All exams</option>{['CSE','PCS','CDS'].map(f=><option key={f}>{f}</option>)}</Select></label>
      <label className="min-w-32 flex-1 text-xs font-semibold">Year<Select aria-label="Question year" value={filter.year??''} onChange={e=>setFilter({...filter,year:e.target.value?Number(e.target.value):undefined})}><option value="">All years</option>{years.map(y=><option key={y}>{y}</option>)}</Select></label>
      <label className="min-w-32 flex-1 text-xs font-semibold">Show<Select aria-label="Catalogue view" value={filter.mode??'questions'} onChange={e=>setFilter({...filter,mode:e.target.value})}><option value="questions">Questions</option><option value="places">Mapped places</option></Select></label>
    </div>
    {filter.placeId&&<p className="text-sm text-ink-2">{atlas.byId.get(filter.placeId)?.name}</p>}
    {filter.kind&&<p className="text-sm text-ink-2">Geographic type: {filter.kind}</p>}
    {loading?<p role="status">Loading curated questions…</p>:error?<div role="alert"><p>These question packs couldn’t load. Try again after the offline download finishes.</p><Button onClick={()=>setRetry(r=>r+1)}>Retry</Button></div>:<>
      <p className="text-xs font-semibold text-ink-2">{questions.length} questions · {mapped.length} meaningful mapped places</p>
      {filter.mode==='places'?<ul className="divide-y divide-line">{mapped.map(p=><li key={p.id}><button type="button" onClick={()=>onPlace(p.id)} className="w-full py-3 text-left hover:text-accent"><b>{p.name}</b><span className="ml-2 text-xs text-ink-2">{p.subtitle??p.kind}</span></button></li>)}</ul>:<ul className="divide-y divide-line">{questions.map(q=><li key={q.id}><button type="button" onClick={()=>onOpen(q.id)} className="w-full py-4 text-left hover:text-accent"><span className="block text-xs font-bold text-ink-3">{q.family} · {q.exam.year}{q.exam.cycle?` · ${q.exam.cycle}`:''} · Q{q.question.number}</span><span className="mt-1 block text-sm leading-relaxed">{q.question.content.find(b=>b.type==='paragraph')?.text??`${q.question.type} question`}</span></button></li>)}</ul>}
      {!questions.length&&<p className="py-6 text-sm text-ink-2">No curated questions match these filters.</p>}
    </>}
  </div>
}
