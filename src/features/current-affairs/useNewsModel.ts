/**
 * The News reading model: cached feed + local archive → validated, clustered events.
 * Classification is remembered per relevance index, so returning to News (or a
 * background revalidation that changes a handful of items) does not re-run the
 * PYQ-backed validator over the whole feed.
 */
import { useEffect, useMemo, useState } from 'react'
import { clusterItems } from '@/current-affairs/cluster'
import { classify } from '@/current-affairs/relevance'
import { activeFeedItems } from '@/current-affairs/sources'
import type { ClassifiedItem, NewsItem, Relevance, RelevanceIndex } from '@/current-affairs/types'
import { buildWorkspace } from '@/current-affairs/workspace'
import { useArchive } from './useArchive'
import { usePinned } from './usePinned'
import { useFeeds } from './useFeeds'
import { useValidatorSelection } from './useValidatorSelection'
import { displayArticle } from '@/current-affairs/validator-v3/adapter'
import { retainArticles } from '@/current-affairs/archive'
import { readPersonalState } from '@/current-affairs/personal-state'
import { noteLocalChange } from '@/sync/signal'

const verdicts = new WeakMap<RelevanceIndex, Map<string, Relevance>>()

function classified(item: NewsItem, index: RelevanceIndex): ClassifiedItem {
  let seen = verdicts.get(index)
  if (!seen) verdicts.set(index, (seen = new Map()))
  const key = `${item.sourceId}\n${item.publisher}\n${item.section}\n${item.title}\n${item.description}`
  let relevance = seen.get(key)
  if (!relevance) seen.set(key, (relevance = classify(item, index)))
  return { ...item, relevance }
}

export function useNewsModel() {
  const feeds = useFeeds()
  const { data, index } = feeds
  const validator = useValidatorSelection(data, index, feeds.now)
  const [savedMetadataError, setSavedMetadataError] = useState('')
  useEffect(() => {
    if (validator.mode !== 'v3' || !data) return
    // Existing/legacy Saved marks may predate this visit. Recover only their
    // available feed metadata, independently of recommendation acceptance.
    // This does not populate v3's selected-only curated Archive.
    let saved: NewsItem[]
    try { const state = readPersonalState(window.localStorage); saved = activeFeedItems(data.items).filter(m => state.entries[m.url]?.savedAt) }
    catch { return } // Personal-state handling reports corrupt data without altering it.
    if (saved.length) void retainArticles(saved, Date.parse(data.fetchedAt)).then(() => { setSavedMetadataError(''); noteLocalChange() }).catch(() => setSavedMetadataError('Saved marks are preserved, but their available metadata could not be retained for backup and sync.'))
  }, [data, validator.mode])
  const current = useMemo(() => (validator.mode !== 'v3' && data && index ? activeFeedItems(data.items).map((item) => classified(item, index)) : []), [data, index, validator.mode])
  const { archived, archiveError } = useArchive(validator.mode === 'v3' ? [] : current, data?.fetchedAt)
  const all = useMemo(() => {
    if (!index) return []
    if (validator.mode === 'v3') return validator.result?.output.articles.map(a => displayArticle(a.item, index, a.acceptance.accepted, a.editorial)) ?? []
    const items = new Map<string, NewsItem>(archived.map((item) => [item.url, item]))
    const retained = new Map(archived.map((item) => [item.url, item]))
    for (const item of activeFeedItems(data?.items ?? [])) {
      const prior = retained.get(item.url)
      if (!prior || prior.lastSeenAt <= Date.parse(data!.fetchedAt)) items.set(item.url, item)
    }
    return [...items.values()].map((item) => classified(item, index))
  }, [data, index, archived, validator.mode, validator.result])
  const pinned = usePinned()
  const events = useMemo(() => {
    if (!index) return []
    if (validator.mode === 'v3') {
      const selected = validator.result?.events ?? [], listed = new Set(selected.flatMap(e => [...e.members.map(m => m.url), ...(e.overflow ?? [])]))
      const savedOnly = pinned.filter(article => !listed.has(article.url)).map(article => {
        const primary = displayArticle(article, index, false), event = { id: article.url, primary, members: [primary] }
        return { ...event, mustRead: false, priority: 0, priorityReasons: [], minutes: 3, day: 'undated', v3: { selectedAt: 0, today: false, rank: Number.MAX_SAFE_INTEGER, savedOnly: true } }
      })
      return [...selected, ...savedOnly]
    }
    const stories = buildWorkspace(clusterItems(all), index)
    if (!pinned.length) return stories
    // A Saved article is never dropped: when its source has left the registry, its feed no longer carries it or it
    // no longer forms a story, it is listed on its own from the metadata pinned when it was saved.
    const listed = new Set(stories.flatMap((event) => [...event.members.map((m) => m.url), ...(event.overflow ?? [])]))
    const kept = pinned.filter((article) => !listed.has(article.url)).map((article) => { const item = classified(article, index); return { id: item.url, primary: item, members: [item] } })
    return kept.length ? [...stories, ...buildWorkspace(kept, index)] : stories
  }, [all, index, pinned, validator.mode, validator.result])
  return { ...feeds, archived, archiveError: validator.error || savedMetadataError || archiveError, classified: all, events, validator }
}
