/** News: a text-first reading list of publisher links. Feed metadata and Read/Saved state stay authoritative; nothing here fetches an article. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CloudOff, Inbox, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react'
import { useRoute } from '@/app/router'
import { useRouteState } from '@/app/routeState'
import { isTyping } from '@/app/shortcuts'
import { latestPublication, queueCounts, readingScopes, recentCoverage } from '@/current-affairs/analytics'
import { archiveDays, archivePeriods, periodKey, periodLabel, type ArchivePeriod } from '@/current-affairs/archive'
import { eventPersonalState } from '@/current-affairs/personal-state'
import { NEWS_SOURCES, isActiveSource } from '@/current-affairs/sources'
import { groupTopics, type TopicGroup } from '@/current-affairs/topics'
import { editionProgress, filterWorkspace, publicationDay, UNDATED, type ReadingTab, type WorkspaceEvent, type WorkspaceFilters } from '@/current-affairs/workspace'
import { cn } from '@/lib/cn'
import { anyLayerOpen, Sheet } from '@/ui/Sheet'
import { toast } from '@/ui/toast'
import { StoryGroup, type StoryAction } from './StoryGroup'
import { NEWS_REFRESH_TTL_MS, relativeAge } from './useFeeds'
import { useNewsModel } from './useNewsModel'
import { usePersonalState } from './usePersonalState'
import './news.css'

const TABS: Array<{ id: ReadingTab; label: string }> = [
  { id: 'To be Read', label: 'To Read' },
  { id: 'Read', label: 'Read' },
  { id: 'Saved', label: 'Saved' },
]
const ALL = 'All subjects'
/** Syllabus order: how a paper is read, not how loud a story is. */
const SUBJECTS = ['Polity', 'Governance', 'Economy', 'International relations', 'Environment', 'Geography', 'Sci-Tech', 'Security', 'History & Culture', 'General studies']
const GENERAL = 'General studies'
const PAGE = 60
const subjectOf = (event: WorkspaceEvent) => event.primary.relevance.subjects[0] ?? GENERAL
const dateline = (now: number) => new Date(now).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

interface Section {
  key: string
  label: string
  events: WorkspaceEvent[]
  groups: TopicGroup[]
}

export default function NewsScreen() {
  const route = useRoute()
  const debug = route.params.get('debug') === '1' || new URLSearchParams(location.search).get('debug') === '1'
  const { data, loading, refreshing, error, cached, now, online, reload, archived, archiveError, classified, events } = useNewsModel()
  const { state, stateError, patch } = usePersonalState()
  const today = publicationDay(now)
  // The queue, filters and archive position are kept while the app is open (app/routeState.ts); the day always starts as today.
  const [filters, setFilters] = useRouteState<WorkspaceFilters>('current-affairs:filters', () => ({ day: publicationDay(Date.now()), tab: 'To be Read', exam: 'All', subject: ALL, publisher: 'All sources', query: '', budget: null }))
  useEffect(() => {
    const day = publicationDay(Date.now())
    setFilters((f) => (f.day === day ? f : { ...f, day }))
  }, [setFilters])
  const [view, setView] = useRouteState<'Today' | 'Archive'>('current-affairs:view', 'Today')
  const [period, setPeriod] = useRouteState<ArchivePeriod>('current-affairs:period', 'Daily')
  const [archiveKey, setArchiveKey] = useRouteState('current-affairs:archive', 'all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE)
  const searchInput = useRef<HTMLInputElement>(null)
  const searchTrigger = useRef<HTMLButtonElement>(null)
  useEffect(() => setVisibleCount(PAGE), [filters, view, period, archiveKey])

  const scopes = useMemo(() => readingScopes(events, now), [events, now])
  const base = view === 'Today' ? scopes.today : scopes.archive
  const periods = useMemo(() => [...new Set(scopes.archive.map((e) => periodKey(e.day, period)))].sort((a, b) => (a === UNDATED ? 1 : b === UNDATED ? -1 : b.localeCompare(a))), [scopes.archive, period])
  const scope = useMemo(() => {
    if (view !== 'Archive' || archiveKey === 'all') return base
    const included = new Set(archiveDays(base, period, archiveKey))
    return base.filter((e) => included.has(e.day))
  }, [view, archiveKey, base, period])
  const days = useMemo(() => [...new Set(scope.map((e) => e.day))], [scope])
  // Everything but the subject, so the subject index can show what each choice would hold.
  const unfiltered = useMemo(() => filterWorkspace(scope, state, { ...filters, subject: ALL, budget: null, days }), [scope, state, filters, days])
  const filtered = useMemo(() => {
    const rows = filters.budget ? filterWorkspace(scope, state, { ...filters, days }) : filters.subject === ALL ? unfiltered : unfiltered.filter((e) => e.primary.relevance.subjects.includes(filters.subject))
    return view === 'Archive' ? [...rows].sort((a, b) => latestPublication(b) - latestPublication(a) || a.id.localeCompare(b.id)) : rows
  }, [scope, state, filters, days, view, unfiltered])
  const subjectCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of unfiltered) for (const s of e.primary.relevance.subjects.length ? e.primary.relevance.subjects : [GENERAL]) counts.set(s, (counts.get(s) ?? 0) + 1)
    return counts
  }, [unfiltered])
  const subjects = SUBJECTS.filter((s) => subjectCounts.has(s) || filters.subject === s)

  const sections = useMemo<Section[]>(() => {
    const shown = filtered.slice(0, visibleCount)
    // Today shows a story through its past-24-hour coverage; the Archive through everything retained.
    const coverage = (event: WorkspaceEvent) => (view === 'Archive' ? event.members : recentCoverage(event, now))
    const section = (key: string, label: string, events: WorkspaceEvent[]): Section => ({ key, label, events, groups: groupTopics(events, coverage) })
    if (view === 'Archive') {
      const byDay = new Map<string, WorkspaceEvent[]>()
      for (const e of shown) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e])
      return [...byDay].map(([day, list]) => section(day, periodLabel(day, 'Daily'), list))
    }
    if (filters.subject !== ALL || filters.budget) return shown.length ? [section('one', filters.budget ? `${filters.budget}-minute plan` : filters.subject, shown)] : []
    const bySubject = new Map<string, WorkspaceEvent[]>()
    for (const e of shown) bySubject.set(subjectOf(e), [...(bySubject.get(subjectOf(e)) ?? []), e])
    return [...SUBJECTS, ...[...bySubject.keys()].filter((s) => !SUBJECTS.includes(s))].flatMap((s) => (bySubject.has(s) ? [section(s, s, bySubject.get(s)!)] : []))
  }, [filtered, visibleCount, view, filters.subject, filters.budget, now])

  const visibleScope = useMemo(() => scope.filter((e) => !eventPersonalState(e, state).ignoredAt), [scope, state])
  const progress = editionProgress(visibleScope, state)
  const counts = queueCounts(scope, state)
  const stale = !!data && (!online || now - Date.parse(data.fetchedAt) >= NEWS_REFRESH_TTL_MS)
  const unavailable = data?.sources.filter((s) => isActiveSource(s.sourceId) && s.status !== 'ok') ?? []
  // One row per publisher: how many of its section feeds answered at the last refresh.
  const sourceRows = useMemo(() => {
    const rows = new Map<string, { publisher: string; siteUrl: string; feeds: number; down: number }>()
    for (const source of NEWS_SOURCES) {
      if (!isActiveSource(source.id)) continue
      const row = rows.get(source.publisher) ?? { publisher: source.publisher, siteUrl: source.siteUrl, feeds: 0, down: 0 }
      row.feeds++
      if (data && data.sources.find((s) => s.sourceId === source.id)?.status !== 'ok') row.down++
      rows.set(source.publisher, row)
    }
    return [...rows.values()]
  }, [data])
  const publishers = useMemo(() => [...new Set(events.flatMap((e) => e.members.map((m) => m.publisher)))].sort(), [events])
  const updateFilters = useCallback((value: Partial<WorkspaceFilters>) => setFilters((f) => ({ ...f, ...value })), [setFilters])
  const activeFilterCount = [view === 'Archive' && archiveKey !== 'all', filters.publisher !== 'All sources', filters.exam !== 'All', !!filters.budget].filter(Boolean).length
  const resetFilters = () => {
    setArchiveKey('all')
    updateFilters({ day: today, subject: ALL, publisher: 'All sources', exam: 'All', budget: null })
  }
  const changeView = (next: 'Today' | 'Archive') => {
    if (next === view) return
    setView(next)
    setArchiveKey('all')
    updateFilters({ subject: ALL, budget: null })
  }

  // Row actions are stable, so a change to one story re-renders that story only.
  const stateRef = useRef(state)
  stateRef.current = state
  const act = useCallback(
    (event: WorkspaceEvent, action: StoryAction) => {
      const p = eventPersonalState(event, stateRef.current)
      // Opening a link is not reading it: a story leaves To Read only when it is marked.
      if (action === 'read') patch(event, { readAt: p.readAt ? undefined : Date.now() })
      else if (action === 'save') patch(event, { savedAt: p.savedAt ? undefined : Date.now() })
      else if (patch(event, { ignoredAt: Date.now() })) toast({ title: 'Removed from your list', action: { label: 'Undo', run: () => void patch(event, { ignoredAt: p.ignoredAt }) } })
    },
    [patch],
  )

  const closeSearch = () => {
    updateFilters({ query: '' })
    setSearchOpen(false)
    searchTrigger.current?.focus()
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target) || anyLayerOpen()) return
      e.preventDefault()
      setSearchOpen(true)
      requestAnimationFrame(() => searchInput.current?.focus())
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const searching = searchOpen || !!filters.query
  const status = !data ? (archived.length ? (online ? 'Local archive' : 'Offline · local archive') : 'Trusted publisher feeds') : !online ? `Offline · saved ${relativeAge(data.fetchedAt, now)}` : `Updated ${relativeAge(data.fetchedAt, now)}`
  const scopeLabel = view === 'Archive' ? (archiveKey === 'all' ? 'Older articles' : periodLabel(archiveKey, period)) : 'Past 24 hours'
  const emptyTitle = filters.query || activeFilterCount || filters.subject !== ALL ? 'No articles match' : !scope.length ? (error && !events.length ? 'No cached articles available' : view === 'Today' ? 'Nothing new in the past 24 hours' : 'No older articles yet') : filters.tab === 'To be Read' ? 'You’re all caught up' : filters.tab === 'Read' ? 'Nothing read here yet' : 'Nothing saved here yet'
  const emptyBody = filters.query || activeFilterCount || filters.subject !== ALL ? 'Try a different search, subject or filter.' : view === 'Today' ? 'Today holds the past 24 hours. Older reading is in the Archive.' : 'Articles you have seen are kept on this device as you use Tars.'

  return (
    <section className="news" aria-labelledby="news-title">
      <header className="news-head">
        <div className="news-head-row">
          <div className="news-title">
            <h1 id="news-title">News</h1>
            <p role="status">
              <span className="news-dateline">{dateline(now)}</span>
              <span className="news-status" data-stale={stale || undefined}>
                {!online && <CloudOff aria-hidden="true" />}
                {status}
                {data && refreshing && <span className="sr-only">Refreshing in background…</span>}
                {((data && stale) || (!data && cached && archived.length > 0)) && <span className="sr-only">{!data ? (!online ? 'Offline – local archive' : 'Refresh unavailable – local archive') : !online ? 'Offline – cached feed' : 'Refresh due – showing cached feed'}</span>}
              </span>
            </p>
          </div>
          <div className="news-actions">
            <button ref={searchTrigger} type="button" className="tool" aria-label="Search news" title="Search (/)" aria-expanded={searching} aria-controls="news-search" onClick={() => { setSearchOpen(true); requestAnimationFrame(() => searchInput.current?.focus()) }}>
              <Search />
            </button>
            <button type="button" className="tool" aria-label="Filters" title="Filters and sources" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal />
              {activeFilterCount > 0 && <span className="news-badge type-numeric">{activeFilterCount}</span>}
            </button>
            <button type="button" className="tool" aria-label="Refresh news" title="Refresh now" onClick={reload} disabled={refreshing} data-busy={refreshing || undefined}>
              <RefreshCw className={cn(refreshing && 'news-spin')} />
            </button>
          </div>
        </div>

        {searching && (
          <div id="news-search" className="news-search">
            <Search aria-hidden="true" />
            <input
              ref={searchInput}
              type="search"
              aria-label="Search articles, topics or sources"
              placeholder="Search articles, topics or sources"
              value={filters.query}
              onChange={(e) => updateFilters({ query: e.target.value })}
              onKeyDown={(e) => {
                if (e.key !== 'Escape') return
                e.preventDefault()
                e.stopPropagation()
                closeSearch()
              }}
            />
            <button type="button" className="tool" aria-label="Close article search" onClick={closeSearch}>
              <X />
            </button>
          </div>
        )}

        <div className="news-bar">
          <div role="group" aria-label="Reading filter" className="news-tabs">
            {TABS.map(({ id, label }) => (
              <button key={id} type="button" aria-label={id} aria-pressed={filters.tab === id} onClick={() => updateFilters({ tab: id })}>
                {label}
                <span className="type-numeric">{counts[id]}</span>
              </button>
            ))}
          </div>
          <div role="group" aria-label="Edition" className="news-scope">
            {(['Today', 'Archive'] as const).map((v) => (
              <button key={v} type="button" aria-pressed={view === v} aria-label={v} onClick={() => changeView(v)}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="news-progress" role="progressbar" aria-label="Daily reading progress" aria-valuemin={0} aria-valuemax={Math.max(progress.total, 1)} aria-valuenow={progress.read}>
          <span style={{ transform: `scaleX(${progress.total ? progress.read / progress.total : 0})` }} />
        </div>
      </header>

      <div className="news-body">
        <nav className="news-index" aria-label="Subjects">
          <p className="eyebrow">{scopeLabel}</p>
          <p data-edition-progress className="news-index-progress">
            {progress.total > 0 && progress.unread === 0 ? 'Complete' : <><b className="type-numeric">{progress.read}</b> of <span className="type-numeric">{progress.total}</span> read</>}
            <span data-edition-summary> · ~{progress.minutesLeft} min left</span>
          </p>
          <ul role="group" aria-label="Subject filter">
            <li>
              <button type="button" aria-pressed={filters.subject === ALL} onClick={() => updateFilters({ subject: ALL })}>
                All subjects<span className="type-numeric">{unfiltered.length}</span>
              </button>
            </li>
            {subjects.map((s) => (
              <li key={s}>
                <button type="button" aria-pressed={filters.subject === s} onClick={() => updateFilters({ subject: filters.subject === s ? ALL : s })}>
                  {s}
                  <span className="type-numeric">{subjectCounts.get(s) ?? 0}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="news-feed">
          <div className="news-chips scrollbar-none" role="group" aria-label="Subject filter">
            <button type="button" className="pill" aria-pressed={filters.subject === ALL} onClick={() => updateFilters({ subject: ALL })}>
              All
            </button>
            {subjects.map((s) => (
              <button key={s} type="button" className="pill" aria-pressed={filters.subject === s} onClick={() => updateFilters({ subject: filters.subject === s ? ALL : s })}>
                {s}
              </button>
            ))}
          </div>

          {error && <p role="alert" className="news-notice">{error}</p>}
          {stateError && <p role="alert" className="news-notice" data-tone="danger">{stateError}</p>}
          {archiveError && <p role="alert" className="news-notice" data-tone="danger">{archiveError}</p>}
          {(activeFilterCount > 0 || !!filters.query) && (
            <p className="news-summary">
              <span>
                {filtered.length} {filtered.length === 1 ? 'article' : 'articles'}
                {[view === 'Archive' && archiveKey !== 'all' && periodLabel(archiveKey, period), filters.publisher !== 'All sources' && filters.publisher, filters.exam !== 'All' && filters.exam, filters.budget && `~${filtered.reduce((n, e) => n + e.minutes, 0)} min plan`].filter(Boolean).map((part) => ` · ${part}`)}
              </span>
              {activeFilterCount > 0 && (
                <button type="button" onClick={resetFilters}>
                  Reset filters
                </button>
              )}
            </p>
          )}

          <div data-news-list className="news-list" aria-busy={loading || undefined}>
            {loading && (
              <div className="news-skeleton" role="status">
                <span className="sr-only">Loading trusted feeds…</span>
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} aria-hidden="true">
                    <span style={{ width: `${86 - (i % 3) * 14}%` }} />
                    <span style={{ width: `${62 - (i % 2) * 18}%` }} />
                    <span />
                  </div>
                ))}
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="news-empty">
                <Inbox aria-hidden="true" />
                <p>{emptyTitle}</p>
                <span>{emptyBody}</span>
              </div>
            )}
            {sections.map((section) => (
              <section key={section.key} className="news-section" aria-label={section.label}>
                <h2 className="eyebrow">
                  {section.label}
                  <span className="type-numeric">{section.events.length}</span>
                </h2>
                {section.groups.map((group) => (
                  <StoryGroup key={group.key} group={group} state={state} now={now} archive={view === 'Archive'} debug={debug} act={act} />
                ))}
              </section>
            ))}
          </div>
          {filtered.length > visibleCount && (
            <button type="button" className="news-more" onClick={() => setVisibleCount((n) => n + PAGE)}>
              Show more · {filtered.length - visibleCount} remaining
            </button>
          )}
          {debug && (
            <details className="mt-4 text-xs">
              <summary className="min-h-11 cursor-pointer py-3">Debug · {classified.filter((i) => !i.relevance.accepted).length} rejected links</summary>
              <ul className="space-y-2 text-ink-2">
                {classified.filter((i) => !i.relevance.accepted).map((i) => (
                  <li key={i.url}>
                    {i.title} · {i.relevance.rejectionReason} · {i.relevance.signals.join(', ')}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <p className="news-foot">Headlines and excerpts come from publisher feeds and open on the publisher’s site. Only stories that pass the PYQ-backed UPSC check are listed. Reading times are estimates.</p>
        </div>
      </div>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="News filters" size="md">
        <div id="ca-filters" className="news-filters">
          <fieldset>
            <legend className="eyebrow">Exam</legend>
            <div role="group" aria-label="Exam filter" className="news-filter-pills">
              {(['All', 'Prelims', 'Mains', 'Both'] as const).map((value) => (
                <button key={value} type="button" className="pill" aria-pressed={filters.exam === value} onClick={() => updateFilters({ exam: value })}>
                  {value === 'All' ? 'All exams' : value}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="eyebrow">Time budget</legend>
            <div role="group" aria-label="Reading time budget" className="news-filter-pills">
              {[15, 30, 60].map((value) => (
                <button key={value} type="button" className="pill" aria-pressed={filters.budget === value} onClick={() => updateFilters({ budget: filters.budget === value ? null : value })}>
                  {value} min
                </button>
              ))}
            </div>
          </fieldset>
          <label className="news-field">
            <span className="eyebrow">Publisher</span>
            <select aria-label="Publisher filter" value={filters.publisher} onChange={(e) => updateFilters({ publisher: e.target.value })}>
              {['All sources', ...publishers].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          {view === 'Archive' && (
            <div data-archive-controls className="news-field-row">
              <label className="news-field">
                <span className="eyebrow">Archive by</span>
                <select aria-label="Archive grouping" value={period} onChange={(e) => { setPeriod(e.target.value as ArchivePeriod); setArchiveKey('all') }}>
                  {archivePeriods.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="news-field">
                <span className="eyebrow">Period</span>
                <select aria-label="Archive period" value={archiveKey} onChange={(e) => setArchiveKey(e.target.value)}>
                  <option value="all">All older dates</option>
                  {periods.map((key) => (
                    <option key={key} value={key}>
                      {periodLabel(key, period)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {activeFilterCount > 0 && (
            <button type="button" className="news-reset" onClick={resetFilters}>
              Reset filters
            </button>
          )}
          <section className="news-sources" aria-label="News sources">
            <h2 className="eyebrow">Publisher feeds</h2>
            <p>Availability reflects the latest refresh. The feed revalidates every two hours, or when you press refresh.</p>
            <ul>
              {sourceRows.map((row) => (
                <li key={row.publisher} data-status={!data ? 'unknown' : row.down === 0 ? 'ok' : row.down === row.feeds ? 'failed' : 'empty'}>
                  <i aria-hidden="true" />
                  <a href={row.siteUrl} target="_blank" rel="noopener noreferrer">
                    {row.publisher}
                  </a>
                  <span>
                    {row.feeds} {row.feeds === 1 ? 'section' : 'sections'}
                  </span>
                  <span>{!data ? 'Not refreshed' : row.down === 0 ? 'Available' : row.down === row.feeds ? 'Unavailable' : `${row.down} unavailable`}</span>
                </li>
              ))}
            </ul>
            {unavailable.length > 0 && <p>Unavailable or empty sources: {[...new Set(unavailable.map((s) => NEWS_SOURCES.find((n) => n.id === s.sourceId)?.publisher ?? s.sourceId))].join(', ')}.</p>}
          </section>
        </div>
      </Sheet>
    </section>
  )
}
