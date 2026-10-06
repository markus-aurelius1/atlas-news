/**
 * The reader: one article, full screen, set for reading. It opens over News (which stays as it was underneath:
 * queue, filters, scroll position), shows the headline and excerpt from the feed at once, and lays the
 * publisher's text out when it arrives. An article that cannot be shown whole is never shown as if it were:
 * the reader says why and offers the publisher's own page.
 */
import { AnimatePresence, motion, useIsPresent } from 'motion/react'
import { ArrowRight, ArrowUpRight, Bookmark, Check, ChevronDown, ChevronLeft, ChevronUp, Clock, CloudOff, FileText, Lock, LogIn, RotateCw, ShieldAlert } from 'lucide-react'
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { rememberPlace } from '@/app/resume'
import { isTyping } from '@/app/shortcuts'
import { useResolvedDark } from '@/app/theme'
import type { PersonalEntry } from '@/current-affairs/personal-state'
import { SMRY_DAILY, smryUrl } from '@/current-affairs/reader/elsewhere'
import type { ClassifiedItem } from '@/current-affairs/types'
import type { WorkspaceEvent } from '@/current-affairs/workspace'
import { updateSettings, useSettings } from '@/data/hooks'
import { useOnline } from '@/lib/useOnline'
import { SESSION_ENDPOINT } from '@/sync/protocol'
import { SegmentedControl } from '@/ui/controls'
import { M } from '@/ui/motion'
import { isTopLayer, useSurface } from '@/ui/surface/core'
import { Popover } from '@/ui/surface/Popover'
import { Tooltip } from '@/ui/surface/Tooltip'
import { useIsWide } from '@/ui/useMedia'
import { ArticleBody, ReaderFigure } from './ArticleBody'
import { READER_SCALE, setReaderPrefs, useReaderPrefs, type ReaderFace, type ReaderLeading, type ReaderWidth } from './prefs'
import { useArticle, type UnavailableReason } from './useArticle'
import { useSmry } from './useSmry'
import './reader.css'

export interface ReaderEntry {
  item: ClassifiedItem
  event: WorkspaceEvent
}
export interface ReaderProps {
  /** The article address in the route; null when the reader is closed. */
  url: string | null
  /** The article, when it is one the reading list knows. */
  entry: ReaderEntry | null
  /** The reading list is still loading, so an unknown address may yet turn out to be known. */
  resolving: boolean
  personal: PersonalEntry
  prev: ReaderEntry | null
  next: ReaderEntry | null
  /** Where this article sits in the list it was opened from. */
  position: { index: number; total: number } | null
  onClose: () => void
  onNavigate: (url: string) => void
  onAct: (event: WorkspaceEvent, action: 'read' | 'save') => void
}

export function Reader(props: ReaderProps) {
  if (typeof document === 'undefined') return null
  return createPortal(<AnimatePresence>{props.url && <ReaderSurface key="reader" {...props} url={props.url} />}</AnimatePresence>, document.body)
}

const WHEN = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })
const published = (value: string | null | undefined) => {
  const time = Date.parse(value ?? '')
  return Number.isFinite(time) ? WHEN.format(time).replace(/\b(am|pm)\b/, (m) => m.toUpperCase()) + ' IST' : null
}

interface Notice {
  icon: ReactNode
  title: string
  body: string
}
function notice(reason: UnavailableReason, publisher: string): Notice {
  switch (reason) {
    case 'publisher':
      return { icon: <Lock />, title: `Read this on ${publisher}`, body: `${publisher} publishes for its subscribers, so Tars does not fetch its articles.` }
    case 'subscribers':
      return { icon: <Lock />, title: 'For subscribers', body: `${publisher} marks this article as subscriber reading, so Tars has not laid it out.` }
    case 'refused':
      return { icon: <ShieldAlert />, title: `${publisher} declined the request`, body: 'The publisher does not serve this article to reader views, and Tars does not ask twice.' }
    case 'offline':
      return { icon: <CloudOff />, title: 'You’re offline', body: 'Articles are fetched when you open them and are not kept on this device. This one will load when you are back online.' }
    case 'gone':
      return { icon: <FileText />, title: 'This article has moved', body: `${publisher} no longer has a page at this address.` }
    case 'unreadable':
      return { icon: <FileText />, title: 'No article text to show', body: 'This page does not hold an article the reader can lay out. It may be a video, a live page or a gallery.' }
    case 'slow':
      return { icon: <Clock />, title: 'The publisher took too long', body: `${publisher} did not answer in time. Your place in the reading list is unchanged.` }
    case 'session':
      return { icon: <LogIn />, title: 'Session expired', body: 'Sign in again and this article will open where you left it.' }
    default:
      return { icon: <RotateCw />, title: 'Couldn’t load this article', body: 'Something went wrong between Tars and the publisher. Your reading list is unaffected.' }
  }
}

function ReaderSurface({ url, entry, resolving, personal, prev, next, position, onClose, onNavigate, onAct }: ReaderProps & { url: string }) {
  const id = useId()
  const panel = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLSpanElement>(null)
  const progress = useRef<HTMLDivElement>(null)
  const typeButton = useRef<HTMLButtonElement>(null)
  const present = useIsPresent()
  const online = useOnline()
  const prefs = useReaderPrefs()
  const wide = useIsWide()
  const [typeOpen, setTypeOpen] = useState(false)
  // The route handles Back, so this surface adds no history entry of its own.
  useSurface({ open: present, onClose, id, panel, modal: true, history: false })

  const item = entry?.item ?? null
  const smry = useSmry()
  // Leave to sign in, and come back to this article (app/resume.ts).
  const signInAgain = useCallback(() => {
    rememberPlace()
    location.assign(SESSION_ENDPOINT)
  }, [])
  const { state, retry } = useArticle(item, online)
  const article = state.status === 'ready' ? state.article : null
  const read = !!personal.readAt, saved = !!personal.savedAt
  const toggle = useCallback((action: 'read' | 'save') => entry && onAct(entry.event, action), [entry, onAct])
  const step = useCallback((to: ReaderEntry | null) => to && onNavigate(to.item.url), [onNavigate])
  const resize = (by: number) => setReaderPrefs({ size: Math.max(0, Math.min(READER_SCALE.length - 1, prefs.size + by)) })

  // Each article starts at its top, with its controls in view.
  useEffect(() => {
    const el = panel.current
    if (!el) return
    el.scrollTop = 0
    el.removeAttribute('data-quiet')
  }, [url])

  // The bar shows how far through the article the reader is; the controls step back while reading down.
  useEffect(() => {
    const el = panel.current
    if (!el) return
    let frame = 0, last = el.scrollTop
    const paint = () => {
      frame = 0
      const top = el.scrollTop, range = el.scrollHeight - el.clientHeight
      const done = range > 24 ? Math.max(0, Math.min(1, top / range)) : 0
      if (bar.current) bar.current.style.transform = `scaleX(${done})`
      progress.current?.setAttribute('aria-valuenow', String(Math.round(done * 100)))
      el.toggleAttribute('data-scrolled', top > 12)
      el.toggleAttribute('data-deep', top > 280)
      // Reading down hides the controls; any move back up, or the end of the article, returns them.
      if (Math.abs(top - last) > 6) {
        el.toggleAttribute('data-quiet', top > last && top > 160 && top < range - 48)
        last = top
      }
    }
    const onScroll = () => (frame ||= requestAnimationFrame(paint))
    paint()
    el.addEventListener('scroll', onScroll, { passive: true })
    const resized = new ResizeObserver(onScroll)
    resized.observe(el.firstElementChild ?? el)
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('scroll', onScroll)
      resized.disconnect()
    }
  }, [url, state.status])

  // The keys act on the article on screen. The listener is attached once and reads what is current: attached
  // per render it would, for the moment between a paint and its effect, still step from the previous article.
  const live = useRef({ item, next, prev, size: prefs.size, step, toggle })
  live.current = { item, next, prev, size: prefs.size, step, toggle }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { item, next, prev, size, step, toggle } = live.current
      if (!isTopLayer(id) || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || e.defaultPrevented) return
      const key = e.key.toLowerCase()
      const run = (fn: () => void) => {
        e.preventDefault()
        fn()
      }
      if (key === 'arrowright' || key === 'j') run(() => step(next))
      else if (key === 'arrowleft' || key === 'k') run(() => step(prev))
      else if (key === 'm') run(() => toggle('read'))
      else if (key === 's') run(() => toggle('save'))
      else if (key === 'o' && item) run(() => window.open(item.url, '_blank', 'noopener,noreferrer'))
      else if (key === '+' || key === '=') run(() => setReaderPrefs({ size: Math.min(READER_SCALE.length - 1, size + 1) }))
      else if (key === '-') run(() => setReaderPrefs({ size: Math.max(0, size - 1) }))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [id])

  // One set of actions: in the bar where there is room for it, a thumb-reach dock below the text on a phone.
  const tip = wide ? 'bottom' : 'top'
  const actions = (
    <div className="reader-actions" data-dock={wide ? undefined : ''} role="group" aria-label="Article actions">
      <Tooltip label="Previous article" shortcut="K" side={tip}>
        <button type="button" className="tool reader-tool" onClick={() => step(prev)} disabled={!prev} aria-label="Previous article">
          <ChevronUp aria-hidden="true" />
          <span aria-hidden="true">Previous</span>
        </button>
      </Tooltip>
      {position && (
        <span className="reader-position type-numeric" aria-label={`Article ${position.index + 1} of ${position.total}`}>
          {position.index + 1}
          <i aria-hidden="true">/</i>
          {position.total}
        </span>
      )}
      <Tooltip label="Next article" shortcut="J" side={tip}>
        <button type="button" className="tool reader-tool" onClick={() => step(next)} disabled={!next} aria-label="Next article">
          <ChevronDown aria-hidden="true" />
          <span aria-hidden="true">Next</span>
        </button>
      </Tooltip>
      <i className="reader-rule" aria-hidden="true" />
      <Tooltip label={read ? 'Mark unread' : 'Mark as read'} shortcut="M" side={tip}>
        <button type="button" className="tool reader-tool" onClick={() => toggle('read')} disabled={!entry} aria-pressed={read} aria-label="Read" data-kind="read">
          <Check aria-hidden="true" />
          <span aria-hidden="true">Read</span>
        </button>
      </Tooltip>
      <Tooltip label={saved ? 'Remove from Saved' : 'Save'} shortcut="S" side={tip}>
        <button type="button" className="tool reader-tool" onClick={() => toggle('save')} disabled={!entry} aria-pressed={saved} aria-label="Saved" data-kind="save">
          <Bookmark aria-hidden="true" />
          <span aria-hidden="true">{saved ? 'Saved' : 'Save'}</span>
        </button>
      </Tooltip>
    </div>
  )

  const publisher = item?.publisher ?? 'the publisher'
  const date = published(article?.publishedAt ?? item?.publishedAt)
  const failure = state.status === 'unavailable' ? notice(state.reason, publisher) : null
  const standfirst = item?.description && item.description.length > 40 ? item.description : null

  return (
    <motion.div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label={item ? `Reader: ${item.title}` : 'Reader'}
      tabIndex={-1}
      className="reader layer-modal"
      data-reader
      data-face={prefs.face}
      data-width={prefs.width}
      data-leading={prefs.leading}
      data-pinned={typeOpen || undefined}
      style={{ '--reader-scale': READER_SCALE[prefs.size] } as CSSProperties}
      {...M.swap}
    >
      <div className="reader-page">
        <div ref={progress} className="reader-progress" role="progressbar" aria-label="Reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}>
          <span ref={bar} />
        </div>
        <header className="reader-bar">
          <button type="button" className="reader-back" onClick={onClose} aria-label="Back to News" title="Back to News (Esc)">
            <ChevronLeft aria-hidden="true" />
            <span>News</span>
          </button>
          <p className="reader-bar-title" aria-hidden="true">
            {item && (
              <>
                <b>{item.publisher}</b>
                <span>{item.title}</span>
              </>
            )}
          </p>
          <div className="reader-tools">
            {wide && actions}
            <Tooltip label="Text and appearance" side="bottom">
              <button ref={typeButton} type="button" className="tool reader-tool reader-type" onClick={() => setTypeOpen((open) => !open)} aria-expanded={typeOpen} aria-haspopup="dialog" aria-label="Text and appearance">
                <span aria-hidden="true">Aa</span>
              </button>
            </Tooltip>
            {item && (
              <Tooltip label={`Read on ${item.publisher}`} shortcut="O" side="bottom">
                <a className="tool reader-tool reader-original" data-reader-original href={item.url} target="_blank" rel="noopener noreferrer" aria-label="Read Original">
                  <ArrowUpRight aria-hidden="true" />
                  <span>Read Original</span>
                </a>
              </Tooltip>
            )}
          </div>
        </header>

        <main className="reader-sheet">
          {item ? (
            <article key={url} className="reader-article" data-state={state.status}>
              <header className="reader-head">
                <p className="reader-kicker">
                  <b>{item.publisher}</b>
                  <span>{item.section}</span>
                </p>
                <h1 className="reader-title">{item.title}</h1>
                {standfirst && <p className="reader-standfirst">{standfirst}</p>}
                <p className="reader-meta">
                  {article?.byline && <span className="reader-byline">{article.byline}</span>}
                  {date && <time dateTime={article?.publishedAt ?? item.publishedAt ?? undefined}>{date}</time>}
                  {article ? <span>{article.minutes} min read</span> : state.status === 'loading' && entry ? <span>About {entry.event.minutes} min</span> : null}
                </p>
              </header>

              {state.status === 'loading' && (
                <div className="reader-loading" role="status">
                  <span className="sr-only">Loading the article from {item.publisher}…</span>
                  <i className="reader-loading-figure" aria-hidden="true" />
                  {[96, 100, 92, 100, 71, 0, 100, 94, 98, 88, 46].map((width, i) => (width ? <i key={i} aria-hidden="true" style={{ width: `${width}%` }} /> : <br key={i} aria-hidden="true" />))}
                </div>
              )}

              {failure && (
                <section className="reader-notice" role="alert" data-reason={state.status === 'unavailable' ? state.reason : undefined}>
                  <span className="reader-notice-icon" aria-hidden="true">
                    {failure.icon}
                  </span>
                  <h2>{failure.title}</h2>
                  <p>{failure.body}</p>
                  {state.status === 'unavailable' && state.reason === 'session' ? (
                    <div className="reader-notice-actions">
                      <button type="button" className="reader-button" data-variant="primary" data-reader-signin onClick={signInAgain}>
                        <LogIn aria-hidden="true" />
                        Sign in again
                      </button>
                      <a className="reader-button" href={item.url} target="_blank" rel="noopener noreferrer">
                        Read Original
                        <ArrowUpRight aria-hidden="true" />
                      </a>
                    </div>
                  ) : state.status === 'unavailable' && state.reason === 'offline' ? (
                    <div className="reader-notice-actions">
                      <button type="button" className="reader-button" data-variant="primary" onClick={retry}>
                        <RotateCw aria-hidden="true" />
                        Try again
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Exactly two actions. Tars could not show it: the publisher's page, and one reading service outside Tars that the reader may choose. */}
                      <div className="reader-notice-actions" data-reader-elsewhere>
                        <a className="reader-button" data-variant="primary" href={item.url} target="_blank" rel="noopener noreferrer">
                          Read Original
                          <ArrowUpRight aria-hidden="true" />
                        </a>
                        <a className="reader-button" href={smryUrl(item.url)} target="_blank" rel="noopener noreferrer" onClick={() => smry.opened(item.url)} onAuxClick={(e) => e.button === 1 && smry.opened(item.url)}>
                          Read at smry.ai <span className="reader-button-count type-numeric">({smry.count}/{SMRY_DAILY} today)</span>
                        </a>
                      </div>
                    </>
                  )}
                </section>
              )}

              {article && (
                <>
                  {article.partial && (
                    <p className="reader-partial" role="note">
                      <b>This may not be the whole article.</b> {item.publisher} gave the reader a short text. The complete article is on the publisher’s site.
                    </p>
                  )}
                  {article.lead && <ReaderFigure lead src={article.lead.src} alt={article.lead.alt} caption={article.lead.caption ?? undefined} />}
                  <ArticleBody html={article.html} />
                  <footer className="reader-end">
                    <span className="reader-endmark" aria-hidden="true" />
                    <p className="reader-credit">
                      {article.partial ? 'Part of an article' : 'An article'} published by{' '}
                      <a href={item.url} target="_blank" rel="noopener noreferrer">
                        {item.publisher}
                      </a>
                      , shown here in reader view. Fetched for this reading and not kept.
                    </p>
                    <div className="reader-end-actions">
                      <button type="button" className="reader-button" data-variant={read ? undefined : 'primary'} onClick={() => toggle('read')} aria-pressed={read}>
                        <Check aria-hidden="true" />
                        {read ? 'Marked as read' : 'Mark as read'}
                      </button>
                      <a className="reader-button" href={item.url} target="_blank" rel="noopener noreferrer">
                        Read Original
                        <ArrowUpRight aria-hidden="true" />
                      </a>
                    </div>
                  </footer>
                </>
              )}

              {next && state.status !== 'loading' && (
                <button type="button" className="reader-next" onClick={() => step(next)}>
                  <span className="eyebrow">Next · {next.item.publisher}</span>
                  <b>{next.item.title}</b>
                  <ArrowRight aria-hidden="true" />
                </button>
              )}
            </article>
          ) : resolving ? (
            <div className="reader-article reader-loading" role="status">
              <span className="sr-only">Loading…</span>
              {[42, 100, 86].map((width, i) => (
                <i key={i} aria-hidden="true" style={{ width: `${width}%` }} />
              ))}
            </div>
          ) : (
            <div className="reader-article">
              <section className="reader-notice" role="alert" data-reason="missing">
                <span className="reader-notice-icon" aria-hidden="true">
                  <FileText />
                </span>
                <h2>This article isn’t in your reading list</h2>
                <p>It may have been removed, or it comes from a source Tars no longer lists.</p>
                <div className="reader-notice-actions">
                  <button type="button" className="reader-button" data-variant="primary" onClick={onClose}>
                    Back to News
                  </button>
                </div>
              </section>
            </div>
          )}
        </main>
        {!wide && actions}
      </div>

      <Popover open={typeOpen} onClose={() => setTypeOpen(false)} anchor={typeButton} label="Text and appearance" align="end" width={304} sheet={{ title: 'Text and appearance' }}>
        <TypePanel resize={resize} />
      </Popover>
    </motion.div>
  )
}

const FACES: Array<{ value: ReaderFace; label: ReactNode }> = [
  { value: 'serif', label: <span className="reader-face-serif">Serif</span> },
  { value: 'sans', label: 'Sans' },
]
const WIDTHS: Array<{ value: ReaderWidth; label: string }> = [
  { value: 'narrow', label: 'Narrow' },
  { value: 'standard', label: 'Standard' },
  { value: 'wide', label: 'Wide' },
]
const LEADINGS: Array<{ value: ReaderLeading; label: string }> = [
  { value: 'compact', label: 'Compact' },
  { value: 'standard', label: 'Standard' },
  { value: 'relaxed', label: 'Relaxed' },
]

function TypePanel({ resize }: { resize: (by: number) => void }) {
  const prefs = useReaderPrefs()
  const settings = useSettings()
  const dark = useResolvedDark(settings.theme)
  return (
    <div className="reader-type-panel" data-reader-type>
      <div className="reader-size" role="group" aria-label="Text size">
        <button type="button" className="reader-size-step" onClick={() => resize(-1)} disabled={prefs.size === 0} aria-label="Smaller text">
          <span className="reader-size-a" data-size="small" aria-hidden="true">A</span>
        </button>
        <div className="reader-size-scale" role="img" aria-label={`Text size ${prefs.size + 1} of ${READER_SCALE.length}`}>
          {READER_SCALE.map((_, i) => (
            <i key={i} data-on={i <= prefs.size || undefined} data-current={i === prefs.size || undefined} />
          ))}
        </div>
        <button type="button" className="reader-size-step" onClick={() => resize(1)} disabled={prefs.size === READER_SCALE.length - 1} aria-label="Larger text">
          <span className="reader-size-a" data-size="large" aria-hidden="true">A</span>
        </button>
      </div>
      <div className="reader-setting">
        <span className="eyebrow">Typeface</span>
        <SegmentedControl size="sm" label="Typeface" value={prefs.face} onChange={(face) => setReaderPrefs({ face })} options={FACES} />
      </div>
      <div className="reader-setting">
        <span className="eyebrow">Column</span>
        <SegmentedControl size="sm" label="Column width" value={prefs.width} onChange={(width) => setReaderPrefs({ width })} options={WIDTHS} />
      </div>
      <div className="reader-setting">
        <span className="eyebrow">Line spacing</span>
        <SegmentedControl size="sm" label="Line spacing" value={prefs.leading} onChange={(leading) => setReaderPrefs({ leading })} options={LEADINGS} />
      </div>
      <div className="reader-setting">
        <span className="eyebrow">Theme</span>
        <SegmentedControl size="sm" label="Theme" value={dark ? 'dark' : 'light'} onChange={(theme) => void updateSettings({ theme })} options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
      </div>
    </div>
  )
}
