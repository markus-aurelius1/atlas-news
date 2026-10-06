/**
 * Which publishers the reader may ask for an article, and which it must leave alone.
 *
 * The reader fetches one article, when its headline is opened, from a publisher already in the News registry.
 * Nothing else is ever requested: the list below is the whole of what `/api/article` will contact, so the
 * endpoint cannot be pointed at an arbitrary address. Publishers whose journalism is sold by subscription are
 * `restricted`: they are never fetched, and the reader offers the publisher's own page instead.
 */
import type { NewsSource } from '../types.ts'

export type ReaderMode = 'reader' | 'restricted'
export interface ReaderPublisher {
  /** Registrable domain; subdomains are included. */
  domain: string
  mode: ReaderMode
}

const open = (domain: string): ReaderPublisher => ({ domain, mode: 'reader' })
const restricted = (domain: string): ReaderPublisher => ({ domain, mode: 'restricted' })

export const READER_PUBLISHERS: ReaderPublisher[] = [
  open('downtoearth.org.in'),
  open('indianexpress.com'),
  open('thehindu.com'),
  open('livemint.com'),
  open('hindustantimes.com'),
  open('business-standard.com'),
  open('thehindubusinessline.com'),
  open('tribuneindia.com'),
  open('theguardian.com'),
  open('indiatimes.com'),
  open('indiatoday.in'),
  open('ndtv.com'),
  // NDTV's business desk: its articles arrive in the NDTV feed under this domain.
  open('ndtvprofit.com'),
  open('nenow.in'),
  open('scroll.in'),
  open('bbc.co.uk'),
  open('bbc.com'),
  open('aljazeera.com'),
  open('scmp.com'),
  open('politico.eu'),
  open('nasa.gov'),
  open('substack.com'),
  // Subscription publishers: the feed's headline and excerpt are all Tars shows; the article opens on their site.
  restricted('economist.com'),
  restricted('ft.com'),
  restricted('bloomberg.com'),
  restricted('nytimes.com'),
]

export const MAX_ARTICLE_URL_LENGTH = 2048

export type ArticleTargetError = 'invalid_url' | 'publisher_not_listed' | 'publisher_restricted'
export type ArticleTarget = { ok: true; url: URL; publisher: ReaderPublisher } | { ok: false; error: ArticleTargetError }

const refuse = (error: ArticleTargetError): ArticleTarget => ({ ok: false, error })

export function readerPublisher(hostname: string): ReaderPublisher | null {
  const host = hostname.toLowerCase().replace(/\.$/, '')
  return READER_PUBLISHERS.find((p) => host === p.domain || host.endsWith('.' + p.domain)) ?? null
}

/**
 * The only addresses the reader will fetch: an https page, on the default port, without credentials, on a
 * listed publisher's own domain. A plain-http feed link is upgraded rather than followed as it is.
 */
export function articleTarget(raw: string | null | undefined, base?: URL): ArticleTarget {
  if (!raw || raw.length > MAX_ARTICLE_URL_LENGTH) return refuse('invalid_url')
  let url: URL
  try {
    url = new URL(raw, base)
  } catch {
    return refuse('invalid_url')
  }
  if (url.protocol === 'http:' && !url.port) url.protocol = 'https:'
  if (url.protocol !== 'https:' || url.port || url.username || url.password) return refuse('invalid_url')
  // Names only: an address literal or a single-label host is never a publisher.
  if (!/^(?=.{4,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/i.test(url.hostname)) return refuse('invalid_url')
  const publisher = readerPublisher(url.hostname)
  if (!publisher) return refuse('publisher_not_listed')
  if (publisher.mode === 'restricted') return refuse('publisher_restricted')
  url.hash = ''
  return { ok: true, url, publisher }
}

/** Registry sources whose site has no reader policy: must stay empty (see the policy test). */
export function sourcesWithoutPolicy(sources: NewsSource[]): NewsSource[] {
  return sources.filter((source) => !readerPublisher(new URL(source.siteUrl).hostname))
}
