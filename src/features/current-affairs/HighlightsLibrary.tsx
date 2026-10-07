import { useMemo, useRef, useState } from 'react'
import { Highlighter, MoreHorizontal, Search, Trash2 } from 'lucide-react'
import { groupHighlights } from '@/current-affairs/reader/highlights/library'
import type { HighlightColor, ReaderHighlight } from '@/current-affairs/reader/highlights/model'
import { highlights } from '@/current-affairs/reader/highlights/repository'
import { Pressable } from '@/ui/controls'
import { Popover } from '@/ui/surface/Popover'
import { PaletteChoices } from './reader/HighlightControls'
import './highlights-library.css'

const dateFormat = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
const date = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? dateFormat.format(new Date(value)) : null
export function HighlightsLibrary({ records, loading, error, unavailable, open }: {
  records: ReaderHighlight[]; loading: boolean; error: string; unavailable: ReadonlySet<string>; open: (record: ReaderHighlight, passage?: boolean) => void
}) {
  const [subject, setSubject] = useState('All subjects')
  const [query, setQuery] = useState('')
  const [message, setMessage] = useState('')
  const [editError, setEditError] = useState('')
  const all = useMemo(() => groupHighlights(records), [records])
  const groups = useMemo(() => groupHighlights(records, query).filter((group) => subject === 'All subjects' || group.subject === subject), [records, query, subject])
  const total = all.reduce((n, group) => n + group.count, 0)
  const edit = (id: string, color?: HighlightColor) => {
    setEditError('')
    void (color ? highlights.recolor(id, color) : highlights.remove(id)).then(() => {
      setMessage(color ? 'Highlight color updated.' : 'Highlight deleted.')
    }).catch(() => setEditError('This change could not be saved. Try again.'))
  }
  return <section className="highlights-library" aria-label="Highlights library" data-highlights-library>
    <h2 className="sr-only">Highlights</h2>
    <div className="news-search library-filters">
      <Search aria-hidden="true" /><input type="search" aria-label="Search highlights" placeholder="Search passages or titles" value={query} onChange={(e) => setQuery(e.target.value)} />
      <label className="news-field"><select aria-label="Highlight subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
        <option>All subjects</option>{all.map((group) => <option key={group.subject}>{group.subject}</option>)}
        {subject !== 'All subjects' && !all.some((g) => g.subject === subject) && <option>{subject}</option>}
      </select></label>
    </div>
    <span className="sr-only" role="status">{message}</span>
    <div className="news-body">
    <aside className="news-index" aria-label="Highlight subjects">
      <p className="eyebrow">Highlights</p><p className="news-index-progress"><b>{total}</b> {total === 1 ? 'passage' : 'passages'} saved for revision</p>
      <ul>{['All subjects', ...all.map((group) => group.subject)].map((name) => <li key={name}><Pressable plain haptic="none" type="button" aria-pressed={subject === name} onClick={() => setSubject(name)}>{name}<span>{name === 'All subjects' ? total : all.find((g) => g.subject === name)?.count}</span></Pressable></li>)}</ul>
    </aside>
    <div className="news-feed">
    <p className="news-summary library-summary">{total} {total === 1 ? 'passage' : 'passages'} · Saved for revision</p>
    {(error || editError) && <p role="alert" className="news-notice" data-tone="danger">{error || editError}</p>}
    {loading ? <p role="status" className="news-empty">Loading saved highlights…</p> : !groups.length && !error ? <div className="news-empty"><Highlighter aria-hidden="true" /><p>{total ? 'No highlights match' : 'Your highlights, kept together'}</p><span>{total ? 'Try another subject or search.' : 'Highlight a passage in the News reader to keep it here for revision.'}</span></div> : null}
    {groups.map((group) => <section key={group.subject} className="news-section library-subject" aria-label={group.subject}>
      <h2 className="eyebrow">{group.subject}<span className="type-numeric">{group.count}</span></h2>
      {group.articles.map(({ articleUrl, snapshot, passages }) => <article key={articleUrl} className="story library-article" data-library-article={articleUrl}>
        <header><h3 className="story-title"><Pressable className="story-main" plain haptic="none" type="button" onClick={() => open(snapshot)}>{snapshot.title || 'Untitled article'}</Pressable></h3>
          <p className="story-meta library-meta"><b>{snapshot.publisher}</b>{date(snapshot.publishedAt) && <time dateTime={snapshot.publishedAt!}>{date(snapshot.publishedAt)}</time>}<span>{passages.length} {passages.length === 1 ? 'highlight' : 'highlights'}</span></p>
          {unavailable.has(articleUrl) && <p className="library-availability">Article unavailable · saved passages kept</p>}
        </header>
        <ul>{passages.map((row) => <Passage key={row.highlightId} row={row} open={open} edit={edit} />)}</ul>
      </article>)}
    </section>)}
    </div></div>
  </section>
}

function Passage({ row, open, edit }: { row: ReaderHighlight; open: (row: ReaderHighlight, passage?: boolean) => void; edit: (id: string, color?: HighlightColor) => void }) {
  const anchor = useRef<HTMLButtonElement>(null)
  const [editing, setEditing] = useState(false)
  return <li data-library-highlight={row.highlightId}>
    <div className="library-passage">
      <Pressable plain haptic="none" type="button" className="library-quote" data-color={row.color} onClick={() => open(row, true)} aria-label={'Open highlighted passage: ' + row.quote}><span>{row.quote}</span></Pressable>
      <Pressable plain haptic="none" ref={anchor} type="button" className="tool library-menu" aria-label={'Edit highlight: ' + row.quote.slice(0, 40)} aria-haspopup="dialog" aria-expanded={editing} onClick={() => setEditing(!editing)}><MoreHorizontal aria-hidden="true" /></Pressable>
    </div>
    {row.resolution === 'unresolved' && <p className="library-availability">Passage no longer locatable</p>}
    <Popover open={editing} onClose={() => setEditing(false)} anchor={anchor} label="Edit saved highlight" align="end" minWidth={280} sheet={{ title: 'Edit highlight' }}>
      <div className="highlight-panel library-edit" role="group" aria-label={'Edit highlight: ' + row.quote.slice(0, 40)}>
        <PaletteChoices color={row.color} onChoose={(color) => edit(row.highlightId, color)} />
        <Pressable plain haptic="none" type="button" className="tool" aria-label={'Delete highlight: ' + row.quote.slice(0, 40)} onClick={() => edit(row.highlightId)}><Trash2 aria-hidden="true" /></Pressable>
      </div>
    </Popover>
  </li>
}
