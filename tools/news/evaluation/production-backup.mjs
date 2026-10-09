/** Authorized private backup only. Remote SQL is SELECT-only; migration remains unapproved. */
import assert from 'node:assert/strict'
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
const suffix=process.argv[2]??''
assert(!suffix||/^[a-z0-9-]+$/.test(suffix),'Snapshot suffix must be a plain local label')
const root='tools/news/.cache/production-release/private-backup'+(suffix?'-'+suffix:'')
assert(!existsSync(root+'/backup.private.json'),'Preserved backup must never be overwritten; choose a fresh snapshot suffix')
mkdirSync(root,{recursive:true})
const cli='C:/Users/hario/AppData/Local/npm-cache/_npx/32026684e21afda6/node_modules/wrangler/bin/wrangler.js'
const env={...process.env,WRANGLER_SEND_METRICS:'false',WRANGLER_DISABLE_UPDATE_CHECK:'true',CLOUDFLARE_ACCOUNT_ID:'5d8f8fb2f5df3b6125098fe367cab4f9'}
function run(name,args){const r=spawnSync(process.execPath,[cli,...args],{env,encoding:'utf8',maxBuffer:16*1024*1024});writeFileSync(root+'/'+name+'.private.log',(r.stdout??'')+(r.stderr??''));assert.equal(r.status,0,name+' failed; private log retained');console.log(JSON.stringify({name,status:'PASS'}));return r.stdout}
const schema=JSON.parse(run('schema',['d1','execute','tars-sync','--remote','--json','--command',"SELECT type,name,tbl_name,sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name;"]))
writeFileSync(root+'/schema.private.json',JSON.stringify(schema,null,2)+'\n')
const tables=schema.flatMap(s=>s.results??[]).filter(r=>r.type==='table').map(r=>r.name)
assert(tables.includes('sync_users')&&tables.includes('sync_records'),'Legacy production schema unexpected')
assert(!tables.includes('highlight_sync_records')&&!tables.includes('highlight_sync_users'),'H3 already present; inspect before proceeding')
const migration=JSON.parse(run('migrations',['d1','execute','tars-sync','--remote','--json','--command','SELECT id,name,applied_at FROM d1_migrations ORDER BY id;']))
const count=JSON.parse(run('counts',['d1','execute','tars-sync','--remote','--json','--command','SELECT COUNT(*) AS legacyUsers FROM sync_users; SELECT collection,COUNT(*) AS rows,SUM(deleted) AS tombstones FROM sync_records GROUP BY collection;']))
const bookmark=JSON.parse(run('bookmark',['d1','time-travel','info','tars-sync','--json']))
const filename=root+'/tars-sync-before-h3.sql'
run('export',['d1','export','tars-sync','--remote','--output',filename])
const bytes=readFileSync(filename),sha256=createHash('sha256').update(bytes).digest('hex')
writeFileSync(root+'/backup.private.json',JSON.stringify({accountId:env.CLOUDFLARE_ACCOUNT_ID,databaseId:'824fd651-a92c-4716-a618-232624fa5bcc',binding:'SYNC_DB',filename,sha256,size:bytes.length,bookmark,schema,migration,count,createdAt:new Date().toISOString()},null,2)+'\n')
console.log(JSON.stringify({filename,sha256,bytes:bytes.length,tables,migrations:migration.flatMap(r=>r.results??[]),counts:count.flatMap(r=>r.results??[]),bookmark}))
