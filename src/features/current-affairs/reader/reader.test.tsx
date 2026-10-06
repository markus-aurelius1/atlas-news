/** The reader in the page: what it draws from sanitized markup, how it reports each outcome, and what it remembers. */
// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClassifiedItem } from '@/current-affairs/types'
import type { WorkspaceEvent } from '@/current-affairs/workspace'
import { KEYS } from '@/lib/storage'
import { ArticleBody } from './ArticleBody'
import { DEFAULT_READER_PREFS, parseReaderPrefs, resetReaderPrefs, setReaderPrefs } from './prefs'
import { Reader, type ReaderEntry } from './Reader'
import { forgetArticles, loadArticle } from './useArticle'

vi.mock('@/data/hooks', () => ({ useSettings: () => ({ theme: 'light' }), updateSettings: vi.fn() }))
// happy-dom's Web Animations reject when cancelled, which an unmount mid-fade does; without them Motion animates in script.
Reflect.deleteProperty(Element.prototype, 'animate')

const sentence = (n: number) => `Paragraph ${n} reports that the committee reviewed the scheme and set out what it found in the districts it visited during the monsoon session.`
const pageHtml = (body: string, head = '') => `<!doctype html><html><head><title>t</title>${head}</head><body><main><article>${body}</article></main></body></html>`
const body = Array.from({ length: 8 }, (_, i) => `<p>${sentence(i + 1)}</p>`).join('')
const relevance = { accepted: true, score: 9, exam: 'both' as const, subjects: ['Polity'], topics: [], staticAnchors: [], signals: [] }
const item = (url: string, title: string, publisher = 'The Hindu'): ClassifiedItem => ({ url, title, publisher, sourceId: 'hindu-national', section: 'National', publishedAt: '2026-10-06T04:30:00.000Z', description: 'The panel found the scheme reached fewer households than planned and asked for an audit.', relevance })
const entry = (url: string, title: string, publisher?: string): ReaderEntry => {
  const primary = item(url, title, publisher)
  return { item: primary, event: { id: url, primary, members: [primary], mustRead: false, priority: 1, priorityReasons: [], minutes: 4, day: '2026-10-06' } as WorkspaceEvent }
}
const first = entry('https://www.thehindu.com/news/national/a/article1.ece', 'Committee reviews the rural scheme')
const second = entry('https://indianexpress.com/article/explained/b-2/', 'Second story on the list', 'Indian Express')
const request = (e: ReaderEntry) => ({ url: e.item.url, title: e.item.title, description: e.item.description, publishedAt: e.item.publishedAt })
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } })

beforeEach(() => { forgetArticles(); resetReaderPrefs(); localStorage.clear() })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('ArticleBody', () => {
  it('draws only what it names, even from markup that was never sanitized', () => {
    const { container } = render(<ArticleBody html={'<p onclick="steal()" class="x">Text <a href="https://example.org/a" onclick="steal()">link</a> <a href="javascript:alert(1)">bad</a></p><script>window.pwned = 1</script><iframe src="about:blank"></iframe><img src="x" onerror="window.pwned = 1"><form><input name="q"></form><h2 style="color:red">Head</h2>'} />)
    expect((window as unknown as { pwned?: number }).pwned).toBeUndefined()
    expect(container.querySelectorAll('script, iframe, form, input, [onclick], [onerror], [style], [class="x"]')).toHaveLength(0)
    const links = container.querySelectorAll('a')
    expect(links).toHaveLength(1)
    expect(links[0].getAttribute('href')).toBe('https://example.org/a')
    expect(links[0].getAttribute('target')).toBe('_blank')
    expect(links[0].getAttribute('rel')).toBe('noopener noreferrer nofollow')
    expect(container.textContent).toContain('bad')
    expect(container.querySelector('h2')?.textContent).toBe('Head')
    // An image address that is not https is not loaded at all.
    expect(container.querySelector('img')).toBeNull()
  })

  it('loads pictures lazily without a referrer, and removes a failed picture with its caption', () => {
    const { container } = render(<ArticleBody html={'<figure><img src="https://cdn.example.org/a.jpg" alt="Dam" width="1200" height="800"><figcaption>The dam in June.</figcaption></figure><p>After.</p><table><tbody><tr><td colspan="2">Cell</td></tr></tbody></table>'} />)
    const img = container.querySelector('img')!
    expect(img.getAttribute('loading')).toBe('lazy')
    expect(img.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(container.querySelector('figcaption')?.textContent).toBe('The dam in June.')
    expect(container.querySelector('.reader-table td')?.getAttribute('colspan')).toBe('2')
    fireEvent.error(img)
    expect(container.querySelector('figure')).toBeNull()
    expect(container.textContent).not.toContain('The dam in June.')
    expect(container.textContent).toContain('After.')
  })
})

describe('reader preferences', () => {
  it('accepts only known values and falls back otherwise', () => {
    expect(parseReaderPrefs(null)).toEqual(DEFAULT_READER_PREFS)
    expect(parseReaderPrefs('{not json')).toEqual(DEFAULT_READER_PREFS)
    expect(parseReaderPrefs(JSON.stringify({ size: 99, face: 'comic', width: 'huge', leading: 3 }))).toEqual(DEFAULT_READER_PREFS)
    expect(parseReaderPrefs(JSON.stringify({ size: 5, face: 'sans', width: 'wide', leading: 'relaxed', extra: 'x' }))).toEqual({ size: 5, face: 'sans', width: 'wide', leading: 'relaxed' })
  })

  it('keeps the choice on this device', () => {
    setReaderPrefs({ face: 'sans', size: 4 })
    expect(JSON.parse(localStorage.getItem(KEYS.reader)!)).toEqual({ ...DEFAULT_READER_PREFS, face: 'sans', size: 4 })
  })
})

describe('loadArticle', () => {
  const signal = () => new AbortController().signal

  it('asks the gateway for exactly the article opened and extracts it', async () => {
    const fetched = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json({ v: 1, url: first.item.url, html: pageHtml(body) }))
    vi.stubGlobal('fetch', fetched)
    const state = await loadArticle(request(first), signal())
    expect(fetched).toHaveBeenCalledTimes(1)
    expect(String(fetched.mock.calls[0][0])).toBe(`/api/article?url=${encodeURIComponent(first.item.url)}`)
    expect(fetched.mock.calls[0][1]?.cache).toBe('no-store')
    expect(state.status === 'ready' && state.article.words).toBeGreaterThan(150)
  })

  it('makes no request for a subscription publisher or an unlisted address', async () => {
    const fetched = vi.fn()
    vi.stubGlobal('fetch', fetched)
    expect(await loadArticle({ ...request(first), url: 'https://www.ft.com/content/abc' }, signal())).toEqual({ status: 'unavailable', reason: 'publisher' })
    expect(await loadArticle({ ...request(first), url: 'https://example.org/a' }, signal())).toEqual({ status: 'unavailable', reason: 'failed' })
    expect(fetched).not.toHaveBeenCalled()
  })

  it('reports each outcome for what it is', async () => {
    const outcome = async (response: () => Response | Promise<Response>) => { vi.stubGlobal('fetch', vi.fn(async () => response())); return loadArticle(request(first), signal()) }
    expect(await outcome(() => json({ error: 'upstream_blocked' }, 502))).toEqual({ status: 'unavailable', reason: 'refused' })
    expect(await outcome(() => json({ error: 'upstream_not_found' }, 502))).toEqual({ status: 'unavailable', reason: 'gone' })
    expect(await outcome(() => json({ error: 'upstream_timeout' }, 504))).toEqual({ status: 'unavailable', reason: 'slow' })
    expect(await outcome(() => json({ error: 'too_large' }, 502))).toEqual({ status: 'unavailable', reason: 'unreadable' })
    expect(await outcome(() => json({ error: 'publisher_restricted' }, 451))).toEqual({ status: 'unavailable', reason: 'publisher' })
    expect(await outcome(() => json({ error: 'unauthenticated' }, 401))).toEqual({ status: 'unavailable', reason: 'session' })
    expect(await outcome(() => new Response('<html>gateway error</html>', { status: 503 }))).toEqual({ status: 'unavailable', reason: 'failed' })
    expect(await outcome(() => json({ v: 1, url: first.item.url, html: pageHtml(body, '<script type="application/ld+json">{"@type":"NewsArticle","isAccessibleForFree":false}</script>') }))).toEqual({ status: 'unavailable', reason: 'subscribers' })
    expect(await outcome(() => json({ v: 1, url: first.item.url, html: pageHtml('<p>Watch the video.</p>') }))).toEqual({ status: 'unavailable', reason: 'unreadable' })
    // A page that claims to come from somewhere the reader does not read is not laid out.
    expect(await outcome(() => json({ v: 1, url: 'https://evil.example/a', html: pageHtml(body) }))).toEqual({ status: 'unavailable', reason: 'failed' })
    expect(await outcome(() => json({ v: 2, url: first.item.url }))).toEqual({ status: 'unavailable', reason: 'failed' })
    expect(await outcome(() => { throw new TypeError('Failed to fetch') })).toEqual({ status: 'unavailable', reason: 'failed' })
  })
})

describe('Reader', () => {
  type Props = Parameters<typeof Reader>[0]
  const props = (over: Partial<Omit<Props, 'onClose' | 'onNavigate' | 'onAct'>> = {}) => ({ url: first.item.url as string | null, entry: first as ReaderEntry | null, resolving: false, personal: {}, prev: null, next: second as ReaderEntry | null, position: { index: 0, total: 2 } as Props['position'], ...over, onClose: vi.fn<Props['onClose']>(), onNavigate: vi.fn<Props['onNavigate']>(), onAct: vi.fn<Props['onAct']>() })

  it('shows the headline at once, then the article, with its controls', async () => {
    let answer: (response: Response) => void = () => {}
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { answer = resolve })))
    const p = props()
    render(<Reader {...p} />)
    const dialog = await screen.findByRole('dialog', { name: `Reader: ${first.item.title}` })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(first.item.title)
    expect(screen.getByRole('status').textContent).toContain('Loading the article from The Hindu')
    expect(dialog.querySelector('.reader-body')).toBeNull()

    await act(async () => { answer(json({ v: 1, url: first.item.url, html: pageHtml(body) })) })
    await waitFor(() => expect(dialog.querySelector('.reader-body')).not.toBeNull())
    expect(dialog.querySelectorAll('.reader-body p')).toHaveLength(8)
    expect(dialog.querySelector('.reader-partial')).toBeNull()
    const original = dialog.querySelector('[data-reader-original]')!
    expect(original.getAttribute('href')).toBe(first.item.url)
    expect(original.getAttribute('target')).toBe('_blank')
    expect(original.getAttribute('rel')).toBe('noopener noreferrer')
    expect(screen.getByRole('progressbar', { name: 'Reading progress' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Read' }))
    fireEvent.click(screen.getByRole('button', { name: 'Saved' }))
    expect(p.onAct.mock.calls).toEqual([[first.event, 'read'], [first.event, 'save']])
    expect((screen.getByRole('button', { name: 'Previous article' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Next article' }))
    expect(p.onNavigate).toHaveBeenCalledWith(second.item.url)
    fireEvent.click(screen.getByRole('button', { name: 'Back to News' }))
    expect(p.onClose).toHaveBeenCalledTimes(1)
  })

  it('reflects Read and Saved, and answers its keys', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ v: 1, url: first.item.url, html: pageHtml(body) })))
    const p = props({ personal: { readAt: 5, savedAt: 6 } })
    render(<Reader {...p} />)
    await waitFor(() => expect(document.querySelector('.reader-body')).not.toBeNull())
    expect(screen.getByRole('button', { name: 'Read' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Saved' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.keyDown(window, { key: 'j' })
    fireEvent.keyDown(window, { key: 'm' })
    fireEvent.keyDown(window, { key: 's' })
    fireEvent.keyDown(window, { key: 'k' })
    expect(p.onNavigate).toHaveBeenCalledTimes(1)
    expect(p.onAct.mock.calls.map((call) => call[1])).toEqual(['read', 'save'])
    fireEvent.keyDown(window, { key: '+' })
    expect(JSON.parse(localStorage.getItem(KEYS.reader)!).size).toBe(DEFAULT_READER_PREFS.size + 1)
    expect((document.querySelector('[data-reader]') as HTMLElement).style.getPropertyValue('--reader-scale')).toBe('1.09')
  })

  it('says a short text may be incomplete', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ v: 1, url: first.item.url, html: pageHtml(`<p>${sentence(1)}</p><p>${sentence(2)}</p><p>${sentence(3)}</p>`) })))
    render(<Reader {...props()} />)
    const note = await screen.findByRole('note')
    expect(note.textContent).toContain('This may not be the whole article')
    expect(document.querySelector('.reader-credit')?.textContent).toContain('Part of an article')
  })

  it('never shows text for a restricted, refused or failed article, and always offers the original', async () => {
    const cases: Array<[Response | null, RegExp, boolean, { url?: string; entry?: ReaderEntry }]> = [
      [json({ v: 1, url: first.item.url, html: pageHtml(body, '<meta property="article:content_tier" content="locked">') }), /For subscribers/, false, {}],
      [json({ error: 'upstream_blocked' }, 502), /The Hindu declined the request/, true, {}],
      [json({ error: 'upstream_unavailable' }, 502), /Couldn’t load this article/, true, {}],
      [null, /Read this on Financial Times/, false, { url: 'https://www.ft.com/content/abc', entry: entry('https://www.ft.com/content/abc', 'A subscription story', 'Financial Times') }],
    ]
    for (const [response, title, retry, over] of cases) {
      forgetArticles()
      const fetched = vi.fn(async () => response!.clone())
      vi.stubGlobal('fetch', fetched)
      const view = render(<Reader {...props(over)} />)
      const alert = await screen.findByRole('alert')
      expect(alert.querySelector('h2')?.textContent).toMatch(title)
      expect(document.querySelector('.reader-body')).toBeNull()
      expect(alert.querySelector('a[target="_blank"]')?.getAttribute('href')).toBe(over.url ?? first.item.url)
      expect(!!screen.queryByRole('button', { name: 'Try again' })).toBe(retry)
      if (!response) expect(fetched).not.toHaveBeenCalled()
      view.unmount()
    }
  })

  it('retries on request, and reports an article that is not in the list', async () => {
    const responses = [json({ error: 'upstream_timeout' }, 504), json({ v: 1, url: first.item.url, html: pageHtml(body) })]
    vi.stubGlobal('fetch', vi.fn(async () => responses.shift()!))
    const view = render(<Reader {...props()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(document.querySelector('.reader-body')).not.toBeNull())
    view.unmount()

    const p = props({ url: 'https://www.thehindu.com/unknown.ece', entry: null, next: null, position: null })
    render(<Reader {...p} />)
    expect((await screen.findByRole('alert')).textContent).toContain('isn’t in your reading list')
    fireEvent.click(screen.getAllByRole('button', { name: 'Back to News' })[1])
    expect(p.onClose).toHaveBeenCalled()
  })

  it('is not in the page when closed', () => {
    render(<Reader {...props({ url: null, entry: null })} />)
    expect(document.querySelector('[data-reader]')).toBeNull()
  })
})
