/** Shared deterministic representation checks and text traversal. Never repairs source meaning or infers matching answers. */
export const SUPPORTED_BLOCKS = ['paragraph', 'statement-list', 'ordered-list', 'unordered-list', 'pairs', 'labelled-sections', 'assertion-reason', 'table', 'matching-table', 'matching-lists', 'answer-code', 'sequence']
export const SUPPORTED_TYPES = ['mcq', 'statements', 'matching', 'pairs', 'sequence', 'assertion-reason', 'propositions', 'table', 'context', 'quotation']
const norm = (text) => String(text).replace(/\s+/g, ' ').trim()
const broken = /\uFFFD|[\u0000-\u0008\u000b\u000c\u000e-\u001f]|```|<\/?[a-z][^>]*>|\b(?:https?:\/\/|Page\s+\d+\s+(?:of|\/)|www\.)|\b(?:OCR|ToolkitGeoOCRed|ForumIAS|Downloaded from)\b|\|\s*[-:]{3,}\s*\|/i
const visual = /\b(?:map|diagram|figure|image|picture|sketch|illustration)\s+(?:given|shown|below|above)|\b(?:given|following|above|below)\s+(?:map|diagram|figure|image|picture|sketch)|\b(?:marked|labelled|labeled)\s+(?:[A-D]|[1-4])\s+(?:in|on)\s+(?:the\s+)?(?:map|diagram|figure)/i
const embeddedInstruction = /\b(?:Select (?:the|a) (?:correct )?answer|Which of (?:the|these|those)|The correct sequence|What is the correct|The descending order|(?:Through |In )?[Hh]ow many (?:of |pairs|statements)|In the context of the above)\b/i

/** Text locations carry source paths, exact text and offsets for auditable mention relations. */
export function textLocations(question) {
  const out = []
  const add = (text, location, path, optionKey) => { if (typeof text === 'string') out.push({ text, location, path, ...(optionKey ? { optionKey } : {}) }) }
  const walk = (blocks, location, path, optionKey) => {
    for (const [i, b] of (blocks ?? []).entries()) {
      const p = `${path}/${i}`
      if (b.type === 'paragraph') add(b.text, location, `${p}/text`, optionKey)
      else if (b.type === 'table' || b.type === 'matching-table') {
        b.columns?.forEach((s, c) => add(s, optionKey ? 'option' : 'table', `${p}/columns/${c}`, optionKey))
        b.rows?.forEach((r, ri) => r.forEach((s, c) => add(s, optionKey ? 'option' : 'table', `${p}/rows/${ri}/${c}`, optionKey)))
      } else if (b.type === 'pairs') b.items?.forEach((item, n) => {
        add(item.left, optionKey ? 'option' : 'pair', `${p}/items/${n}/left`, optionKey)
        add(item.right, optionKey ? 'option' : 'pair', `${p}/items/${n}/right`, optionKey)
      })
      else if (b.type === 'sequence' || b.type === 'answer-code') b.segments?.forEach((s, n) => add(s.value, optionKey ? 'option' : 'sequence', `${p}/segments/${n}/value`, optionKey))
      else if (b.type === 'matching-lists') b.lists?.forEach((l, n) => {
        add(l.title, optionKey ? 'option' : 'table', `${p}/lists/${n}/title`, optionKey)
        l.items?.forEach((item, j) => walk(item.content, optionKey ? 'option' : 'table', `${p}/lists/${n}/items/${j}/content`, optionKey))
      })
      else if (b.items) b.items.forEach((item, n) => walk(item.content, optionKey ? 'option' : 'statement', `${p}/items/${n}/content`, optionKey))
    }
  }
  walk(question.content, 'stem', '/content')
  question.options?.forEach((o, i) => walk(o.content, 'option', `/options/${i}/content`, o.key))
  return out
}

export function premiumRenderability(question) {
  try { return validatePremium(question) } catch { return { pass: false, reasons: [{ code: 'malformed-canonical-shape', path: '/' }] } }
}

function validatePremium(question) {
  const reasons = []
  const fail = (code, path) => reasons.push({ code, path })
  const labels = new Set(), domains = []
  const text = (s, path, blank = false) => {
    if (typeof s !== 'string' || (!blank && !norm(s))) fail('missing-text', path)
    else {
      if (broken.test(s)) fail('extraction-artefact', path)
      if (/\*\*|__|is!\s*are|\b(?:is|are)\s*\/\s*!/.test(s)) fail('raw-format-or-extraction-token', path)
      if (visual.test(s)) fail('visual-dependency', path)
      if (s.length > 1800 || /\S{85}/.test(s)) fail('unresponsive-text', path)
      if (/\b([bcdfghjkmnpqrstvwxyz])\1[a-z]{3,}\b/.test(s)) fail('suspect-extraction-token', path)
      if (/(?:\n\s*){3,}/.test(s) || /(?:\b[a-d]\)\s.*){2}/i.test(s)) fail('broken-lines-or-options', path)
    }
  }
  const collect = (blocks) => {
    for (const b of blocks ?? []) {
      if (b.items) {
        b.items.forEach((i) => { if (norm(i.label)) labels.add(norm(i.label).replace(/[.:)]+$/, '')); collect(i.content) })
      }
      if (b.type === 'matching-lists') for (const l of b.lists ?? []) {
        const domain = l.items.map((i) => norm(i.label).replace(/[.:)]+$/, ''))
        domain.forEach((x) => labels.add(x)); domains.push(domain)
        l.items.forEach((i) => collect(i.content))
      }
      if (b.type === 'matching-table') for (let c = 0; c < b.columns.length; c++) {
        const domain = b.rows.map((r) => /^\s*([A-Z]|\d+)[.)]\s*/.exec(r[c] ?? '')?.[1]).filter(Boolean)
        domain.forEach((x) => labels.add(x)); domains.push(domain)
      }
      if (b.type === 'table') b.rows.forEach((r) => r.forEach((s) => { const m = /^\s*(\d+|[IVX]+)[.)]\s/.exec(s); if (m) labels.add(m[1]) }))
    }
  }
  collect(question.content)
  const walk = (blocks, path, depth = 0) => {
    if (!Array.isArray(blocks) || !blocks.length) { fail('empty-blocks', path); return }
    if (depth > 6) { fail('excessive-nesting', path); return }
    for (const [i, b] of blocks.entries()) {
      const p = `${path}/${i}`
      if (!SUPPORTED_BLOCKS.includes(b?.type)) { fail(/reference$/.test(b?.type) ? 'visual-dependency' : 'unsupported-block', p); continue }
      if (b.type === 'paragraph') text(b.text, `${p}/text`)
      else if (b.type === 'table' || b.type === 'matching-table') {
        if (!Array.isArray(b.columns) || !b.columns.length || b.columns.length > 6 || !b.rows?.length || b.rows.length > 20) { fail('table-dimensions', p); continue }
        const allBlankHeaders = b.columns.every((s) => typeof s === 'string' && !norm(s))
        b.columns.forEach((s, c) => text(s, `${p}/columns/${c}`, allBlankHeaders || (c === 0 && b.rows.every((r) => /^\s*(?:\d+|[IVX]+)[.)]\s*$/.test(r[0] ?? '')))))
        if (b.type === 'matching-table' && allBlankHeaders) fail('missing-table-headers', p)
        b.rows.forEach((row, ri) => {
          if (!Array.isArray(row) || row.length !== b.columns.length) { fail('incomplete-table-row', `${p}/rows/${ri}`); return }
          row.forEach((s, c) => text(s, `${p}/rows/${ri}/${c}`))
        })
        if (b.type === 'matching-table') {
          for (const domain of domains) if (!domain.length || new Set(domain).size !== domain.length) fail('damaged-matching-labels', p)
        }
      } else if (b.type === 'answer-code' || b.type === 'sequence') {
        if (!b.segments?.length) fail('empty-segments', p)
        for (const [n, s] of (b.segments ?? []).entries()) {
          text(s.value, `${p}/segments/${n}`, s.kind === 'text')
          if (!['text', 'reference'].includes(s.kind)) fail('unsupported-segment', p)
          if (s.kind === 'reference' && (b.type === 'answer-code' || /^[\dIVXABCD ,–—\-]+$/.test(s.value))) {
            const refs = s.value.match(/\b(?:[A-D]|[IVX]+|\d+)\b/g) ?? []
            if (!refs.length || refs.some((r) => !labels.has(r))) fail('malformed-code-reference', `${p}/segments/${n}`)
          }
        }
        if (b.type === 'answer-code' && b.mapping_labels?.length && (new Set(b.mapping_labels).size !== b.mapping_labels.length || b.mapping_labels.some((l) => !labels.has(l)))) fail('invalid-mapping-labels', p)
        if (b.type === 'answer-code' && domains.length >= 2) {
          const joined = b.segments.map((s) => s.value).join('')
          const pairs = [...joined.matchAll(/\b([A-Z]+|\d+)\s*[-–—:]\s*([A-Z]+|\d+)\b/g)]
          const source = b.mapping_labels ?? []
          if (!source.length || source.length !== domains[0].length || source.some((s) => !domains[0].includes(s))) fail('incomplete-matching-labels', p)
          if (pairs.length) {
            if (pairs.length !== source.length || new Set(pairs.map((m) => m[1])).size !== source.length || pairs.some((m) => !source.includes(m[1]) || !domains[1].includes(m[2]))) fail('incomplete-matching-code', p)
          } else {
            const values = b.segments.filter((s) => s.kind === 'reference').map((s) => s.value.trim())
            if (values.length !== source.length || values.some((s) => !domains[1].includes(s))) fail('incomplete-matching-code', p)
          }
        }
      } else if (b.type === 'matching-lists') {
        if (!b.lists || b.lists.length !== 2) { fail('matching-list-dimensions', p); continue }
        b.lists.forEach((l, n) => { text(l.title, `${p}/lists/${n}/title`); items(l.items, `${p}/lists/${n}/items`, depth, true) })
      } else if (b.type === 'pairs') {
        if (!b.items?.length) fail('empty-pairs', p)
        for (const [n, item] of (b.items ?? []).entries()) {
          text(item.left, `${p}/items/${n}/left`); text(item.right, `${p}/items/${n}/right`); text(item.separator, `${p}/items/${n}/separator`)
          if (embeddedInstruction.test(item.left) || embeddedInstruction.test(item.right)) fail('instruction-embedded-in-item', `${p}/items/${n}`)
          if (typeof item.label !== 'string' || typeof item.delimiter !== 'string') fail('orphaned-label', p)
        }
      } else {
        items(b.items, `${p}/items`, depth, b.type !== 'unordered-list')
        if (b.type === 'assertion-reason' && (b.items?.length !== 2 || !/assertion|^A[.): ]*$/i.test(b.items[0].label) || !/reason|^R[.): ]*$/i.test(b.items[1].label))) fail('assertion-reason-structure', p)
      }
    }
  }
  const items = (list, path, depth, labelled) => {
    if (!list?.length || list.length > 30) { fail('empty-or-long-list', path); return }
    const itemLabels = list.map((i) => norm(i.label))
    if (labelled && (itemLabels.some((s) => !s) || new Set(itemLabels).size !== itemLabels.length)) fail('orphaned-or-duplicate-label', path)
    list.forEach((item, i) => {
      if (typeof item.delimiter !== 'string') fail('missing-delimiter', `${path}/${i}`)
      if (item.content?.some((b) => b.type === 'paragraph' && embeddedInstruction.test(b.text))) fail('instruction-embedded-in-item', `${path}/${i}`)
      walk(item.content, `${path}/${i}/content`, depth + 1)
    })
  }
  if (!SUPPORTED_TYPES.includes(question?.type)) fail('unsupported-question-type', '/type')
  walk(question?.content, '/content')
  const stem = textLocations({ content: question?.content }).filter((x) => x.location === 'stem').map((x) => x.text).join(' ')
  if (/\b(?:NOT located in|not situated in)\s*$/i.test(stem)) fail('incomplete-demand', '/content')
  if (question?.content?.[0]?.type === 'paragraph' && /^(?:as|and|or)\b/.test(question.content[0].text.trim())) fail('truncated-stem', '/content/0')
  for (const location of textLocations(question)) {
    const quoteCount = [...location.text.matchAll(/(?<!\p{L})'|'(?!\p{L})/gu)].length
    if (quoteCount % 2 && !/\bs'[\s,.]/.test(location.text)) fail('orphaned-quote', location.path)
  }
  if (!Array.isArray(question?.options) || question.options.map((o) => o.key).join('') !== 'ABCD') fail('broken-option-boundaries', '/options')
  for (const [i, option] of (question?.options ?? []).entries()) walk(option.content, `/options/${i}/content`)
  const optionText = (question?.options ?? []).map((o) => textLocations({ content: o.content }).map((x) => norm(x.text)).join(' ').toLowerCase())
  if (new Set(optionText).size !== 4) fail('duplicate-option-text', '/options')
  if (question?.type === 'sequence' && question.options?.every((o) => o.content.length === 1 && o.content[0].type === 'sequence')) {
    const values = question.options.map((o) => o.content[0].segments.filter((s) => s.kind === 'reference').map((s) => norm(s.value)).sort())
    if (values.some((v) => JSON.stringify(v) !== JSON.stringify(values[0]) || new Set(v).size !== v.length)) fail('inconsistent-sequence-inventory', '/options')
  }
  const blockTypes = new Set()
  const visit = (bs) => { for (const b of bs ?? []) { blockTypes.add(b.type); b.items?.forEach((i) => visit(i.content)); b.lists?.forEach((l) => l.items.forEach((i) => visit(i.content))) } }
  visit(question?.content)
  const required = { statements: ['statement-list', 'ordered-list', 'labelled-sections'], matching: ['matching-lists', 'matching-table'], pairs: ['pairs'], 'assertion-reason': ['assertion-reason'], table: ['table'], propositions: ['labelled-sections', 'statement-list'] }
  if (required[question?.type] && !required[question.type].some((t) => blockTypes.has(t))) fail('type-structure-mismatch', '/type')
  return { pass: reasons.length === 0, reasons }
}
