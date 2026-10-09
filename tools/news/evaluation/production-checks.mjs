/** Reuse committed gate commands with fresh evidence paths, preserving all prior freezes. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
const cache='tools/news/.cache/production-release'
mkdirSync(cache,{recursive:true})
const code=readFileSync('tools/news/evaluation/rc-checks.mjs','utf8')
  .replace("const root='docs/release-candidate',cache='tools/news/.cache/release-candidate'", "const root='docs/production-release',cache='tools/news/.cache/production-release'")
  .replace("VALIDATOR_INVENTORY_PATH:root+'/runtime-inventory.json'", "VALIDATOR_INVENTORY_PATH:'docs/release-candidate/runtime-inventory.json'")
// The generated runner is ignored/local; earlier verification evidence is untouched.
const localRunner=cache+'/checks.mjs'
writeFileSync(localRunner,code)
const result=spawnSync(process.execPath,[localRunner,...process.argv.slice(2)],{stdio:'inherit'})
if(result.error)throw result.error
process.exitCode=result.status??1
