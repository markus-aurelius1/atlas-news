/** Verified, read-only canonical ZIP loading. Archive/history are integrity checked, never traversed as runtime inventory. */
import { readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../../../package.json', import.meta.url))
const Ajv = require('ajv')
export const RELEASE = '2.1.0'
export const MANIFEST_HASH = '282b9bbedba72bf612bd9c79a267e2c541a4970dcc00b5d70a41b2a8b6963a68'
export const sha256 = (value) => createHash('sha256').update(value).digest('hex')
export const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((k) => [k, stable(value[k])])) : value
export const canonicalHash = (value) => sha256(JSON.stringify(stable(value)))
const demand = (ok, message) => { if (!ok) throw new Error(message) }
const safePath = (path) => typeof path === 'string' && !path.includes('\\') && !path.startsWith('/') && path.split('/').every((x) => x && x !== '.' && x !== '..')

/** Central-directory sizes support ZIP data descriptors; no extraction, shell command, or archive script execution. */
export function readZip(bytes) {
  let end = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (bytes.readUInt32LE(i) === 0x06054b50 && i + 22 + bytes.readUInt16LE(i + 20) === bytes.length) { end = i; break }
  demand(end >= 0, 'ZIP end directory missing')
  demand(bytes.readUInt16LE(end + 4) === 0 && bytes.readUInt16LE(end + 6) === 0, 'Multi-disk ZIP unsupported')
  const count = bytes.readUInt16LE(end + 10)
  let offset = bytes.readUInt32LE(end + 16)
  const files = new Map()
  let total = 0
  for (let n = 0; n < count; n++) {
    demand(bytes.readUInt32LE(offset) === 0x02014b50, 'Invalid ZIP directory')
    const flags = bytes.readUInt16LE(offset + 8), method = bytes.readUInt16LE(offset + 10)
    const compressed = bytes.readUInt32LE(offset + 20), size = bytes.readUInt32LE(offset + 24)
    const nameLength = bytes.readUInt16LE(offset + 28), extra = bytes.readUInt16LE(offset + 30), comment = bytes.readUInt16LE(offset + 32)
    const name = bytes.subarray(offset + 46, offset + 46 + nameLength).toString('utf8')
    const local = bytes.readUInt32LE(offset + 42)
    demand(safePath(name) && !files.has(name), `Unsafe/duplicate ZIP path: ${name}`)
    demand(!(flags & 1) && [0, 8].includes(method), 'Encrypted/unsupported ZIP entry')
    total += size
    demand(size < 100 * 1024 * 1024 && total < 250 * 1024 * 1024, 'ZIP size limit exceeded')
    demand(bytes.readUInt32LE(local) === 0x04034b50, 'Invalid ZIP local header')
    const start = local + 30 + bytes.readUInt16LE(local + 26) + bytes.readUInt16LE(local + 28)
    const data = bytes.subarray(start, start + compressed)
    const decoded = method === 8 ? inflateRawSync(data, { maxOutputLength: size + 1 }) : data
    demand(decoded.length === size, `ZIP size mismatch: ${name}`)
    files.set(name, decoded)
    offset += 46 + nameLength + extra + comment
  }
  return files
}

export function verifyPackage(files, expectedManifestHash = MANIFEST_HASH) {
  const roots = [...files.keys()].filter((p) => p.split('/').length === 2 && p.endsWith('/PACKAGE-MANIFEST.json'))
  demand(roots.length === 1, 'One package manifest required')
  const prefix = roots[0].slice(0, -'PACKAGE-MANIFEST.json'.length)
  const manifestBytes = files.get(roots[0])
  demand(sha256(manifestBytes) === expectedManifestHash, 'Canonical manifest identity mismatch')
  const manifest = JSON.parse(manifestBytes)
  demand(manifest.schema === 'canonical-package-manifest/v2' && manifest.contract === 'canonical-pyq/v2' && manifest.release_version === RELEASE, 'Unsupported canonical manifest')
  demand(manifest.file_count === manifest.files.length && files.size === manifest.file_count + 1, 'Manifest file count mismatch')
  const listed = new Set()
  for (const entry of manifest.files) {
    demand(safePath(entry.path) && !listed.has(entry.path), 'Unsafe/duplicate manifest path')
    listed.add(entry.path)
    const bytes = files.get(prefix + entry.path)
    demand(bytes && bytes.length === entry.bytes && sha256(bytes) === entry.sha256, `Manifest integrity failure: ${entry.path}`)
  }
  const json = (path) => {
    demand(listed.has(path), `Unverified package path: ${path}`)
    return JSON.parse(files.get(prefix + path))
  }
  const release = json('RELEASE.json')
  demand(release.version === RELEASE && release.canonical_schema === 'canonical-pyq/v2' && release.active_index === 'corpus/index.json' && release.runtime_metadata === 'corpus/runtime-metadata.json' && release.hash_contract === 'CPYQ-HASH/v1', 'Unsupported release contract')
  return { json, manifest, release, manifestHash: sha256(manifestBytes) }
}

export function loadCanonical(path) {
  const bytes = readFileSync(path)
  return loadVerified(verifyPackage(readZip(bytes)), sha256(bytes))
}

export function loadVerified(pkg, zipHash = null) {
  const { json } = pkg
  const ajv = new Ajv({ strict: false, allErrors: true })
  const validators = Object.fromEntries(['canonical-pyq-v2', 'answer', 'runtime-index', 'runtime-metadata'].map((name) => [name, ajv.compile(json(`schema/${name}.schema.json`))]))
  const validate = (name, value) => demand(validators[name](value), `${name} schema failure: ${JSON.stringify(validators[name].errors)?.slice(0, 700)}`)
  const index = json('corpus/index.json'), runtime = json('corpus/runtime-metadata.json')
  validate('runtime-index', index)
  validate('runtime-metadata', runtime)
  const metadata = new Map(runtime.questions.map((m) => [m.question_id, m]))
  demand(metadata.size === runtime.questions.length, 'Duplicate runtime identity')
  const ids = new Set(), papers = new Set(), records = []
  for (const paper of index.papers) {
    demand(!papers.has(paper.paper_id), 'Duplicate paper')
    papers.add(paper.paper_id)
    demand(/^corpus\/(upsc-cse|uppcs|cds)\/[^/]+\.json$/.test(paper.questions) && /^answers\/(upsc-cse|uppcs|cds)\/[^/]+\.json$/.test(paper.answers), 'Non-active pack path')
    const questions = json(paper.questions), answers = json(paper.answers)
    demand(Array.isArray(questions) && Array.isArray(answers) && questions.length === paper.count && answers.length === paper.count, `Pack count mismatch: ${paper.paper_id}`)
    const answerMap = new Map(answers.map((a) => [a.question_id, a]))
    demand(answerMap.size === answers.length && new Set(answers.map((a) => a.id)).size === answers.length, 'Duplicate answer identity')
    for (const record of questions) {
      validate('canonical-pyq-v2', record)
      const answer = answerMap.get(record.id), meta = metadata.get(record.id)
      demand(answer && meta && !ids.has(record.id), `Missing/duplicate join: ${record.id}`)
      validate('answer', answer)
      ids.add(record.id)
      const e = record.exam, p = record.provenance
      demand(e.code === paper.exam && e.year === paper.year && e.cycle === paper.cycle && e.corpus_role === paper.corpus_role && record.id === `${paper.paper_id}-Q${String(record.question.number).padStart(3, '0')}`, `Paper identity mismatch: ${record.id}`)
      demand(answer.id === record.answer_id && answer.question_id === record.id && answer.source_id === p.question_source && answer.source_filename === p.source_filename && answer.source_question_number === p.source_question_number && answer.booklet === p.booklet && p.source_question_number === record.question.number, `Answer/provenance join mismatch: ${record.id}`)
      demand(p.occurrences.some((o) => answer.line >= o.line_start && answer.line <= o.line_end), `Answer line outside provenance: ${record.id}`)
      demand(meta.exam === e.code && meta.active === true && ['FROZEN', 'EDITABLE_REVIEW'].includes(meta.disposition) && meta.answer_status === answer.status, `Runtime identity mismatch: ${record.id}`)
      demand(meta.base_question_hash === canonicalHash(record.question) && meta.supplied_answer_hash === canonicalHash({ status: answer.status, correct_options: answer.correct_options }) && meta.source_record_hash === canonicalHash(record), `Canonical hash mismatch: ${record.id}`)
      records.push({ record, answer, meta, paper })
    }
  }
  demand(ids.size === metadata.size && [...metadata.keys()].every((id) => ids.has(id)), 'Runtime allowlist mismatch')
  const summary = json('validation/runtime-summary.json')
  demand(records.length === summary.counts.active_runtime_questions && records.length === 6982 && papers.size === 56, 'Release inventory mismatch')
  return { records, index, identity: { canonicalRelease: RELEASE, canonicalSchema: 'canonical-pyq/v2', manifestHash: pkg.manifestHash, packageHash: zipHash } }
}

export function runtimeEligibility(meta, answer) {
  const reasons = []
  for (const [key, value] of Object.entries({ active: true, quiz_state: 'QUIZ_USABLE', answer_status: 'final', answer_scoreable: true, immediately_scoreable: true, requires_local_correction: false })) if (meta?.[key] !== value) reasons.push(`runtime:${key}`)
  if (!['FROZEN', 'EDITABLE_REVIEW'].includes(meta?.disposition)) reasons.push('runtime:disposition')
  for (const key of ['content_issues', 'answer_issues', 'visual_flags']) if (!Array.isArray(meta?.[key]) || meta[key].length) reasons.push(...(meta?.[key]?.length ? meta[key].map((issue) => `runtime:${key}:${issue}`) : [`runtime:${key}:missing`]))
  if (answer?.status !== 'final' || !answer.correct_options?.length || new Set(answer.correct_options).size !== answer.correct_options.length || answer.correct_options.some((k) => !['A', 'B', 'C', 'D'].includes(k))) reasons.push('runtime:invalid-final-answer')
  return { pass: reasons.length === 0, reasons }
}
