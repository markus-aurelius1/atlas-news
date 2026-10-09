/** Read-only Cloudflare preflight. Never emits credentials or personal database rows. */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
const account = '5d8f8fb2f5df3b6125098fe367cab4f9'
const config = readFileSync('C:/Users/hario/AppData/Roaming/xdg.config/.wrangler/config/default.toml','utf8')
const token = config.match(/oauth_token\s*=\s*"([^"]+)"/)?.[1]
if (!token) throw Error('Existing OAuth credential unavailable')
const paths = [
  '/accounts/'+account+'/pages/projects',
  '/accounts/'+account+'/subscriptions',
  '/accounts/'+account+'/workers/standard',
  '/accounts/'+account+'/d1/database/824fd651-a92c-4716-a618-232624fa5bcc',
  '/accounts/'+account+'/access/apps',
  '/accounts/'+account+'/access/identity_providers',
  '/accounts/'+account+'/workers/account-settings',
  '/accounts/'+account+'/entitlements',
  '/accounts/'+account+'/access/organizations',
  '/accounts/'+account+'/pages/projects/tars-atlas-news/deployments',
]
mkdirSync('tools/news/.cache/production-release',{recursive:true})
const results=[]
for (const path of paths) {
  try {
    const response=await fetch('https://api.cloudflare.com/client/v4'+path,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)})
    const data=await response.json()
    // These responses are private local preflight evidence; never stage credentials/allowlists.
    results.push({path,status:response.status,...data})
    console.log(JSON.stringify({path,status:response.status,success:data.success,errors:data.errors,result:path.endsWith('/pages/projects')?data.result?.map(p=>({name:p.name,subdomain:p.subdomain,domains:p.domains,production_branch:p.production_branch,sourceType:p.source?.type,productionDeploymentId:p.canonical_deployment?.id,productionUrl:p.canonical_deployment?.url})):path.includes('/d1/')?data.result:path.endsWith('/subscriptions')?data.result?.map(s=>({id:s.id,rate_plan:s.rate_plan,state:s.state})):undefined}))
  } catch(e) { results.push({path,error:e.message}); console.log(JSON.stringify({path,error:e.message})) }
}
writeFileSync('tools/news/.cache/production-release/cloudflare-private.json',JSON.stringify({account,checkedAt:new Date().toISOString(),results},null,2)+'\n')
// Requests below hit only the protected application shell, never article/feed/sync endpoints.
for (const url of ['https://tars-atlas-news.pages.dev/','https://8675aa42.tars-atlas-news.pages.dev/']) {
  try {const r=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(15000)});const location=r.headers.get('location');console.log(JSON.stringify({url,status:r.status,location:location?new URL(location).origin+new URL(location).pathname:null,accessProtectedRedirect:location?.includes('cloudflareaccess.com')??false}));await r.body?.cancel()}
  catch(e){console.log(JSON.stringify({url,error:e.message}))}
}
