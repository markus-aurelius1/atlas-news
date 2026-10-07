import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { captureSelection, previewSelection, indexArticle, rangeAt, resolveAnchor, type TextIndex, type Located } from '@/current-affairs/reader/highlights/anchors'
import { HIGHLIGHT_COLORS, articleIdentity, type HighlightArticle, type HighlightColor, type ReaderHighlight } from '@/current-affairs/reader/highlights/model'
import { highlights } from '@/current-affairs/reader/highlights/repository'
import { selectionCompletion } from '@/current-affairs/reader/highlights/selection'

interface PreviewEntry { range: Range; color: HighlightColor; id?: string }

export const COLOR_KEY = 'tars.reader.highlight-color.v1'
export const highlightSupport = () => typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined'

export function useHighlights(body: RefObject<HTMLDivElement | null>, html: string | undefined, article: HighlightArticle | null, activeSurface: () => boolean) {
  const [enabled, setEnabled] = useState(false)
  const [records, setRecords] = useState<ReaderHighlight[]>([])
  const [message, setMessage] = useState('')
  const [color, setColor] = useState<HighlightColor>(() => {
    try { const saved = localStorage.getItem(COLOR_KEY); return HIGHLIGHT_COLORS.includes(saved as HighlightColor) ? saved as HighlightColor : 'yellow' } catch { return 'yellow' }
  })
  const index = useRef<TextIndex | null>(null)
  const cached = useRef(new WeakMap<TextIndex, Map<string, { signature: string; located: Located | null }>>())
  const live = useRef({ enabled, color, article, activeSurface })
  live.current = { enabled, color, article, activeSurface }
  const url = article?.articleUrl
  const supported = highlightSupport()
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(''), 5000)
    return () => clearTimeout(timer)
  }, [message])
  useEffect(() => {
    setRecords([])
    setMessage('')
    if (!url) return
    return highlights.observe(url, setRecords, () => setMessage('Highlights could not be read from this device.'))
  }, [url])

  // Index only after rendered content changes. Figures can disappear after a failed image load.
  useEffect(() => {
    const root = body.current
    if (!root || !html) { index.current = null; return }
    const rebuild = () => { index.current = indexArticle(root); repaint.current() }
    rebuild()
    const observer = new MutationObserver(rebuild)
    observer.observe(root, { childList: true, characterData: true, subtree: true })
    return () => { observer.disconnect(); index.current = null }
  }, [body, html, url])

  const recordRef = useRef(records)
  recordRef.current = records
  const handoff = useRef<(painted: Set<string>, known: Set<string>) => void>(() => {})
  const repaint = useRef(() => {})
  repaint.current = () => {
    const textIndex = index.current
    if (!supported || !textIndex) return
    const groups = new Map(HIGHLIGHT_COLORS.map((c) => [c, [] as Range[]]))
    const painted = new Set<string>(), known = new Set<string>()
    const statuses: Array<{ highlightId: string; resolution: ReaderHighlight['resolution'] }> = []
    for (const record of recordRef.current) {
      // Navigation can paint before the new article's repository subscription emits.
      // Never resolve another article's records against this body.
      if (!url || record.articleUrl !== articleIdentity(url)) continue
      known.add(record.highlightId)
      let cache = cached.current.get(textIndex)
      if (!cache) { cache = new Map(); cached.current.set(textIndex, cache) }
      const signature = JSON.stringify(record.anchor)
      const previous = cache.get(record.highlightId)
      const located = previous?.signature === signature ? previous.located : resolveAnchor(textIndex.text, record.anchor)
      if (previous?.signature !== signature) cache.set(record.highlightId, { signature, located })
      const range = located && rangeAt(textIndex, located)
      const resolution = range ? 'resolved' : 'unresolved'
      if (range) { groups.get(record.color)?.push(range); painted.add(record.highlightId) }
      if (resolution !== record.resolution) statuses.push({ highlightId: record.highlightId, resolution })
    }
    for (const [c, ranges] of groups) CSS.highlights.set('tars-' + c, new Highlight(...ranges))
    handoff.current(painted, known)
    void highlights.setResolution(statuses).catch(() => setMessage('Highlight status could not be saved.'))
  }
  useEffect(() => {
    repaint.current()
    return () => { if (supported) for (const c of HIGHLIGHT_COLORS) CSS.highlights.delete('tars-' + c) }
  }, [records, html, supported, url])

  useEffect(() => {
    const root = body.current
    if (!root || !enabled || !supported || !html) return
    let active = true, frame = 0, committed = '', failed = '', committedId: string | undefined
    let durable = new Set<string>()
    let current: ReturnType<typeof previewSelection> = null
    const pending = new Map<string, PreviewEntry>()
    const signature = (selected: NonNullable<typeof current>) => selected.start + ':' + selected.end + ':' + selected.quote
    const paintPreview = () => {
      // Native handles remain in charge; let the custom paint show through their selection fill.
      const key = current && signature(current)
      const hasPaint = key && key !== failed && (key !== committed || pending.has(key) || (committedId && durable.has(committedId)))
      if (hasPaint) root.setAttribute('data-highlight-selection', '')
      else root.removeAttribute('data-highlight-selection')
      const groups = new Map(HIGHLIGHT_COLORS.map((c) => [c, [] as Range[]]))
      for (const entry of pending.values()) groups.get(entry.color)?.push(entry.range)
      if (current && signature(current) !== committed && signature(current) !== failed && !pending.has(signature(current))) groups.get(live.current.color)?.push(current.range)
      for (const [c, ranges] of groups) {
        if (ranges.length) CSS.highlights.set('tars-preview-' + c, new Highlight(...ranges))
        else CSS.highlights.delete('tars-preview-' + c)
      }
    }
    const preview = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        current = live.current.activeSurface() && index.current ? previewSelection(root, index.current, window.getSelection()) : null
        paintPreview()
      })
    }
    // Durable groups have already been installed in this same task. Removing their previews
    // here makes the handoff atomic from the browser's point of view, before its next paint.
    handoff.current = (painted, known) => {
      durable = painted
      if (committedId && !known.has(committedId) && !pending.has(committed)) {
        // Explicit deletion restores native fill and permits a fresh deliberate selection.
        failed = committed; committed = ''; committedId = undefined
      }
      // An already saved but now unresolvable range must not linger as a preview either.
      for (const [key, entry] of pending) if (entry.id && known.has(entry.id)) pending.delete(key)
      paintPreview()
    }
    const complete = selectionCompletion(() => {
      const state = live.current
      if (!state.enabled || !state.article || !state.activeSurface() || !index.current) return
      const selected = captureSelection(root, index.current, window.getSelection())
      if (!selected) return
      const key = selected.anchor.start + ':' + selected.anchor.end + ':' + selected.quote
      if (key === committed || pending.has(key)) return
      current = previewSelection(root, index.current, window.getSelection())
      if (!current) return
      committed = key
      committedId = undefined
      const entry = { range: current.range, color: state.color, id: undefined as string | undefined }
      pending.set(key, entry)
      paintPreview()
      // Each completed selection is independent: a slow earlier transaction must not drop
      // a later mouse selection. Handle movement still resets the existing quiet timer.
      void highlights.create(state.article, selected, state.color, index.current.text)
        .then(({ record, reused }) => {
          if (!active) return
          entry.id = record.highlightId
          if (committed === key) committedId = record.highlightId
          setRecords((rows) => rows.some((row) => row.highlightId === record.highlightId) ? [...rows] : [...rows, record])
          setMessage(reused ? 'Already highlighted. Use colors and edits to recolor.' : 'Highlight saved on this device.')
        })
        .catch((e: unknown) => {
          if (!active) return
          pending.delete(key)
          if (committed === key) committed = ''
          failed = key
          paintPreview()
          setMessage(e instanceof Error ? e.message : 'Highlight could not be saved. Select it again to retry.')
        })
      // Native selection and handles remain intact, including after automatic persistence.
    })
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') lastContact = Date.now()
      if (root.contains(e.target as Node)) complete.pointerDown(e.pointerType || 'mouse')
      else complete.cancel()
    }
    let lastContact = 0
    const up = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || e.pointerType === 'pen') lastContact = Date.now()
      preview()
      complete.pointerUp(e.pointerType || 'mouse')
    }
    // Native mouse selection can take over the Pointer Events stream: Chrome then sends mouseup
    // without pointerup. This fallback completes that real native selection, without capturing it.
    const mouseUp = (e: MouseEvent) => {
      const capability = (e as MouseEvent & { sourceCapabilities?: { firesTouchEvents: boolean } }).sourceCapabilities
      if (!capability?.firesTouchEvents && Date.now() - lastContact > 1500) { preview(); complete.pointerUp('mouse') }
    }
    const touchEnd = () => { lastContact = Date.now(); preview(); complete.pointerUp('touch') }
    const nativeTakeover = () => { complete.cancel(); complete.changed() }
    const changed = () => { failed = ''; preview(); complete.changed() }
    const cancel = () => complete.cancel()
    const scroll = () => complete.cancel()
    document.addEventListener('pointerdown', down, { passive: true })
    document.addEventListener('pointerup', up, { passive: true })
    document.addEventListener('pointercancel', nativeTakeover, { passive: true })
    document.addEventListener('mouseup', mouseUp, { passive: true })
    document.addEventListener('touchend', touchEnd, { passive: true })
    document.addEventListener('selectionchange', changed)
    document.addEventListener('scroll', scroll, { capture: true, passive: true })
    window.addEventListener('blur', cancel)
    return () => {
      root.removeAttribute('data-highlight-selection')
      active = false
      cancelAnimationFrame(frame)
      handoff.current = () => {}
      for (const c of HIGHLIGHT_COLORS) CSS.highlights.delete('tars-preview-' + c)
      complete.destroy()
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('pointerup', up)
      document.removeEventListener('pointercancel', nativeTakeover)
      document.removeEventListener('mouseup', mouseUp)
      document.removeEventListener('touchend', touchEnd)
      document.removeEventListener('selectionchange', changed)
      document.removeEventListener('scroll', scroll, true)
      window.removeEventListener('blur', cancel)
    }
  }, [body, enabled, supported, html, url])

  const choose = useCallback((next: HighlightColor) => {
    setColor(next)
    try { localStorage.setItem(COLOR_KEY, next) } catch { setMessage('Color choice lasts for this visit; device storage is unavailable.') }
  }, [])
  const edit = useCallback((highlightId: string, next?: HighlightColor) => {
    void (next ? highlights.recolor(highlightId, next) : highlights.remove(highlightId))
      .then(() => setMessage(next ? 'Highlight color updated.' : 'Highlight deleted.'))
      .catch(() => setMessage('This change could not be saved. Try again.'))
  }, [])
  /** Only called for an explicitly opened passage, after this article's body has been indexed. */
  const locate = useCallback((highlightId: string) => {
    const row = recordRef.current.find((r) => r.highlightId === highlightId && r.articleUrl === url)
    const textIndex = index.current
    if (!row || !textIndex) return null
    const at = resolveAnchor(textIndex.text, row.anchor)
    return at ? rangeAt(textIndex, at) : null
  }, [url])
  return { enabled, setEnabled, color, choose, records, message, supported, edit, locate }
}
