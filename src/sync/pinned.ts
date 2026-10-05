/** Saved articles as pinned by sync: readable with no feed, no archive row and no network. */
import type { ArchivedArticle } from '@/current-affairs/archive'
import { pinnedArticle } from './adapters.ts'
import { syncStore, type SyncStore } from './store.ts'

export async function readPinnedArticles(store: SyncStore = syncStore()): Promise<ArchivedArticle[]> {
  return [...(await store.collection('article')).values()].flatMap((row) => pinnedArticle(row) ?? [])
}
