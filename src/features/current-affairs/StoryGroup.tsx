/** One topic in the reading list: the anchor article, and everything else on that topic folded underneath it. */
import { Bookmark, Check, ChevronDown, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type MouseEvent } from 'react'
import { thumbnailUrl } from '@/current-affairs/feed'
import { eventPersonalState, type PersonalState } from '@/current-affairs/personal-state'
import type { TopicEntry, TopicGroup } from '@/current-affairs/topics'
import type { WorkspaceEvent } from '@/current-affairs/workspace'
import { prefersReducedMotion } from '@/lib/motion'
import { relativeAge } from './useFeeds'

export type StoryAction = 'read' | 'save' | 'remove'
type Act = (event: WorkspaceEvent, action: StoryAction) => void
type Open = (url: string) => void

/**
 * A headline opens the article in the reader. It is still a link to the publisher: a middle click, a modified
 * click or "open in new tab" goes to the original, as a link should.
 */
const reads = (open: Open, url: string) => (e: MouseEvent<HTMLAnchorElement>) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  e.preventDefault()
  open(url)
}

const FOLD_MS = 220

/** The publisher's own feed image: lazy, without a referrer, and gone if it fails. */
function Thumbnail({ url }: { url?: string }) {
  const [failed, setFailed] = useState(false)
  const safe = url ? thumbnailUrl(url) : null
  useEffect(() => setFailed(false), [url])
  if (!safe || failed) return null
  return <img className="story-thumb" src={safe} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
}

function when(entry: TopicEntry, now: number, archive: boolean) {
  const at = entry.item.publishedAt
  if (!at) return 'Undated'
  return archive ? new Date(at).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' }) : relativeAge(at, now)
}

function Actions({ entry, state, act }: { entry: TopicEntry; state: PersonalState; act: Act }) {
  const p = eventPersonalState(entry.event, state)
  const title = entry.item.title
  return (
    <div className="story-actions">
      <button type="button" className="tool" onClick={() => act(entry.event, 'read')} aria-label={`${p.readAt ? 'Mark unread' : 'Mark as read'}: ${title}`} title={p.readAt ? 'Mark unread' : 'Mark as read'} aria-pressed={!!p.readAt}>
        <Check />
      </button>
      <button type="button" className="tool" onClick={() => act(entry.event, 'save')} aria-label={`${p.savedAt ? 'Unsave' : 'Save'} ${title}`} title={p.savedAt ? 'Remove from Saved' : 'Save'} aria-pressed={!!p.savedAt} data-saved={!!p.savedAt || undefined}>
        <Bookmark />
      </button>
      <button type="button" className="tool" onClick={() => act(entry.event, 'remove')} aria-label={`Remove article: ${title}`} title="Not relevant – remove">
        <X />
      </button>
    </div>
  )
}

export function StoryGroup({ group, state, now, archive, debug, act, open: read }: { group: TopicGroup; state: PersonalState; now: number; archive: boolean; debug: boolean; act: Act; open: Open }) {
  const { anchor, rest } = group
  const [open, setOpen] = useState(false)
  // The folded list stays mounted while it closes, so the collapse is animated too.
  const [closing, setClosing] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const toggle = () => {
    clearTimeout(timer.current)
    if (open && !prefersReducedMotion()) {
      setClosing(true)
      timer.current = setTimeout(() => setClosing(false), FOLD_MS)
    } else setClosing(false)
    setOpen(!open)
  }
  const id = useId()
  const p = eventPersonalState(anchor.event, state)
  const item = anchor.item
  // The anchor story's other publishers sit inside its own row; further stories on the topic follow it.
  const same = rest.filter((entry) => entry.event === anchor.event)
  const others = rest.filter((entry) => entry.event !== anchor.event)
  const shown = open || closing
  const fold = { 'data-fold': open ? 'open' : 'closing' } as const
  return (
    <div className="topic" data-topic={group.topic ?? undefined} data-open={open || undefined}>
      <article data-news-event data-read={!!p.readAt} data-saved={!!p.savedAt} className="story">
        <a data-news-original href={item.url} target="_blank" rel="noopener noreferrer" className="story-main" onClick={reads(read, item.url)}>
          <div className="story-copy">
            <h3 className="story-title">{item.title}</h3>
            {item.description && <p className="story-excerpt">{item.description}</p>}
          </div>
          <Thumbnail url={item.thumbnailUrl} />
        </a>
        <div className="story-foot">
          <p className="story-meta">
            <b>{item.publisher}</b>
            <span>{when(anchor, now, archive)}</span>
            <span className="story-section">{item.section}</span>
            <span title="Approximate reading time">{anchor.event.minutes} min</span>
          </p>
          {rest.length > 0 && (
            <button type="button" className="story-cluster" aria-expanded={open} aria-controls={id} onClick={toggle} title={open ? 'Hide the other articles' : `Show all ${group.count} articles`}>
              {group.topic && <b>{group.topic}</b>}
              <span data-topic-count>{open ? `${group.count} articles` : `+${rest.length} more`}</span>
              <ChevronDown aria-hidden="true" />
            </button>
          )}
          <Actions entry={anchor} state={state} act={act} />
        </div>
        {shown && same.length > 0 && (
          <div className="story-fold" {...fold} id={others.length ? undefined : id}>
            <ul data-related-coverage className="story-related">
              {same.map((entry) => (
                <li key={entry.item.url}>
                  <a href={entry.item.url} target="_blank" rel="noopener noreferrer" onClick={reads(read, entry.item.url)}>
                    <b>{entry.item.publisher}</b>
                    <span>{entry.item.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {debug && (
          <details className="w-full text-xs">
            <summary className="min-h-11 py-3">Evidence</summary>
            <pre className="break-words whitespace-pre-wrap">{JSON.stringify({ ...item.relevance, mustReadScore: anchor.event.priority, members: anchor.event.members.map((m) => m.url) }, null, 2)}</pre>
          </details>
        )}
      </article>
      {shown && others.length > 0 && (
        <div className="story-fold" {...fold} id={id}>
          <ul className="topic-rest">
            {others.map((entry) =>
              entry.lead ? (
                <li key={entry.item.url}>
                  <SubStory entry={entry} state={state} now={now} archive={archive} act={act} open={read} />
                </li>
              ) : (
                <li key={entry.item.url} className="topic-alternate" data-related-coverage>
                  <a href={entry.item.url} target="_blank" rel="noopener noreferrer" onClick={reads(read, entry.item.url)}>
                    <b>{entry.item.publisher}</b>
                    <span>{entry.item.title}</span>
                  </a>
                </li>
              ),
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

/** A further story on the same topic: compact, but with its own Read/Saved state. */
function SubStory({ entry, state, now, archive, act, open }: { entry: TopicEntry; state: PersonalState; now: number; archive: boolean; act: Act; open: Open }) {
  const p = eventPersonalState(entry.event, state)
  return (
    <article data-news-event data-read={!!p.readAt} data-saved={!!p.savedAt} className="story story-sub">
      <a data-news-original href={entry.item.url} target="_blank" rel="noopener noreferrer" className="story-main" onClick={reads(open, entry.item.url)}>
        <h3 className="story-title">{entry.item.title}</h3>
      </a>
      <div className="story-foot">
        <p className="story-meta">
          <b>{entry.item.publisher}</b>
          <span>{when(entry, now, archive)}</span>
          <span title="Approximate reading time">{entry.event.minutes} min</span>
        </p>
        <Actions entry={entry} state={state} act={act} />
      </div>
    </article>
  )
}
