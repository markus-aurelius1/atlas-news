// @vitest-environment happy-dom
import 'fake-indexeddb/auto'
import { useRef } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { highlights } from '@/current-affairs/reader/highlights/repository'
import type { HighlightArticle } from '@/current-affairs/reader/highlights/model'
import { ArticleBody } from './ArticleBody'
import { useHighlights, COLOR_KEY } from './useHighlights'
import { HighlightControls } from './HighlightControls'

const article: HighlightArticle = { articleUrl: 'https://www.thehindu.com/h1', title: 'Highlight fixture', publisher: 'The Hindu', sourceId: 'hindu-national', publishedAt: null, subjectSnapshot: 'Polity', categorySnapshot: 'National' }
const html = '<p>Before a <em>chosen passage</em> with <a href="https://example.org">a link</a> after.</p><p>The second paragraph continues the argument.</p>'
const paints = new Map()
function Harness({ content = html, available = true, articleUrl = article.articleUrl }: { content?: string; available?: boolean; articleUrl?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const value = useHighlights(ref, content, { ...article, articleUrl }, () => true)
  return <><HighlightControls value={value} available={available} /><ArticleBody html={content} bodyRef={ref} /></>
}
const select = (from = 0, to = 14) => {
  const root = document.querySelector('.reader-body')!
  const node = root.querySelector('em')!.firstChild!
  const range = document.createRange(); range.setStart(node, from); range.setEnd(node, to)
  const selection = window.getSelection()!; selection.removeAllRanges(); selection.addRange(range)
  document.dispatchEvent(new Event('selectionchange'))
}
async function mouseSelect() {
  const root = document.querySelector('.reader-body')!
  fireEvent.pointerDown(root, { pointerType: 'mouse' })
  select()
  fireEvent.pointerUp(root, { pointerType: 'mouse' })
}
beforeEach(async () => {
  await highlights.records.clear()
  paints.clear(); localStorage.clear(); window.getSelection()?.removeAllRanges()
  vi.stubGlobal('CSS', { highlights: paints, supports: () => true })
  vi.stubGlobal('Highlight', class extends Set<Range> { constructor(...ranges: Range[]) { super(ranges) } })
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('Reader highlight integration', () => {
  it('disabled mode leaves native selection/copy intact and creates nothing', async () => {
    render(<Harness />)
    await mouseSelect()
    await new Promise((r) => setTimeout(r, 100))
    expect(await highlights.readByArticle(article.articleUrl)).toEqual([])
    expect(window.getSelection()?.toString()).toBe('chosen passage')
  })
  it('automatically commits mouse, keeps mode on and never mutates article markup', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Highlighter' }))
    const before = document.querySelector('.reader-body')!.innerHTML
    await mouseSelect()
    await waitFor(async () => expect(await highlights.readByArticle(article.articleUrl)).toHaveLength(1))
    expect(screen.getByRole('button', { name: 'Highlighter' }).getAttribute('aria-pressed')).toBe('true')
    expect(document.querySelector('.reader-body')!.innerHTML).toBe(before)
    expect(document.querySelector('mark')).toBeNull()
    expect(window.getSelection()?.toString()).toBe('chosen passage')
    await waitFor(() => expect(paints.get('tars-yellow')?.size).toBe(1))
    await mouseSelect()
    await new Promise((r) => setTimeout(r, 100))
    expect(await highlights.readByArticle(article.articleUrl)).toHaveLength(1)
  })
  describe('pen strokes', () => {
    /** The caret under a point: x is the character offset inside the emphasised phrase "chosen passage". */
    const caret = () => vi.spyOn(document as Document & { caretRangeFromPoint: (x: number, y: number) => Range | null }, 'caretRangeFromPoint').mockImplementation((x: number) => {
      const node = document.querySelector('.reader-body em')!.firstChild!, range = document.createRange()
      range.setStart(node, Math.max(0, Math.min(14, Math.round(x)))); range.collapse(true)
      return range
    })
    const pen = { pointerType: 'pen', pointerId: 7, isPrimary: true, button: 0, clientY: 10 }
    beforeEach(() => { (document as Document & { caretRangeFromPoint?: unknown }).caretRangeFromPoint ??= () => null })
    it('highlights the words a pen is drawn across, at once and without a long press', async () => {
      render(<Harness />)
      fireEvent.click(screen.getByRole('button', { name: 'Highlighter' }))
      caret()
      const root = document.querySelector('.reader-body')!, before = root.innerHTML
      fireEvent.pointerDown(root, { ...pen, clientX: 2 })
      // The page must not scroll under the pen: its movement is claimed from the first touchmove.
      const move = new Event('touchmove', { bubbles: true, cancelable: true }); root.dispatchEvent(move)
      expect(move.defaultPrevented).toBe(true)
      fireEvent.pointerMove(root, { ...pen, clientX: 4 })
      expect(window.getSelection()?.toString()).toBe('')
      fireEvent.pointerMove(root, { ...pen, clientX: 9 })
      // From inside "chosen" to inside "passage": both words are taken whole.
      expect(window.getSelection()?.toString()).toBe('chosen passage')
      fireEvent.pointerUp(root, { ...pen, clientX: 9 })
      fireEvent.touchEnd(root)
      await waitFor(async () => expect(await highlights.readByArticle(article.articleUrl)).toHaveLength(1), { timeout: 600 })
      expect((await highlights.readByArticle(article.articleUrl))[0].quote).toBe('chosen passage')
      await waitFor(() => expect(paints.get('tars-yellow')?.size).toBe(1))
      // No selection or handles are left behind, and the article markup is untouched.
      expect(window.getSelection()?.toString()).toBe(''); expect(root.innerHTML).toBe(before)
    })
    it('a palm resting on the glass does not end or complete the stroke', async () => {
      render(<Harness />)
      fireEvent.click(screen.getByRole('button', { name: 'Highlighter' }))
      caret()
      const root = document.querySelector('.reader-body')!, palm = { pointerType: 'touch', pointerId: 9, isPrimary: false, button: 0, clientX: 300, clientY: 400 }
      fireEvent.pointerDown(root, { ...pen, clientX: 2 }); fireEvent.pointerMove(root, { ...pen, clientX: 4 })
      fireEvent.pointerMove(root, { ...pen, clientX: 5 }); fireEvent.pointerMove(root, { ...pen, clientX: 8 })
      fireEvent.pointerDown(root, palm); fireEvent.pointerUp(root, palm); fireEvent.touchEnd(root)
      fireEvent.pointerMove(root, { ...pen, clientX: 12 })
      expect(window.getSelection()?.toString()).toBe('chosen passage')
      await new Promise((r) => setTimeout(r, 150))
      expect(await highlights.readByArticle(article.articleUrl)).toHaveLength(0)
      fireEvent.pointerUp(root, { ...pen, clientX: 12 })
      await waitFor(async () => expect(await highlights.readByArticle(article.articleUrl)).toHaveLength(1), { timeout: 600 })
    })
    it('a stroke drawn backwards highlights the same words', async () => {
      render(<Harness />)
      fireEvent.click(screen.getByRole('button', { name: 'Highlighter' }))
      caret()
      const root = document.querySelector('.reader-body')!
      fireEvent.pointerDown(root, { ...pen, clientX: 12 }); fireEvent.pointerMove(root, { ...pen, clientX: 1 }); fireEvent.pointerUp(root, { ...pen, clientX: 1 })
      await waitFor(async () => expect((await highlights.readByArticle(article.articleUrl))[0]?.quote).toBe('chosen passage'), { timeout: 600 })
    })
    it('a pen tap highlights nothing, and a finger still scrolls', async () => {
      render(<Harness />)
      fireEvent.click(screen.getByRole('button', { name: 'Highlighter' }))
      caret()
      const root = document.querySelector('.reader-body')!
      fireEvent.pointerDown(root, { ...pen, clientX: 3 }); fireEvent.pointerMove(root, { ...pen, clientX: 5 }); fireEvent.pointerUp(root, { ...pen, clientX: 5 })
      fireEvent.pointerDown(root, { ...pen, pointerType: 'touch', clientX: 2 }); fireEvent.pointerMove(root, { ...pen, pointerType: 'touch', clientX: 12 })
      const move = new Event('touchmove', { bubbles: true, cancelable: true }); root.dispatchEvent(move)
      expect(move.defaultPrevented).toBe(false); expect(window.getSelection()?.toString()).toBe('')
      fireEvent.pointerUp(root, { ...pen, pointerType: 'touch', clientX: 12 })
      await new Promise((r) => setTimeout(r, 150))
      expect(await highlights.readByArticle(article.articleUrl)).toHaveLength(0)
    })
    it('does nothing while the Highlighter is off', async () => {
      render(<Harness />)
      caret()
      const root = document.querySelector('.reader-body')!
      fireEvent.pointerDown(root, { ...pen, clientX: 2 }); fireEvent.pointerMove(root, { ...pen, clientX: 12 })
      const move = new Event('touchmove', { bubbles: true, cancelable: true }); root.dispatchEvent(move)
      expect(move.defaultPrevented).toBe(false); expect(window.getSelection()?.toString()).toBe('')
    })
  })
  it('completes native mouse takeover when mouseup arrives without pointerup', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Highlighter' }))
    const root = document.querySelector('.reader-body')!
    fireEvent.pointerDown(root, { pointerType: 'mouse' })
    select()
    fireEvent.mouseUp(root)
    await waitFor(async () => expect(await highlights.readByArticle(article.articleUrl)).toHaveLength(1))
    await waitFor(() => expect(paints.get('tars-yellow')?.size).toBe(1))
  })
  it('restores paint after close/reopen and harmless React rerender', async () => {
    const first = render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Highlighter' })); await mouseSelect()
    await waitFor(async () => expect(await highlights.readByArticle(article.articleUrl)).toHaveLength(1))
    first.unmount()
    expect(paints.has('tars-yellow')).toBe(false)
    const reopened = render(<Harness />)
    await waitFor(() => expect(paints.get('tars-yellow')?.size).toBe(1))
    reopened.rerender(<Harness content={html.replace('<em>chosen passage</em>', '<em>chosen</em> <strong>passage</strong>')} />)
    await waitFor(() => expect(paints.get('tars-yellow')?.size).toBe(1))
  })
  it('does not paint old records or change their resolution when navigating to another article', async () => {
    const view = render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Highlighter' })); await mouseSelect()
    await waitFor(() => expect(paints.get('tars-yellow')?.size).toBe(1))
    const original = (await highlights.readByArticle(article.articleUrl))[0]
    view.rerender(<Harness articleUrl="https://www.thehindu.com/other-article" content="<p>A completely different article.</p>" />)
    await waitFor(() => expect(paints.get('tars-yellow')?.size).toBe(0))
    expect((await highlights.readByArticle(article.articleUrl))[0]).toEqual(original)
  })
  it('keeps changed article excerpts unresolved without incorrect paint', async () => {
    const view = render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Highlighter' })); await mouseSelect()
    await waitFor(async () => expect(await highlights.readByArticle(article.articleUrl)).toHaveLength(1))
    view.rerender(<Harness content="<p>An entirely unrelated article with none of that passage.</p>" />)
    await waitFor(async () => expect((await highlights.readByArticle(article.articleUrl))[0].resolution).toBe('unresolved'))
    expect(paints.get('tars-yellow')?.size).toBe(0)
  })
  it('ignores toolbar/outside selection and cancels a pending selection on disable', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Highlighter' }))
    const button = screen.getByRole('button', { name: 'Highlighter' })
    const range = document.createRange(); range.selectNodeContents(button)
    window.getSelection()!.removeAllRanges(); window.getSelection()!.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
    fireEvent.pointerUp(button, { pointerType: 'mouse' })
    await new Promise((r) => setTimeout(r, 100))
    expect(await highlights.readByArticle(article.articleUrl)).toHaveLength(0)
    await mouseSelect()
    fireEvent.click(button)
    await new Promise((r) => setTimeout(r, 100))
    expect(await highlights.readByArticle(article.articleUrl)).toHaveLength(0)
  })
  it('persists active color and uses it only for future highlights', async () => {
    localStorage.setItem(COLOR_KEY, 'green')
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Highlighter' })); await mouseSelect()
    await waitFor(async () => expect((await highlights.readByArticle(article.articleUrl))[0]?.color).toBe('green'))
  })
  it('hides feature controls on loading/fallback states', () => {
    render(<Harness available={false} />)
    expect(screen.queryByRole('button', { name: 'Highlighter' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Highlight colors and edits' })).toBeNull()
  })
  it('offers a clear disabled control on unsupported browsers while preserving saved data', () => {
    vi.stubGlobal('CSS', { supports: () => true })
    render(<Harness />)
    expect(screen.getByRole('button', { name: 'Highlighter' }).hasAttribute('disabled')).toBe(true)
  })
  it('paints before a slow durable commit and hands off without clearing native selection', async () => {
    const create = highlights.create.bind(highlights)
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const save = vi.spyOn(highlights, 'create').mockImplementation(async (...args) => { await gate; return create(...args) })
    const remove = paints.delete.bind(paints)
    vi.spyOn(paints, 'delete').mockImplementation((key) => {
      if (key === 'tars-preview-yellow' && paints.has(key)) expect(paints.get('tars-yellow')?.size).toBe(1)
      return remove(key)
    })
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Highlighter' }))
    await mouseSelect()
    await waitFor(() => expect(paints.get('tars-preview-yellow')?.size).toBe(1), { interval: 5 })
    expect(paints.get('tars-yellow')?.size).toBe(0)
    expect(await highlights.readByArticle(article.articleUrl)).toHaveLength(0)
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(paints.get('tars-preview-yellow')?.size).toBe(1)
    release()
    await waitFor(() => expect(paints.get('tars-yellow')?.size).toBe(1))
    expect(paints.has('tars-preview-yellow')).toBe(false)
    expect(window.getSelection()?.toString()).toBe('chosen passage')
  })
  it.each(['touch', 'pen'])('%s handle changes repaint immediately and save only the final range', async (pointerType) => {
    const save = vi.spyOn(highlights, 'create')
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Highlighter' }))
    const root = document.querySelector('.reader-body')!
    fireEvent.pointerDown(root, { pointerType }); select(0, 6); fireEvent.pointerUp(root, { pointerType })
    await waitFor(() => expect([...paints.get('tars-preview-yellow')][0].toString()).toBe('chosen'), { interval: 5 })
    await new Promise((resolve) => setTimeout(resolve, 200))
    select(0, 14)
    await waitFor(() => expect([...paints.get('tars-preview-yellow')][0].toString()).toBe('chosen passage'), { interval: 5 })
    expect(save).not.toHaveBeenCalled()
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1), { timeout: 1800 })
    await waitFor(() => expect(paints.get('tars-yellow')?.size).toBe(1))
    const rows = await highlights.readByArticle(article.articleUrl)
    expect(rows).toHaveLength(1)
    expect(rows[0].quote).toBe('chosen passage')
    expect(paints.has('tars-preview-yellow')).toBe(false)
  })
  it('removes a failed preview without presenting a false saved highlight', async () => {
    vi.spyOn(highlights, 'create').mockRejectedValueOnce(new Error('Device storage is full.'))
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Highlighter' })); await mouseSelect()
    await waitFor(() => expect(paints.get('tars-preview-yellow')?.size).toBe(1), { interval: 5 })
    await screen.findByText('Device storage is full.')
    expect(document.querySelector('.reader-body')?.hasAttribute('data-highlight-selection')).toBe(false)
    expect(paints.has('tars-preview-yellow')).toBe(false)
    expect(paints.get('tars-yellow')?.size).toBe(0)
    expect(await highlights.readByArticle(article.articleUrl)).toHaveLength(0)
  })
  it('keeps rapid completed mouse selections while an earlier save is pending', async () => {
    const create = highlights.create.bind(highlights)
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    const save = vi.spyOn(highlights, 'create').mockImplementation(async (...args) => { await gate; return create(...args) })
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Highlighter' }))
    const root = document.querySelector('.reader-body')!
    fireEvent.pointerDown(root, { pointerType: 'mouse' }); select(0, 6); fireEvent.pointerUp(root, { pointerType: 'mouse' })
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    fireEvent.pointerDown(root, { pointerType: 'mouse' }); select(7, 14); fireEvent.pointerUp(root, { pointerType: 'mouse' })
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2))
    expect(paints.get('tars-preview-yellow')?.size).toBe(2)
    release()
    await waitFor(() => expect(paints.get('tars-yellow')?.size).toBe(2))
    expect((await highlights.readByArticle(article.articleUrl)).map((row) => row.quote).sort()).toEqual(['chosen', 'passage'])
    expect(paints.has('tars-preview-yellow')).toBe(false)
  })

  it('restores native selection fill after explicitly deleting the selected highlight', async () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Highlighter' })); await mouseSelect()
    await waitFor(() => expect(paints.get('tars-yellow')?.size).toBe(1))
    const [row] = await highlights.readByArticle(article.articleUrl)
    expect(document.querySelector('.reader-body')?.hasAttribute('data-highlight-selection')).toBe(true)
    await highlights.remove(row.highlightId)
    await waitFor(() => expect(paints.get('tars-yellow')?.size).toBe(0))
    expect(document.querySelector('.reader-body')?.hasAttribute('data-highlight-selection')).toBe(false)
    expect(window.getSelection()?.toString()).toBe('chosen passage')
    await mouseSelect()
    await waitFor(() => expect(paints.get('tars-yellow')?.size).toBe(1))
    expect((await highlights.readByArticle(article.articleUrl))[0].highlightId).not.toBe(row.highlightId)

  })

})
