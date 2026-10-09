/** Deterministic metadata-only sampling; prediction-free reviewer assets. */
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
const read = p => JSON.parse(readFileSync(p, 'utf8'))
const hash = s => createHash('sha256').update(s).digest('hex')
const root = 'docs/release-candidate', out = root + '/blind-review-v2'
const source = read('tools/news/evaluation/calibration-gold-v1/provenance.json').sourcePackage
const seed = 'tars-rc-blind-2026-10-09/2', clock = read(source + '/versions.json').clock
const old = [...read('docs/owner-validation-v1/owner-review.original.json').records, ...read('tools/news/evaluation/calibration-gold-v1/gold.json').records, ...read(source + '/owner-exemplars/corpus.json').entries]
const excludedIds = new Set(old.map(r => r.id)), excludedUrls = new Set(old.map(r => r.metadata?.url ?? r.record?.metadata?.url ?? r.url).filter(Boolean))
const sourceRows = read(source + '/corpus.json')
const rows = sourceRows.filter(r => !excludedIds.has(r.id) && !excludedUrls.has(r.metadata.url) && r.review.status === 'unreviewed' && !r.review.annotations.length)
const baseline = read(root + '/baseline.json').historical1000
const decisionStrata = new Map(baseline.decisions.map(r=>[r.url,r.decision]))
const tokens = r => new Set(r.metadata.title.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter(t => t.length > 3 && !new Set('with from that this after before india indian news says more over into amid today latest live updates'.split(' ')).has(t)))
const similarity = (a, b) => { const aa = tokens(a), bb = tokens(b); return [...aa].filter(t => bb.has(t)).length / (new Set([...aa, ...bb]).size || 1) }
function strata(r) {
  const m = r.metadata, section = m.memberships.map(m => m.section).join(' ')
  const type = /opinion|column|editorial|analysis/i.test(section) ? 'analysis' : /explain/i.test(section) ? 'explainer' : /digest|roundup|live updates/i.test(m.title) ? 'digest' : 'report'
  const age = m.publishedAt ? Date.parse(clock) - Date.parse(m.publishedAt) : null
  const freshness = age == null ? 'undated' : age < 0 ? 'future' : age <= 86400000 ? '24h' : age <= 604800000 ? '7d' : 'older'
  const subject = /econom|business|financ/i.test(section) ? 'economy' : /science|tech/i.test(section) ? 'science' : /environment/i.test(section) ? 'environment' : /world|international/i.test(section) ? 'international' : /governance|law|polity/i.test(section) ? 'institutions' : /sport|entertainment|lifestyle/i.test(section) ? 'other' : 'general'
  return { publisher: m.publisher, subjectProxy: subject, freshness, typeProxy: type }
}
function sample(input) {
  const ranked = [...input].sort((a,b) => hash(seed + a.id).localeCompare(hash(seed + b.id)))
  // Natural comparison opportunities use shared headline evidence only, never
  // a machine equivalence decision or a suggested answer.
  const pairs = []
  for (let i = 0; i < ranked.length; i++) for (const b of ranked.slice(i + 1)) {
    const a = ranked[i], score = similarity(a,b)
    if (a.metadata.publisher !== b.metadata.publisher && score >= 0.24 && tokens(a).size >= 4 && tokens(b).size >= 4) pairs.push({ a, b, score, key: hash(seed + [a.id,b.id].sort().join('|')) })
  }
  pairs.sort((a,b) => b.score - a.score || a.key.localeCompare(b.key))
  const chosen = [], used = new Set(), themes = new Set()
  for (const p of pairs) {
    const shared = [...tokens(p.a)].filter(t => tokens(p.b).has(t)).sort().join('|')
    if (used.has(p.a.id) || used.has(p.b.id) || themes.has(shared)) continue
    chosen.push(p); used.add(p.a.id); used.add(p.b.id); themes.add(shared)
    if (chosen.length === 10) break
  }
  assert.equal(chosen.length, 10, 'Insufficient natural pair opportunities')
  const selected = ranked.filter(r => used.has(r.id)), counts = new Map()
  // Diagnostic decision strata come from the already reproduced mandatory
  // parent, before candidate evaluation. These are sampling proxies, not gold.
  // Ensure all eight available unreviewed baseline admissions and six explicit
  // exclusions are reviewed; v1 QA had no admissions and is retained intact.
  for(const [decision,minimum] of [['accepted',8],['rejected',6]]) {
    let count=selected.filter(r=>decisionStrata.get(r.metadata.url)===decision).length
    for(const r of ranked.filter(r=>decisionStrata.get(r.metadata.url)===decision&&!used.has(r.id))){if(count>=minimum)break;selected.push(r);used.add(r.id);count++}
    assert(count>=minimum,'Insufficient baseline decision stratum')
  }
  for (const r of selected) { const key = JSON.stringify(strata(r)); counts.set(key, (counts.get(key) ?? 0) + 1) }
  while (selected.length < 50) {
    const eligible = ranked.filter(r => !used.has(r.id))
    eligible.sort((a,b) => (counts.get(JSON.stringify(strata(a))) ?? 0) - (counts.get(JSON.stringify(strata(b))) ?? 0) || hash(seed+a.id).localeCompare(hash(seed+b.id)))
    const r = eligible[0], key = JSON.stringify(strata(r)); selected.push(r); used.add(r.id); counts.set(key,(counts.get(key)??0)+1)
  }
  return { selected: selected.sort((a,b) => hash(seed+a.id).localeCompare(hash(seed+b.id))), pairs: chosen.map((p,i) => ({ id: 'pair-'+String(i+1).padStart(2,'0'), left: p.a.id, right: p.b.id })) }
}
assert(!existsSync(out), 'Blind sample is frozen; use verify, never overwrite')
const result = sample(rows); assert.deepEqual(sample([...rows].reverse()), result)
mkdirSync(out, { recursive: false })
const safe = { version: 'tars-rc-blind-review/1', clock, seed, records: result.selected.map(r => ({ id:r.id, metadata:r.metadata, observations:r.observationIds })), pairs:result.pairs }
const bytes = JSON.stringify(safe,null,2)+'\n'; writeFileSync(out+'/sample.json',bytes)
const sampleSha256 = hash(bytes)
writeFileSync(root+'/blind-sampling-manifest-v2.json',JSON.stringify({seed,clock,sampleSha256,sourceCorpusSha256:hash(readFileSync(source+'/corpus.json')),baselineOutputHash:baseline.outputHash,excludedIds:[...excludedIds].sort(),excludedUrls:[...excludedUrls].sort(),eligible:rows.length,selected:50,pairs:10,reverseOrderEqual:true,basis:'Natural pair opportunities; mandatory-parent decision strata (eight accepted, minimum six rejected); then least-filled publisher/subject-section-proxy/freshness/type-proxy cells with seeded hash tie-breaks. No candidate decisions used in selection. Parent predictions are sampling proxies, not labels. Enriched diagnostic sample, not statistical production holdout. v1 retained unchanged after sampling QA found no accepted cases.',entries:result.selected.map(r=>({id:r.id,...strata(r),baselineDecisionStratum:decisionStrata.get(r.metadata.url)})),independentMetrics:null},null,2)+'\n')
const json = JSON.stringify({ ...safe, sampleSha256 }).replaceAll('<','\\u003c')
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'none'; img-src 'none'; base-uri 'none'; form-action 'none'"><title>TARS • Independent reading review</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f3ee;color:#232a2a;font:16px/1.6 system-ui}main{max-width:850px;margin:auto;padding:24px}h1{font-size:29px;line-height:1.3}h2{font-size:20px}header{border-bottom:1px solid #ccd0c8;padding-bottom:16px}button,select,input,textarea{font:inherit;border:1px solid #9aa79f;border-radius:7px;background:white;padding:9px;color:inherit}button{cursor:pointer}button:focus-visible,select:focus-visible,textarea:focus-visible{outline:3px solid #426757}button[aria-pressed=true]{background:#284f43;color:white}.toolbar,.choices{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}.card{background:#fff;padding:24px;border:1px solid #d8ddd4;border-radius:12px;margin:20px 0}label{display:block;margin:12px 0}.meta,.hint{font-size:14px;color:#596861}.description{white-space:pre-wrap}.pair{border-top:1px solid #d8ddd4;padding:18px 0}textarea{width:100%;min-height:65px}select{max-width:100%}.primary{background:#284f43;color:white}#status{min-height:24px}@media(max-width:500px){main{padding:14px}.card{padding:16px}h1{font-size:24px}}
</style><main><header><div class="meta">TARS / Independent editorial review</div><h1>One compact reading review</h1><p>50 captured headlines and 10 comparison opportunities. Judge only the supplied metadata. No predictions or suggested labels are shown. Missing descriptions remain missing.</p><p class="hint">This historical sample uses the cutoff shown below. It does not establish current source freshness or multi-day behavior.</p></header><div class="toolbar"><label>Your name <input id="reviewer" autocomplete="name"></label><button id="export">Export offline JSON</button><label>Resume JSON <input id="import" type="file" accept="application/json"></label></div><p id="status" role="status"></p><div class="toolbar"><button id="prev">← Previous</button><span id="progress"></span><button id="next">Next →</button><button id="articles">Articles</button><button id="pairs">Comparisons</button></div><section id="view"></section><p class="hint">Drafts save locally when browser storage is available. Export before moving this file or clearing browser data. Unanswered judgments stay blank. Export records human reviewer identity and timestamps; it never marks an unfinished review complete.</p><details><summary>Sample identity and cutoff</summary><p id="identity"></p></details></main><script id="data" type="application/json">${json}</script><script>
const data=JSON.parse(document.getElementById('data').textContent),key='tars-rc-review:'+data.sampleSha256,byId=new Map(data.records.map(r=>[r.id,r]));
let state={version:'tars-rc-human-review/1',sampleSha256:data.sampleSha256,reviewerId:'',provenance:'independent_human',articles:{},pairs:{},position:0,mode:'articles'};
const el=id=>document.getElementById(id),esc=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
try{const old=localStorage.getItem(key);if(old)state=JSON.parse(old)}catch{el('status').textContent='Local saving unavailable. Export JSON to keep your draft.'}
function save(){try{localStorage.setItem(key,JSON.stringify(state));el('status').textContent='Draft saved on this browser.'}catch{el('status').textContent='Local saving unavailable. Export JSON to keep your draft.'}}
function controls(id,kind,fields){const row=state[kind][id]??{};return fields.map(([field,label,options])=>'<label>'+label+'<select data-id="'+id+'" data-kind="'+kind+'" data-field="'+field+'"><option value="">Choose…</option>'+options.map(v=>'<option '+(row[field]===v?'selected':'')+' value="'+v+'">'+v.replaceAll('_',' ')+'</option>').join('')+'</select></label>').join('')+'<label>Short reason / evidence<textarea data-id="'+id+'" data-kind="'+kind+'" data-field="rationale">'+esc(row.rationale??'')+'</textarea></label>'}
function article(r){const m=r.metadata;return '<div class="meta">'+esc(m.publisher)+' · '+esc(m.memberships.map(m=>m.section).join(', '))+' · '+esc(m.publishedAt??'Publication time unavailable')+'</div><h2>'+esc(m.title)+'</h2><p class="description">'+esc(m.description||'Description unavailable in captured feed metadata.')+'</p><p class="hint">'+esc(m.bylines.map(b=>b.name).join(', ')||'Byline unavailable')+'</p><details><summary>Captured URL and provenance</summary><p>'+esc(m.url)+'</p><p>'+esc(r.id)+'</p></details>'}
function render(){el('reviewer').value=state.reviewerId;el('identity').textContent=data.sampleSha256+' · Cutoff '+data.clock;const list=state.mode==='articles'?data.records:data.pairs;state.position=Math.max(0,Math.min(state.position,list.length-1));const r=list[state.position];const completed=Object.values(state.articles).filter(r=>r.value&&r.subject&&r.sufficiency&&r.rationale?.trim()).length;el('progress').textContent=(state.position+1)+' / '+list.length+' · '+completed+' / 50 articles answered';el('articles').setAttribute('aria-pressed',state.mode==='articles');el('pairs').setAttribute('aria-pressed',state.mode==='pairs');el('view').innerHTML=state.mode==='articles'?'<div class="card">'+article(r)+controls(r.id,'articles',[['value','UPSC value',['must_read','useful','reject','unable_to_judge']],['subject','Primary subject (independent of value)',['Polity','Governance','Economy','International relations','Security','Sci-Tech','Environment','Geography','History & Culture','Unresolved']],['sufficiency','Metadata sufficiency',['sufficient','limited','insufficient']]])+'</div>':'<div class="card"><h2>Compare these reading needs</h2><p class="hint">Shared words do not establish equivalence. Leave uncertain if metadata cannot resolve the comparison.</p><div class="pair">'+article(byId.get(r.left))+'</div><div class="pair">'+article(byId.get(r.right))+'</div>'+controls(r.id,'pairs',[['development','Development relation',['same_development','related_distinct_development','unrelated','uncertain']],['angle','Analytical relation',['equivalent_angle','complementary_valuable_angle','redundant_analysis','uncertain']],['representative','Representative quality',['comparable_quality','left_materially_better','right_materially_better','uncertain']]])+'</div>'}
el('view').addEventListener('change',e=>{const t=e.target;if(!t.dataset.field)return;const {id,kind,field}=t.dataset;const row=state[kind][id]??={};row[field]=t.value||null;row.reviewedAt=new Date().toISOString();save()});
el('reviewer').addEventListener('input',()=>{state.reviewerId=el('reviewer').value;save()});
for(const [id,delta] of [['prev',-1],['next',1]])el(id).onclick=()=>{state.position+=delta;render();save()};for(const id of ['articles','pairs'])el(id).onclick=()=>{state.mode=id;state.position=0;render();save()};
el('export').onclick=()=>{if(!state.reviewerId.trim()){el('status').textContent='Enter your reviewer name before exporting.';return}const complete=data.records.every(r=>{const a=state.articles[r.id];return a?.value&&a.subject&&a.sufficiency&&a.rationale?.trim()})&&data.pairs.every(r=>{const a=state.pairs[r.id];return a?.development&&a.angle&&a.representative&&a.rationale?.trim()});const blob=new Blob([JSON.stringify({...state,exportedAt:new Date().toISOString(),status:complete?'complete':'partial'},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='tars-independent-review.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);el('status').textContent=complete?'Complete review exported.':'Partial draft exported; unanswered labels remain blank.'};
el('import').onchange=async e=>{try{const s=JSON.parse(await e.target.files[0].text());if(s.sampleSha256!==data.sampleSha256||s.version!==state.version||s.provenance!=='independent_human'||!s.articles||!s.pairs||typeof s.reviewerId!=='string')throw Error('Different sample or invalid review');const fields={articles:{value:['must_read','useful','reject','unable_to_judge'],subject:['Polity','Governance','Economy','International relations','Security','Sci-Tech','Environment','Geography','History & Culture','Unresolved'],sufficiency:['sufficient','limited','insufficient']},pairs:{development:['same_development','related_distinct_development','unrelated','uncertain'],angle:['equivalent_angle','complementary_valuable_angle','redundant_analysis','uncertain'],representative:['comparable_quality','left_materially_better','right_materially_better','uncertain']}};for(const kind of ['articles','pairs'])for(const [id,row] of Object.entries(s[kind])){if(!(kind==='articles'?byId.has(id):data.pairs.some(p=>p.id===id)))throw Error('Unknown review identity');for(const [f,values] of Object.entries(fields[kind]))if(row[f]!=null&&!values.includes(row[f]))throw Error('Invalid label');if(row.rationale!=null&&typeof row.rationale!=='string')throw Error('Invalid rationale')}if(Object.keys(state.articles).length+Object.keys(state.pairs).length&&!confirm('Replace local drafts with this exported review?'))return;state=s;render();save()}catch(err){el('status').textContent='Import failed: '+err.message}};render();
</script></html>`
writeFileSync(out+'/index.html',html)
writeFileSync(out+'/hashes.json',JSON.stringify({sampleSha256,htmlSha256:hash(html),frozenBeforeCandidateEvaluation:true,articles:50,pairs:10,labels:null},null,2)+'\n')
console.log(JSON.stringify({out,sampleSha256,excluded:excludedIds.size,eligible:rows.length}))
