/** Bounded publisher listing links only. Profile navigation/related links cannot become author attribution. */
import { canonicalUrl, cleanText } from '../../../src/current-affairs/feed.ts'
import type { DiscoveryReference } from './source-audit.ts'
export interface PublisherListing { url: string; publisher: string; authorId: string }
export function listingMetadata(html: string, listing: PublisherListing, discoveredAt: string): DiscoveryReference[] {
  if (html.length > 4*1024*1024) throw new Error('Listing size limit')
  const anchor = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  const links = listing.authorId ? [...html.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)].flatMap(h=>[...h[1].matchAll(anchor)]) : [...html.matchAll(anchor)]
  const prefix = new URL(listing.url).pathname.replace(/^\/section\//,'/article/')
  const rows: DiscoveryReference[] = []
  for (const link of links) {
    const url = canonicalUrl(link[1],listing.url), title = cleanText(link[2]).slice(0,400)
    if (!url || !title || !(/\/article\//.test(url) || /\/article\d+\.ece/.test(url)) || new URL(url).hostname.replace(/^www\./,'') !== new URL(listing.url).hostname.replace(/^www\./,'')) continue
    // Section inventories require the actual section path; other-page recommendations are excluded.
    if (!listing.authorId && !new URL(url).pathname.startsWith(prefix)) continue
    if (!rows.some(r=>r.url===url)) rows.push({url,title,publisher:listing.publisher,referenceUrl:listing.url,discoveredAt,...(listing.authorId?{attributedAuthorId:listing.authorId}:{})})
    if (rows.length>=100) break
  }
  return rows
}
