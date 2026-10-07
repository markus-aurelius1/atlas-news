// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { captureSelection, indexArticle, makeAnchor, rangeAt, resolveAnchor } from './anchors'

function fixture(html: string) {
  const root = document.createElement('div')
  root.innerHTML = html
  document.body.replaceChildren(root)
  const index = indexArticle(root)
  return { root, index }
}
function select(root: HTMLElement, start: Node, from: number, end: Node = start, to = from) {
  const range = document.createRange()
  range.setStart(start, from); range.setEnd(end, to)
  const selection = window.getSelection()!
  selection.removeAllRanges(); selection.addRange(range)
  return { range, captured: captureSelection(root, indexArticle(root), selection) }
}
describe('durable highlight anchors', () => {
  it('restores exact quote + context at the original offsets', () => {
    const text = 'Before this exact passage after it.'
    const anchor = makeAnchor(text, 12, 25)
    expect(resolveAnchor(text, anchor)).toEqual({ start: 12, end: 25 })
  })
  it('restores with prefix/suffix after inserted article text', () => {
    const text = 'A long article introduction and context. Target quote. A long concluding paragraph with context.'
    const a = makeAnchor(text, text.indexOf('Target'), text.indexOf('Target') + 13)
    const shifted = 'New introduction. ' + text
    expect(resolveAnchor(shifted, a)?.start).toBe(a.start + 18)
  })
  it('uses one unchanged long context only for a globally unique quote', () => {
    const text = 'A sufficiently long prefix precedes Target quote and this long suffix follows.'
    const a = makeAnchor(text, text.indexOf('Target'), text.indexOf('Target') + 12)
    expect(resolveAnchor(text.replace('and this long suffix follows.', 'changed ending.'), a)?.start).toBe(a.start)
  })
  it('disambiguates duplicate quotes with context, never distance', () => {
    const text = 'First context: repeated quote. Second distinct context: repeated quote. Finally.'
    const a = makeAnchor(text, text.lastIndexOf('repeated'), text.lastIndexOf('repeated') + 14)
    expect(resolveAnchor(text, a)?.start).toBe(text.lastIndexOf('repeated'))
    expect(resolveAnchor('repeated quote repeated quote', { ...a, prefix: '', suffix: '' })).toBeNull()
  })
  it('refuses repeated passages even when old offsets happen to match', () => {
    const passage = 'x'.repeat(80) + 'quote' + 'z'.repeat(80)
    const text = passage + passage
    expect(resolveAnchor(text, makeAnchor(text, 80, 85))).toBeNull()
  })
  it('keeps substantially changed / contextless text unresolved', () => {
    const text = 'Original context with enough details, the unique quote and original trailing evidence.'
    const a = makeAnchor(text, text.indexOf('the unique'), text.indexOf('the unique') + 16)
    expect(resolveAnchor('Entirely different story uses the unique quote for something else.', a)).toBeNull()
    expect(resolveAnchor('Everything removed.', a)).toBeNull()
  })
  it('bounds duplicate-heavy matching', () => {
    expect(resolveAnchor('quote '.repeat(1000), { version: 1, quote: 'quote', prefix: '', suffix: '', start: 0, end: 5 })).toBeNull()
  })
  it('supports emphasis, links, multiline and harmless markup changes', () => {
    const { root, index } = fixture('<p>Before <em>selected</em> <a href="/">linked</a>\ntext after.</p>')
    const start = root.querySelector('em')!.firstChild!, end = root.querySelector('p')!.lastChild!
    const { captured } = select(root, start, 0, end, 5)
    expect(captured?.anchor.quote).toBe('selected linked text')
    const changed = fixture('<p>Before selected <strong>linked text</strong> after.</p>')
    const located = resolveAnchor(changed.index.text, captured!.anchor)!
    expect(rangeAt(changed.index, located)?.toString()).toBe('selected linked text')
    expect(index.text).toBe(changed.index.text)
  })
  it('captures multi-block selections as one logical range without truncation', () => {
    const { root } = fixture('<p>Before selected first.</p><p>Second chosen after.</p>')
    const paragraphs = root.querySelectorAll('p')
    const { captured } = select(root, paragraphs[0].firstChild!, 7, paragraphs[1].firstChild!, 13)
    expect(captured?.quote).toBe('selected first.Second chosen')
    expect(captured?.anchor.quote).toBe('selected first. Second chosen')
    const index = indexArticle(root)
    expect(rangeAt(index, resolveAnchor(index.text, captured!.anchor)!)?.toString()).toBe(captured!.quote)
  })
  it('rejects partly/outside selections and collapsed or empty selection', () => {
    const { root, index } = fixture('<p>Inside the article.</p>')
    const outside = document.createTextNode('Outside'); document.body.append(outside)
    const text = root.firstChild!.firstChild!
    expect(select(root, text, 2).captured).toBeNull()
    expect(select(root, text, 0, outside, 3).captured).toBeNull()
    expect(select(root, outside, 0, outside, 3).captured).toBeNull()
    expect(captureSelection(root, index, null)).toBeNull()
  })
  it('keeps the exact user excerpt including edge whitespace', () => {
    const { root } = fixture('<p>Before   selected   after.</p>')
    const text = root.firstChild!.firstChild!
    expect(select(root, text, 7, text, 20).captured?.quote).toBe('  selected   ')
  })
  it('normalizes explicit line breaks without joining words', () => {
    const { root, index } = fixture('<p>Before A<br>B after.</p>')
    expect(index.text).toBe('Before A B after.')
    const p = root.querySelector('p')!
    const captured = select(root, p.firstChild!, 7, p.lastChild!, 1).captured!
    expect(captured.anchor.quote).toBe('A B')
    const changed = fixture('<p>Before A B after.</p>')
    expect(resolveAnchor(changed.index.text, captured.anchor)).toEqual({ start: 7, end: 10 })
  })
  it('rejects whole article selection rather than persisting a body', () => {
    const { root } = fixture('<p>The complete body.</p>')
    const text = root.firstChild!.firstChild!
    expect(select(root, text, 0, text, text.textContent!.length).captured).toBeNull()
  })
  it('rejects selections across figures/controls rather than silently omitting text', () => {
    const { root } = fixture('<p>Before.</p><figure><figcaption>Caption</figcaption></figure><p>After.</p>')
    const p = root.querySelectorAll('p')
    expect(select(root, p[0].firstChild!, 1, p[1].firstChild!, 3).captured).toBeNull()
  })
  it('collapses whitespace and inserts block boundaries without separating inline words', () => {
    const { index } = fixture('<p>A <em>word</em>ing\n  line.</p><p>Next.</p>')
    expect(index.text).toBe('A wording line. Next.')
  })
})
