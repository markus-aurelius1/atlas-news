/**
 * Build-only derivation of the News relevance index: verified CSE and UPPCS Prelims, pinned CSE GS Mains and local
 * taxonomy labels. The editorial lexicon names concepts and spellings; every count here is mechanical document
 * frequency using the runtime's own phrase matcher. No question text ships.
 *
 *   node tools/current-affairs/fetch-mains.mjs
 *   node tools/current-affairs/build-relevance.mjs --package=<canonical-pyq-v2-final.zip> --taxonomies=<folder of taxonomy zips>
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { loadCanonical, sha256 } from '../atlas-build/lib/canonical-package.mjs'
import { PhraseMatcher, tokenize } from '../../src/current-affairs/match.ts'
import { lexicon } from './lexicon.mjs'
const root = new URL('../../', import.meta.url)
const input = process.argv.find(x => x.startsWith('--package='))?.slice(10) ?? fileURLToPath(new URL('../canonical-pyq-v2-final.zip', root))
const taxonomyDir = process.argv.find(x => x.startsWith('--taxonomies='))?.slice(13) ?? fileURLToPath(new URL('../taxonomies/', root))
const canonical = loadCanonical(input)
const strings = obj => typeof obj === 'string' ? [obj] : Array.isArray(obj) ? obj.flatMap(strings) : obj && typeof obj === 'object' ? Object.entries(obj).filter(([k]) => ['text','content','items','cells','rows','options','segments','value'].includes(k)).flatMap(([,v]) => strings(v)) : []
const paper = code => canonical.records.filter(x => x.record.exam.code === code).map(x => tokenize(strings(x.record.question).join(' ')))
const prelims = paper('UPSC-CSE'), uppcs = paper('UPPCS')
const mainsBytes = readFileSync(new URL('./.cache/upsc-corpus.json', import.meta.url))
if (sha256(mainsBytes) !== '735642df186eecfe1b79ec9f3a1c4ef91df5907e4b4bef4b85850e14e52428d6') throw Error('Pinned Mains input hash mismatch; run fetch-mains.mjs')
const mainsRaw = JSON.parse(mainsBytes)
const mains = ['GS1','GS2','GS3','GS4'].flatMap(p => mainsRaw[p].questions.filter(q => !q.extra && Number.isInteger(Number(q.year)) && Number(q.year) >= 2013 && Number(q.year) <= 2026).map(q => tokenize(q.question)))
// Read only archive files in memory. Taxonomy ZIPs include harmless directory entries unlike the strict canonical package.
function zipFiles(bytes) {
  let end = bytes.length - 22
  while (end >= Math.max(0, bytes.length - 65557) && bytes.readUInt32LE(end) !== 0x06054b50) end--
  if (end < 0) throw Error('Invalid taxonomy ZIP')
  let at = bytes.readUInt32LE(end + 16); const out = new Map()
  for (let i = 0; i < bytes.readUInt16LE(end + 10); i++) {
    if (bytes.readUInt32LE(at) !== 0x02014b50) throw Error('Invalid ZIP directory')
    const len = bytes.readUInt16LE(at + 28), extra = bytes.readUInt16LE(at + 30), comment = bytes.readUInt16LE(at + 32), name = bytes.subarray(at + 46, at + 46 + len).toString(), method = bytes.readUInt16LE(at + 10), size = bytes.readUInt32LE(at + 24), compressed = bytes.readUInt32LE(at + 20), local = bytes.readUInt32LE(at + 42)
    if (size > 10e6 || ![0,8].includes(method) || name.split('/').includes('..')) throw Error('Unsafe taxonomy ZIP')
    if (!name.endsWith('/')) { const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28); const data = bytes.subarray(start, start + compressed); out.set(name, method === 8 ? inflateRawSync(data, { maxOutputLength: size + 1 }) : data) }
    at += 46 + len + extra + comment
  }
  return out
}
const SUBJECT_BY_FILE = [[/society|social-justice|governance/i, 'Governance'], [/economy|agriculture/i, 'Economy'], [/environment|disaster/i, 'Environment'], [/science/i, 'Sci-Tech'], [/geography/i, 'Geography'], [/history|heritage|culture/i, 'History & Culture'], [/international/i, 'International relations'], [/polity/i, 'Polity'], [/security/i, 'Security']]
const phrase = text => tokenize(text).map(t => t.low).join(' ')
const taxonomies = [], labels = [], mined = new Map()
for (const name of readdirSync(taxonomyDir).filter(n => n.endsWith('.zip') && !/soc[12]|canonical/i.test(n)).sort()) {
  const bytes = readFileSync(taxonomyDir + '/' + name), files = zipFiles(bytes)
  taxonomies.push({ file: name, sha256: sha256(bytes) })
  const subject = SUBJECT_BY_FILE.find(([re]) => re.test(name))?.[1]
  for (const [path, bytes] of files) {
    if (path.endsWith('/taxonomy.yaml')) {
      // Deliberately extract only adjacent single-line id/title scalars, not YAML scopes or cross-exam frequency claims.
      const text = bytes.toString()
      for (const match of text.matchAll(/(?:^|\n)\s*(?:- )?id: ([^\n]+)\n\s+title: ([^\n]+)/g)) {
        const title = match[2].trim().replace(/^['"]|['"]$/g, '').replace(/''/g, "'")
        labels.push({ id: match[1].trim(), title, low: ` ${phrase(title)} `, context: name.startsWith('prelims') ? 'prelims' : 'mains' })
      }
    }
    // Ethics case-study vocabulary (GS4) describes conduct, not current affairs, so it is not mined.
    if (path.endsWith('/pyq-map.json') && subject && !/ethics/i.test(name)) {
      const data = JSON.parse(bytes)
      for (const mapping of data.mappings ?? data.records ?? []) for (const term of mapping.required_concepts ?? []) if (typeof term === 'string' && !mined.has(term)) mined.set(term, subject)
    }
  }
}
const rows = lexicon().map(r => ({ ...r, mined: false }))
const known = new Set(rows.flatMap(r => r.aliases.map(a => phrase(a.text))))
// Taxonomy-authored concepts join as weak supporting evidence: concise, multiword and not already an editorial spelling.
for (const [concept, subject] of [...mined].sort(([a], [b]) => a.localeCompare(b))) {
  const n = phrase(concept), words = n.split(' ').length
  if (words < 2 || words > 5 || concept.length > 65 || known.has(n)) continue
  known.add(n)
  rows.push({ concept, aliases: [{ text: concept, exact: false }], subject, topic: labels.find(l => l.low.includes(` ${n} `))?.title ?? subject, tier: 1, scope: ['International relations', 'Environment', 'Sci-Tech', 'Geography'].includes(subject) ? 'global' : 'india', mined: true })
}
const matcher = new PhraseMatcher()
const termId = (r, a) => r * 10000 + a
rows.forEach((row, r) => row.aliases.forEach((alias, a) => matcher.add((alias.exact ? '^' : '') + alias.text, termId(r, a), String(termId(r, a)))))
/** Document frequency per spelling and per concept: a question counts once however often it repeats a term. */
function frequencies(docs) {
  const byAlias = new Map(), byRow = new Map()
  for (const doc of docs) {
    const ids = new Set(matcher.scan(doc).map(h => h.value))
    for (const id of ids) byAlias.set(id, (byAlias.get(id) ?? 0) + 1)
    for (const r of new Set([...ids].map(id => Math.floor(id / 10000)))) byRow.set(r, (byRow.get(r) ?? 0) + 1)
  }
  return { byAlias, byRow }
}
const P = frequencies(prelims), M = frequencies(mains), U = frequencies(uppcs)
const signals = [], context = []
rows.forEach((row, r) => {
  const prelimsCount = P.byRow.get(r) ?? 0, mainsCount = M.byRow.get(r) ?? 0, uppcsCount = U.byRow.get(r) ?? 0
  if (row.mined && prelimsCount + mainsCount + uppcsCount < 2) return
  const names = row.mined ? [phrase(row.concept)] : [phrase(row.concept), ...row.aliases.map(a => phrase(a.text)).filter(n => n.split(' ').length > 1)]
  const refs = labels.filter(l => names.some(n => l.low.includes(` ${n} `)))
  const aliasCounts = row.aliases.map((_, a) => (P.byAlias.get(termId(r, a)) ?? 0) + (M.byAlias.get(termId(r, a)) ?? 0) + (U.byAlias.get(termId(r, a)) ?? 0))
  const entry = { concept: row.concept, aliases: row.aliases.map(a => (a.exact ? '^' : '') + a.text), aliasCounts, subject: row.subject, topic: row.topic, subtopic: row.concept, tier: row.tier, scope: row.scope, mined: row.mined, taxonomyIds: refs.map(l => l.id).slice(0, 5), prelimsCount, mainsCount, uppcsCount, prelimsDemand: prelimsCount + uppcsCount > 0 || refs.some(l => l.context === 'prelims'), mainsDemand: mainsCount > 0 || refs.some(l => l.context === 'mains') }
  // A concept with no question and no taxonomy label is still useful news vocabulary, but it never claims exam demand.
  if (entry.prelimsDemand || entry.mainsDemand) signals.push(entry); else context.push(entry)
})
const asset = { version: 2, provenance: { canonical: canonical.identity, prelimsQuestions: prelims.length, uppcsQuestions: uppcs.length, mainsRepository: 'https://github.com/markus-aurelius1/pyq-engine', mainsCommit: '31cd820df0506fd1ffeb818ff0e2b2357d95c7a0', mainsSourceSha256: sha256(mainsBytes), mainsQuestions: mains.length, mainsPapers: ['GS1','GS2','GS3','GS4'], excluded: ['CDS','optional papers','practice questions','topper answers'], taxonomies, method: 'Document-frequency counts of editorial spellings over canonical CSE and UPPCS Prelims blocks and GS Mains question fields, per spelling and per concept, plus taxonomy-authored concepts seen in at least two questions. Counts are lexical evidence, not exact question-to-topic mappings.' }, signals, context }
mkdirSync(new URL('public/current-affairs/v2/', root), { recursive: true })
writeFileSync(new URL('public/current-affairs/v2/relevance-index.json', root), JSON.stringify(asset) + '\n')
const spellings = signals.reduce((n, s) => n + s.aliases.length, 0), silent = signals.reduce((n, s) => n + s.aliasCounts.filter(c => !c).length, 0)
console.log(`${signals.length} signals (${signals.filter(s => s.mined).length} taxonomy-mined), ${context.length} unbacked context concepts; ${silent} of ${spellings} spellings have no PYQ hit; ${prelims.length} CSE / ${uppcs.length} UPPCS Prelims, ${mains.length} GS Mains questions; ${JSON.stringify(asset).length} bytes`)
if (context.length) console.log('Unbacked:', context.map(c => c.concept).join(', '))
