/** Save one live registry collection as the audit input. Feed metadata only; the file stays in a git-ignored cache. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { collectFeeds } from '../../src/current-affairs/gateway.ts'

const out = new URL('./.cache/', import.meta.url)
const data = await collectFeeds((input, init) => fetch(input, { ...init, redirect: 'manual' }))
mkdirSync(out, { recursive: true })
writeFileSync(new URL('snapshot.json', out), JSON.stringify(data) + '\n')
console.log(`${data.items.length} items from ${data.sources.filter(s => s.status === 'ok').length}/${data.sources.length} sources at ${data.fetchedAt}`)
