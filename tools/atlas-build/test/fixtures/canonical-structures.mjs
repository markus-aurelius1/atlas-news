/** Minimal complete structures used to exercise every premium component and nested traversal. */
const p = (text) => ({ type: 'paragraph', text })
const item = (label, text) => ({ label, delimiter: '. ', content: [p(text)] })
const options = () => ['A', 'B', 'C', 'D'].map((key, i) => ({ key, content: [p(['One', 'Two', 'Three', 'Four'][i])] }))
const q = (type, content) => ({ number: 1, type, structures: [...new Set(content.map((b) => b.type))], content, options: options() })
export const fixtures = {
  paragraph: q('mcq', [p('Where is Lake Alpha located?')]),
  'statement-list': q('statements', [p('Consider the following statements:'), { type: 'statement-list', items: [item('1', 'Lake Alpha is in the north.'), item('2', 'River Beta flows into it.')] }]),
  'ordered-list': q('statements', [p('Consider the following places:'), { type: 'ordered-list', items: [item('I', 'Lake Alpha'), item('II', 'River Beta')] }]),
  'unordered-list': q('context', [p('Read the following context:'), { type: 'unordered-list', items: [item('•', 'Lake Alpha'), item('•', 'River Beta')] }]),
  pairs: q('pairs', [p('Consider the following pairs:'), { type: 'pairs', items: [{ label: '1', delimiter: '. ', left: 'Lake Alpha', separator: ' : ', right: 'State Gamma', trailing: '.' }] }]),
  'labelled-sections': q('propositions', [p('Consider the following propositions:'), { type: 'labelled-sections', items: [item('Statement I', 'Lake Alpha is a wetland.'), item('Statement II', 'River Beta has a delta.')] }]),
  'assertion-reason': q('assertion-reason', [{ type: 'assertion-reason', items: [{ ...item('Assertion (A): ', 'River Beta flows east.'), delimiter: '' }, { ...item('Reason (R): ', 'The plateau slopes to the sea.'), delimiter: '' }] }]),
  table: q('table', [p('Consider the following information:'), { type: 'table', columns: ['Feature', 'Location'], rows: [['Lake Alpha', 'State Gamma'], ['River Beta', 'Country Delta']] }]),
  'matching-table': q('matching', [p('Match List I with List II:'), { type: 'matching-table', columns: ['List I', 'List II'], rows: [['A. Lake Alpha', '1. State Gamma'], ['B. River Beta', '2. Country Delta']] }]),
  'matching-lists': q('matching', [p('Match List I with List II:'), { type: 'matching-lists', lists: [{ title: 'List I', items: [item('A', 'Lake Alpha'), item('B', 'River Beta')] }, { title: 'List II', items: [item('1', 'State Gamma'), item('2', 'Country Delta'), item('3', 'Region Epsilon')] }] }]),
  sequence: q('sequence', [p('Arrange these rivers from west to east:'), { type: 'ordered-list', items: [item('1', 'River Alpha'), item('2', 'River Beta'), item('3', 'River Gamma'), item('4', 'River Delta')] }]),
  'answer-code': q('statements', [p('Consider the following statements:'), { type: 'statement-list', items: [item('1', 'Lake Alpha is in State Gamma.'), item('2', 'River Beta flows east.')] }]),
  quotation: q('quotation', [p('“Lake Alpha is surrounded by mountains.” Which feature is described?')]),
  context: q('context', [p('A traveller goes north along River Beta.'), p('Which place is reached first?')]),
}
fixtures.sequence.options = ['A', 'B', 'C', 'D'].map((key, i) => ({ key, content: [{ type: 'sequence', segments: [i + 1, ...[1, 2, 3, 4].filter((n) => n !== i + 1)].flatMap((n, j) => [...(j ? [{ kind: 'text', value: ', ' }] : []), { kind: 'reference', value: String(n) }]) }] }))
fixtures['answer-code'].options = ['A', 'B', 'C', 'D'].map((key, i) => ({ key, content: [{ type: 'answer-code', segments: [{ kind: 'reference', value: i % 2 ? '2' : '1' }, { kind: 'text', value: [' only', ' only', ' and 2', ' and 1'][i] }], mapping_labels: [] }] }))
