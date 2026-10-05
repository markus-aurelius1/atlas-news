/** Explicit build-input download, pinned to the user's repository snapshot. Never run during app build. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { sha256 } from '../atlas-build/lib/canonical-package.mjs'
const commit = '31cd820df0506fd1ffeb818ff0e2b2357d95c7a0'
const response = await fetch(`https://raw.githubusercontent.com/markus-aurelius1/pyq-engine/${commit}/data/source/upsc-corpus.json`, { signal: AbortSignal.timeout(20000) })
if (!response.ok) throw Error(`Mains source HTTP ${response.status}`)
const bytes = Buffer.from(await response.arrayBuffer())
if (sha256(bytes) !== '735642df186eecfe1b79ec9f3a1c4ef91df5907e4b4bef4b85850e14e52428d6') throw Error('Pinned Mains source hash mismatch')
mkdirSync(new URL('./.cache/', import.meta.url), { recursive: true })
writeFileSync(new URL('./.cache/upsc-corpus.json', import.meta.url), bytes)
console.log(`Verified build-only Mains input at ${commit}`)
