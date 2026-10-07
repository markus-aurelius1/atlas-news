/** Provenance observations only. Feed sections/categories never become eligibility or primary-subject labels. */
import type { NewsItem } from '../types.ts'
import { boundSource, optionalMetadata } from './metadata.ts'
export function sourceIntelligence(item: NewsItem) {
  const metadata = optionalMetadata(item)
  const sources = (metadata.memberships ?? []).flatMap(m => boundSource(item.url, item.publisher, m) ?? [])
  return { memberships: metadata.memberships ?? [], categories: metadata.categories ?? [], bylines: metadata.bylines ?? [],
    verifiedPublisher: sources.length ? item.publisher : null,
    sections: [...new Set(sources.map(s => s.section))].sort(),
    missing: [!item.description && 'description', !metadata.bylines?.length && 'bylines', !metadata.categories?.length && 'categories', !item.publishedAt && 'publication_time'].filter((s): s is string => !!s) }
}
