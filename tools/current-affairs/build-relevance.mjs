/** Build-only derivation: verified CSE Prelims + pinned CSE GS Mains + local taxonomy labels. No question text ships. */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { loadCanonical, sha256 } from '../atlas-build/lib/canonical-package.mjs'
const root = new URL('../../', import.meta.url)
const input = process.argv.find(x => x.startsWith('--package='))?.slice(10) ?? fileURLToPath(new URL('../canonical-pyq-v2-final.zip', root))
const taxonomyDir = process.argv.find(x => x.startsWith('--taxonomies='))?.slice(13) ?? fileURLToPath(new URL('../taxonomies/', root))
const canonical = loadCanonical(input)
const normalize = s => s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const strings = obj => typeof obj === 'string' ? [obj] : Array.isArray(obj) ? obj.flatMap(strings) : obj && typeof obj === 'object' ? Object.entries(obj).filter(([k]) => ['text','content','items','cells','rows','options','segments','value'].includes(k)).flatMap(([,v]) => strings(v)) : []
const prelims = canonical.records.filter(x => x.record.exam.code === 'UPSC-CSE').map(x => ` ${normalize(strings(x.record.question).join(' '))} `)
const mainsBytes = readFileSync(new URL('./.cache/upsc-corpus.json', import.meta.url))
if (sha256(mainsBytes) !== '735642df186eecfe1b79ec9f3a1c4ef91df5907e4b4bef4b85850e14e52428d6') throw Error('Pinned Mains input hash mismatch; run fetch-mains.mjs')
const mainsRaw = JSON.parse(mainsBytes)
const mains = ['GS1','GS2','GS3','GS4'].flatMap(p => mainsRaw[p].questions.filter(q => !q.extra && Number.isInteger(Number(q.year)) && Number(q.year) >= 2013 && Number(q.year) <= 2026).map(q => ` ${normalize(q.question)} `))
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
const taxonomies = [], labels = [], concepts = new Set()
for (const name of readdirSync(taxonomyDir).filter(n => n.endsWith('.zip') && !/soc[12]/i.test(n)).sort()) {
  const bytes = readFileSync(taxonomyDir + '/' + name), files = zipFiles(bytes)
  taxonomies.push({ file: name, sha256: sha256(bytes) })
  for (const [path, bytes] of files) {
    if (path.endsWith('/taxonomy.yaml')) {
      // Deliberately extract only adjacent single-line id/title scalars, not YAML scopes or cross-exam frequency claims.
      const text = bytes.toString()
      for (const match of text.matchAll(/(?:^|\n)\s*(?:- )?id: ([^\n]+)\n\s+title: ([^\n]+)/g)) {
        const title = match[2].trim().replace(/^['"]|['"]$/g, '').replace(/''/g, "'")
        labels.push({ id: match[1].trim(), title, context: name.startsWith('prelims') ? 'prelims' : 'mains' })
      }
    }
    if (path.endsWith('/pyq-map.json')) {
      const data = JSON.parse(bytes)
      for (const mapping of data.mappings ?? data.records ?? []) for (const term of mapping.required_concepts ?? []) if (typeof term === 'string') concepts.add(term)
    }
  }
}
// Small editorial alias layer connects news spellings to durable syllabus concepts; counts below are mechanically derived.
const seeds = [
  ['RBI','Reserve Bank of India|RBI','Economy','Banking and monetary policy'], ['SEBI','Securities and Exchange Board of India|SEBI','Economy','Financial regulation'],
  ['Monetary policy','monetary policy|repo rate|liquidity framework|cash reserve ratio','Economy','Banking and monetary policy'], ['Banking regulation','banking regulation|banking regulations|Basel III|banking system','Economy','Banking and monetary policy'],
  ['Inflation','inflation|consumer price index|wholesale price index','Economy','Prices and growth'], ['GST','goods and services tax|GST','Economy','Taxation'],
  ['Fiscal policy','fiscal policy|fiscal deficit|government budget|union budget','Economy','Public finance'], ['Employment','unemployment|labour code|labor code|demographic dividend','Economy','Employment'],
  ['Supreme Court','Supreme Court|constitutional bench|constitution bench','Polity','Constitution and judiciary'], ['Constitution','constitutional|constitution of India|fundamental rights|basic structure','Polity','Constitution and rights'],
  ['Federalism','federalism|federal structure|centre state relations','Polity','Federalism'], ['ECI','Election Commission of India|election commission|ECI','Polity','Constitutional bodies'],
  ['CAG','Comptroller and Auditor General|CAG','Polity','Constitutional bodies'], ['Finance Commission','Finance Commission','Economy','Fiscal federalism'], ['NITI Aayog','NITI Aayog','Economy','Development policy'],
  ['Government schemes','government scheme|government schemes|centrally sponsored scheme|PM Kisan|PM KISAN|Ayushman Bharat|MGNREGA|Jal Jeevan Mission','Governance','Welfare and government policy'],
  ['Agriculture','minimum support price|crop insurance|food security|agricultural policy|soil health|agriculture','Economy','Agriculture'],
  ['Ramsar Convention','Ramsar|wetland conservation','Environment','Wetlands and conservation'], ['Protected areas','protected area|protected areas|national park|tiger reserve|wildlife sanctuary','Environment','Biodiversity and conservation'],
  ['Biodiversity','biodiversity|endangered species|invasive species|IUCN','Environment','Biodiversity and conservation'], ['Climate change','climate change|global warming|climate treaty|Paris Agreement|UNFCCC|carbon emissions','Environment','Climate and treaties'],
  ['Environmental regulation','environmental impact assessment|environment protection act|forest conservation|pollution control','Environment','Environmental regulation'],
  ['ISRO','ISRO|Indian Space Research Organisation|Chandrayaan|Gaganyaan|Aditya L1','Sci-Tech','Space technology'], ['Space exploration','space mission|lunar mission|Mars mission|space telescope|gravitational waves|exoplanet','Sci-Tech','Space and science'],
  ['Biotechnology','biotechnology|gene editing|CRISPR|genome sequencing|genetic engineering','Sci-Tech','Biotechnology'], ['Technology policy','artificial intelligence|semiconductor|quantum computing|cybersecurity|data protection act','Sci-Tech','Technology and regulation'],
  ['Geography','tectonic plates|monsoon|El Nino|La Nina|ocean currents|earthquake|volcanic eruption','Geography','Physical geography'],
  ['United Nations','United Nations|UN Security Council|UN General Assembly','International relations','International institutions'], ['IMF','International Monetary Fund|IMF','Economy','International institutions'],
  ['World Bank','World Bank','Economy','International institutions'], ['WTO','World Trade Organization|World Trade Organisation|WTO','International relations','International trade'], ['WHO','World Health Organization|World Health Organisation','International relations','International institutions'],
  ['Treaties','international treaty|international treaties|trade agreement|nuclear treaty|non proliferation treaty|UNCLOS|Indus Waters Treaty','International relations','Treaties and agreements'],
  ['Reports and indices','human development index|human development report|global hunger index|multidimensional poverty|economic survey','Economy','Reports and development'],
  ['Security','ballistic missile|nuclear deterrence|maritime security|terrorism|insurgency|border security','Security','Defence and internal security'],
  ['Culture','UNESCO|world heritage|archaeological survey|GI tag|geographical indication','History & Culture','Heritage and culture'],
  ['Governance','right to information|RTI act|civil service|civil services|Lokpal|public accountability','Governance','Accountability'],
]
const count = (texts, aliases) => texts.filter(t => aliases.some(a => t.includes(` ${normalize(a)} `))).length
const signals = seeds.map(([concept, spellings, subject, topic]) => {
  const aliases = spellings.split('|'), prelimsCount = count(prelims, aliases), mainsCount = count(mains, aliases)
  const refs = labels.filter(l => aliases.some(a => normalize(l.title).includes(normalize(a)) || normalize(l.title).split(' ').length > 1 && normalize(a).includes(normalize(l.title))))
  return { concept, aliases, subject, topic, subtopic: concept, taxonomyIds: refs.map(l => l.id).slice(0, 5), prelimsCount, mainsCount, prelimsDemand: prelimsCount > 0 || refs.some(l => l.context === 'prelims'), mainsDemand: mainsCount > 0 || refs.some(l => l.context === 'mains') }
})
const inferSubject = title => /polity|constitution|judici|rights|federal/i.test(title) ? 'Polity' : /environment|climate|biodiversity|conservation|pollution/i.test(title) ? 'Environment' : /science|technology|space|biotech/i.test(title) ? 'Sci-Tech' : /international|treaty|diplomacy/i.test(title) ? 'International relations' : /geograph|monsoon|ocean/i.test(title) ? 'Geography' : /security|defence|terror/i.test(title) ? 'Security' : /history|heritage|culture/i.test(title) ? 'History & Culture' : /governance|justice|society|welfare/i.test(title) ? 'Governance' : 'Economy'
// Admit only repeated, concise, multiword concepts with a direct taxonomy title match. No command words or PYQ prose.
for (const concept of [...concepts].sort()) {
  const n = normalize(concept), refs = labels.filter(l => normalize(l.title).includes(n)), aliases = [concept]
  if (n.split(' ').length < 2 || n.split(' ').length > 5 || concept.length > 65 || !refs.length || signals.some(s => s.aliases.some(a => normalize(a) === n))) continue
  const prelimsCount = count(prelims, aliases), mainsCount = count(mains, aliases)
  if (prelimsCount + mainsCount < 2) continue
  signals.push({ concept, aliases, subject: inferSubject(refs[0].id), topic: refs[0].title, subtopic: concept, taxonomyIds: refs.map(r => r.id).slice(0, 5), prelimsCount, mainsCount, prelimsDemand: prelimsCount > 0, mainsDemand: mainsCount > 0 })
}
if (signals.some(s => !s.prelimsDemand && !s.mainsDemand)) throw Error('A seed has no CSE/taxonomy support: ' + signals.filter(s => !s.prelimsDemand && !s.mainsDemand).map(s => s.concept))
const asset = { version: 1, provenance: { canonical: canonical.identity, prelimsQuestions: prelims.length, mainsRepository: 'https://github.com/markus-aurelius1/pyq-engine', mainsCommit: '31cd820df0506fd1ffeb818ff0e2b2357d95c7a0', mainsSourceSha256: sha256(mainsBytes), mainsQuestions: mains.length, mainsPapers: ['GS1','GS2','GS3','GS4'], excluded: ['PCS','CDS','optional papers','practice questions','topper answers'], taxonomies, method: 'CSE document-frequency counts over canonical blocks and GS Mains question fields; editorial aliases plus repeated taxonomy-backed concepts. Counts are lexical evidence, not exact question-to-topic mappings.' }, signals }
mkdirSync(new URL('public/current-affairs/v1/', root), { recursive: true })
writeFileSync(new URL('public/current-affairs/v1/relevance-index.json', root), JSON.stringify(asset) + '\n')
console.log(`${signals.length} signals; ${prelims.length} CSE Prelims / ${mains.length} GS Mains questions; ${JSON.stringify(asset).length} bytes`)
