/**
 * The News reading model: cached feed + local archive → validated, clustered events.
 * Classification is remembered per relevance index, so returning to News (or a
 * background revalidation that changes a handful of items) does not re-run the
 * PYQ-backed validator over the whole feed.
 */
import { useMemo } from 'react'
import { clusterItems } from '@/current-affairs/cluster'
import { classify } from '@/current-affairs/relevance'
import { activeFeedItems } from '@/current-affairs/sources'
import type { ClassifiedItem, NewsItem, Relevance, RelevanceIndex } from '@/current-affairs/types'
import { buildWorkspace } from '@/current-affairs/workspace'
import { useArchive } from './useArchive'
import { useFeeds } from './useFeeds'

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
  const current = useMemo(() => (data && index ? activeFeedItems(data.items).map((item) => classified(item, index)) : []), [data, index])
  const { archived, archiveError } = useArchive(current, data?.fetchedAt)
  const all = useMemo(() => {
    if (!index) return []
    const items = new Map<string, NewsItem>(archived.map((item) => [item.url, item]))
    const retained = new Map(archived.map((item) => [item.url, item]))
    for (const item of activeFeedItems(data?.items ?? [])) {
      const prior = retained.get(item.url)
      if (!prior || prior.lastSeenAt <= Date.parse(data!.fetchedAt)) items.set(item.url, item)
    }
    return [...items.values()].map((item) => classified(item, index))
  }, [data, index, archived])
  const events = useMemo(() => (index ? buildWorkspace(clusterItems(all), index) : []), [all, index])
  return { ...feeds, archived, archiveError, classified: all, events }
}
