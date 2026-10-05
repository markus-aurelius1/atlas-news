/** Dedicated semantic components as a shared presentation tree for React and the developer audit. Source punctuation/order is preserved. */
const node = (tag, children, className = '') => ({ tag, className, children })
const labelled = (item) => node('li', [node('span', [item.label + item.delimiter], 'pyq-label'), ...blockNodes(item.content)], 'pyq-item')
export function blockNodes(blocks) {
  return blocks.map((b) => {
    if (b.type === 'paragraph') return node('p', [b.text], 'pyq-paragraph')
    if (b.type === 'pairs') return node('ul', b.items.map((i) => node('li', [node('span', [i.label + i.delimiter], 'pyq-label'), i.left, i.separator, i.right, i.trailing ?? ''], 'pyq-item')), 'pyq-pairs')
    if (b.type === 'matching-lists') return node('div', b.lists.map((l) => node('section', [node('h4', [l.title]), node('ul', l.items.map(labelled), 'pyq-list')])), 'pyq-matching-lists')
    if (b.type === 'table' || b.type === 'matching-table') {
      const ordinal = !b.columns[0].trim() && b.rows.every((r) => /^\s*(?:\d+|[IVX]+)[.)]\s*$/.test(r[0]))
      return node('div', [node('table', [...(b.columns.some((s) => s.trim()) ? [node('thead', [node('tr', b.columns.map((s, c) => node('th', [s], ordinal && c === 0 ? 'pyq-ordinal' : '')))])] : []), node('tbody', b.rows.map((r) => node('tr', r.map((s, c) => node('td', [s], ordinal && c === 0 ? 'pyq-ordinal' : '')))))], 'pyq-table')], 'pyq-table-scroll')
    }
    if (b.type === 'answer-code' || b.type === 'sequence') return node('p', [...(b.mapping_labels?.length ? [node('span', [b.mapping_labels.join(' ')], 'pyq-code-labels')] : []), ...b.segments.map((s) => s.value)], `pyq-${b.type}`)
    if (['statement-list', 'ordered-list', 'unordered-list', 'labelled-sections', 'assertion-reason'].includes(b.type)) return node('ul', b.items.map(labelled), `pyq-list pyq-${b.type}`)
    throw new Error(`Unsupported premium block: ${b.type}`)
  })
}
export const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
export function nodesHtml(nodes) {
  return nodes.map((n) => typeof n === 'string' ? escapeHtml(n) : `<${n.tag}${n.className ? ` class="${n.className}"` : ''}>${nodesHtml(n.children)}</${n.tag}>`).join('')
}
