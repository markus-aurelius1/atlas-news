/** Standalone opt-in raw capture. Never called by the application or its refresh path. */
import { cleanText, canonicalUrl } from '../../../src/current-affairs/feed.ts'
import { NEWS_SOURCES } from '../../../src/current-affairs/sources.ts'
import { feedShards } from '../../../src/current-affairs/shards.ts'
import type { NewsSource } from '../../../src/current-affairs/types.ts'
import type { Byline, Metadata, Observation, RawCapture, SourceCapture } from './contracts.ts'
import { digest, instant, requireThat, unique } from './core.ts'
import { observationId, validateRaw } from './validate.ts'
import { localName, parseXml, textOf } from './xml.ts'
import { bylineCandidates, boundedDistinct } from '../../../src/current-affairs/validator-v3/metadata.ts'

export const PARSER_VERSION = 'tars-eval-metadata/3'
export const REGISTRY_HASH = digest(NEWS_SOURCES)
const LIMIT = 4 * 1024 * 1024
const date = (value: string): string | null => { const parsed = Date.parse(value); return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null }
const distinct = <T>(values: T[]): T[] => [...new Map(values.map(v => [digest(v), v])).values()]
export function parseMetadata(xml: string, source: NewsSource): { metadata: Metadata[]; countBefore: number; invalidEntries: number; truncatedEntries: number } {
  const root = parseXml(xml), atom = localName(root.name) === 'feed'
  requireThat(atom || localName(root.name) === 'rss', 'Expected RSS or Atom')
  const container = atom ? root : root.children.find(n => localName(n.name) === 'channel')
  requireThat(container, 'Missing channel')
  const nodes = container.children.filter(n => localName(n.name) === (atom ? 'entry' : 'item'))
  const metadata: Metadata[] = []; let invalidEntries = 0
  for (const node of nodes.slice(0, 200)) {
    const get = (name: string) => node.children.find(n => name.includes(':') ? n.name.toLowerCase() === name : localName(n.name) === name)
    const link = atom ? node.children.find(n => localName(n.name) === 'link' && (!n.attrs.rel || n.attrs.rel === 'alternate') && (!n.attrs.type || n.attrs.type === 'text/html'))?.attrs.href : textOf(get('link'))
    const url = canonicalUrl(link ?? '', source.siteUrl), title = cleanText(textOf(get('title'))).slice(0, 400)
    if (!link || !url || url.length > 2048 || !title) { invalidEntries++; continue }
    const bylines: Byline[] = bylineCandidates((atom && !node.children.some(n => localName(n.name) === 'author') ? [...node.children, ...root.children.filter(n => localName(n.name) === 'author')] : node.children).map(n => ({ name: atom ? localName(n.name) : n.name, text: atom && localName(n.name) === 'author' ? textOf(n.children.find(c => localName(c.name) === 'name')) : textOf(n) })), atom, source.id).map(({name,provenance}) => ({name,provenance}))
    metadata.push({
      url, title, description: cleanText(textOf(get(atom ? 'summary' : 'description'))).slice(0, 600),
      publisher: source.publisher, memberships: [{ sourceId: source.id, feedUrl: source.feedUrl, section: source.section }],
      categories: boundedDistinct(node.children.filter(n => localName(n.name) === 'category').map(n => cleanText(atom ? n.attrs.term ?? '' : textOf(n)).slice(0, 160)).filter(Boolean), c => c, 30),
      bylines: distinct(bylines).slice(0, 20), publishedAt: date(textOf(get(atom ? 'published' : 'pubdate')) || textOf(get('dc:date'))), updatedAt: date(textOf(get('updated'))),
    })
  }
  return { metadata, countBefore: nodes.length, invalidEntries, truncatedEntries: Math.max(0, nodes.length - 200) }
}
/** One wave, <=6 allowlisted feeds, independent 15s shard budget, 10s/source, no fallback or redirect. */
export async function collectShard(options: {
  captureId: string; shardIndex: number; clock: () => string; fetcher?: typeof fetch; registry?: NewsSource[]
}): Promise<RawCapture> {
  requireThat(options.captureId.length > 0 && options.captureId.length <= 240, 'Invalid capture namespace')
  const registry = options.registry ?? NEWS_SOURCES, registryHash = digest(registry)
  requireThat(registry.length <= 99 && registry.every(s => NEWS_SOURCES.some(allowed => digest(allowed) === digest(s))), 'Collection registry outside verified allowlist')
  unique(registry, s => s.id, 'registry source')
  const shards = feedShards(registry), sources = shards[options.shardIndex]
  requireThat(Number.isInteger(options.shardIndex) && sources?.length && sources.length <= 6, 'Invalid shard')
  const deadline = Date.now() + 15000
  const fetcher = options.fetcher ?? fetch
  const captures: SourceCapture[] = await Promise.all(sources.map(async source => {
    let httpStatus: number | null = null, failure: SourceCapture['failure'] = 'network'
    const controller = new AbortController(), remaining = deadline - Date.now()
    const timer = setTimeout(() => controller.abort(), Math.min(10000, Math.max(1, remaining)))
    try {
      if (remaining <= 0) { failure = 'budget'; throw new Error('Budget') }
      const response = await fetcher(source.feedUrl, {
        signal: controller.signal, redirect: 'error', credentials: 'omit',
        headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml', 'User-Agent': 'TarsCurrentAffairs/1.0 (RSS link reader)' },
      })
      httpStatus = response.status
      if (response.redirected || response.status >= 300 && response.status < 400) { failure = 'redirect'; throw new Error('Redirect') }
      if (!response.ok || !response.body) { failure = 'http'; throw new Error('HTTP') }
      const reader = response.body.getReader(), decoder = new TextDecoder(); let xml = '', bytes = 0
      try {
        while (true) {
          const chunk = await reader.read(); if (chunk.done) break
          bytes += chunk.value.byteLength
          if (bytes > LIMIT) { failure = 'too_large'; throw new Error('Size') }
          xml += decoder.decode(chunk.value, { stream: true })
        }
      } finally { await reader.cancel() }
      xml += decoder.decode()
      failure = 'parse'
      const parsed = parseMetadata(xml, source)
      const capturedAt = options.clock(); instant(capturedAt)
      const observations: Observation[] = parsed.metadata.map((metadata, ordinal) => {
        const base = { captureId: options.captureId, sourceId: source.id, ordinal, capturedAt, parserVersion: PARSER_VERSION, registryHash, metadataHash: digest(metadata), metadata }
        return { ...base, id: observationId(base) }
      })
      return { sourceId: source.id, feedUrl: source.feedUrl, capturedAt, status: parsed.countBefore ? 'ok' : 'empty', httpStatus, failure: null, countBefore: parsed.countBefore, countAfter: observations.length, invalidEntries: parsed.invalidEntries, truncatedEntries: parsed.truncatedEntries, observations }
    } catch {
      return { sourceId: source.id, feedUrl: source.feedUrl, capturedAt: options.clock(), status: 'failed', httpStatus, failure: controller.signal.aborted ? 'timeout' : failure, countBefore: null, countAfter: 0, invalidEntries: null, truncatedEntries: null, observations: [] }
    } finally { clearTimeout(timer) }
  }))
  const result: RawCapture = { version: 'tars-news-raw/v1', id: options.captureId, shardIndex: options.shardIndex, capturedAt: options.clock(), registryHash, parserVersion: PARSER_VERSION, sources: captures }
  validateRaw(result, registry)
  return result
}
