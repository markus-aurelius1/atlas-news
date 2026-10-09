// @vitest-environment happy-dom
import 'fake-indexeddb/auto'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { makeAnchor } from '@/current-affairs/reader/highlights/anchors'
import { parseHighlight } from '@/current-affairs/reader/highlights/model'
import { highlights } from '@/current-affairs/reader/highlights/repository'
import { HighlightsLibrary } from './HighlightsLibrary'
import { useHighlightLibrary } from './useHighlightLibrary'
// Match the existing Reader tests: happy-dom rejects canceled native animations on unmount.
Reflect.deleteProperty(Element.prototype, 'animate')

const text = 'Prior context. A saved excerpt that can be revised. Final context.'
const row = (id: string, subjectSnapshot: string | null = 'Polity') => parseHighlight({ version: 1, highlightId: id, articleUrl: 'https://www.thehindu.com/' + id, title: 'Article ' + id, publisher: 'The Hindu', sourceId: 'hindu-national', publishedAt: '2026-10-06', subjectSnapshot, categorySnapshot: null, quote: text.slice(15, 48), anchor: makeAnchor(text, 15, 48), color: 'yellow', createdAt: 50, updatedAt: 100, resolution: 'pending' })
const opened = vi.fn()
function Harness({ unavailable = new Set<string>() }: { unavailable?: ReadonlySet<string> }) {
  const library = useHighlightLibrary()
  return <HighlightsLibrary {...library} unavailable={unavailable} open={opened} />
}
beforeEach(async () => { await highlights.records.clear(); opened.mockClear() })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('Highlights library UI', () => {
  it('lists multiple articles and Other, filters/searches locally, opens by stable ID without fetching', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    await highlights.restore([row('a'), row('b', null), { ...row('dead'), deletedAt: 200 }], 'merge')
    render(<Harness />)
    await screen.findByRole('button', { name: 'Article a' })
    expect(screen.getByRole('button', { name: 'Article b' })).toBeTruthy()
    expect(screen.getByRole('region', { name: 'Other' })).toBeTruthy()
    expect(screen.queryByText('Article dead')).toBeNull()
    fireEvent.change(screen.getByRole('combobox', { name: 'Highlight subject' }), { target: { value: 'Other' } })
    expect(screen.queryByText('Article a')).toBeNull()
    fireEvent.change(screen.getByRole('combobox', { name: 'Highlight subject' }), { target: { value: 'All subjects' } })
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Article a' } })
    expect(screen.queryByText('Article b')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Open highlighted passage/ }))
    expect(opened.mock.calls[0][0].highlightId).toBe('a')
    expect(opened.mock.calls[0][1]).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('keeps unavailable/unresolved excerpts readable and edits/delete reactive across reload', async () => {
    await highlights.restore([{ ...row('a'), resolution: 'unresolved' }], 'merge')
    // Restore resets resolution, just as backup import should; a Reader failure resolves it locally.
    await highlights.setResolution([{ highlightId: 'a', resolution: 'unresolved' }])
    const view = render(<Harness unavailable={new Set([row('a').articleUrl])} />)
    await screen.findByText('Passage no longer locatable')
    expect(screen.getByText('Article unavailable · saved passages kept')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Open highlighted passage/ }).textContent).toBe(row('a').quote)
    fireEvent.click(screen.getByRole('button', { name: /Edit highlight/ }))
    const editor = await screen.findByRole('group', { name: /Edit highlight/ })
    fireEvent.click(within(editor).getByRole('button', { name: 'Pink' }))
    await waitFor(() => expect(document.querySelector('.library-quote')?.getAttribute('data-color')).toBe('pink'))
    view.unmount(); render(<Harness />)
    await waitFor(() => expect(document.querySelector('.library-quote')?.getAttribute('data-color')).toBe('pink'))
    fireEvent.click(screen.getByRole('button', { name: /Edit highlight/ }))
    fireEvent.click(await screen.findByRole('button', { name: /Delete highlight/ }))
    await screen.findByText('Your highlights, kept together')
    expect((await highlights.records.get('a'))?.deletedAt).toBeTruthy()
  })
  it('shows duplicate quotes independently and handles storage edit failure', async () => {
    await highlights.restore([row('a'), { ...row('a'), highlightId: 'duplicate' }], 'merge')
    render(<Harness />)
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Open highlighted passage/ })).toHaveLength(2))
    const error = vi.spyOn(highlights, 'remove').mockRejectedValueOnce(new Error('full'))
    fireEvent.click(screen.getAllByRole('button', { name: /Edit highlight/ })[0])
    fireEvent.click(await screen.findByRole('button', { name: /Delete highlight/ }))
    await screen.findByRole('alert')
    expect(screen.getAllByRole('button', { name: /Open highlighted passage/ })).toHaveLength(2)
    error.mockRestore()
  })
})
