/** Bounded RSS/Atom metadata parser. DTDs/entities are never executed; full-content tags are ignored. */
import type { NewsItem, NewsSource } from './types.ts'
const entities: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', copy: '©' }
export function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (all, key: string) => {
    if (!key.startsWith('#')) return entities[key.toLowerCase()] ?? all
    const code = key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1))
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : ''
  })
}
export const cleanText = (text: string) => decodeEntities(decodeEntities(text).replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, ' ').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
export function canonicalUrl(value: string, base?: string): string | null {
  try {
    const u = new URL(decodeEntities(value.trim()), base)
    if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) return null
    u.hash = ''
    for (const k of [...u.searchParams.keys()]) if (/^(utm_.+|fbclid|gclid|dclid|mc_cid|mc_eid|cmp|cmpid|ref|ref_src|srsltid)$/i.test(k)) u.searchParams.delete(k)
    u.searchParams.sort()
    return u.href
  } catch { return null }
}
interface XmlNode { name: string; attrs: Record<string, string>; text: string; children: XmlNode[] }
const local = (name: string) => name.split(':').pop()!.toLowerCase()
function parseXml(xml: string): XmlNode {
  if (xml.length > 4 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Unsupported feed XML')
  const root: XmlNode = { name: '', attrs: {}, text: '', children: [] }, stack = [root]
  // A token scanner preserves CDATA and quoted attributes; balanced tags are required.
  const tokens = /<!\[CDATA\[[\s\S]*?\]\]>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<\/?[\w:.-]+(?:\s+[^<>]*?)?\s*\/?>|[^<]+/g
  let cursor = 0, nodes = 0
  for (const match of xml.matchAll(tokens)) {
    if (match.index !== cursor) throw new Error('Malformed XML')
    const token = match[0]; cursor += token.length
    const parent = stack[stack.length - 1]
    if (token.startsWith('<!--') || token.startsWith('<?')) continue
    if (token.startsWith('<![CDATA[')) { parent.text += token.slice(9, -3); continue }
    if (token.startsWith('</')) {
      if (stack.length === 1 || parent.name !== token.slice(2, -1).trim()) throw new Error('Unbalanced XML')
      stack.pop(); continue
    }
    if (token.startsWith('<')) {
      if (++nodes > 60000 || stack.length > 40) throw new Error('Feed XML limit')
      const name = token.match(/^<([\w:.-]+)/)![1], attrs: Record<string, string> = {}
      for (const a of token.matchAll(/([\w:.-]+)\s*=\s*(["'])([\s\S]*?)\2/g)) attrs[a[1]] = decodeEntities(a[3])
      const node = { name, attrs, text: '', children: [] }; parent.children.push(node)
      if (!token.endsWith('/>')) stack.push(node)
    } else parent.text += token
  }
  if (cursor !== xml.length || stack.length !== 1 || root.children.length !== 1 || root.text.trim()) throw new Error('Incomplete XML')
  return root.children[0]
}
const textOf = (node: XmlNode | undefined): string => node ? node.text + node.children.map(textOf).join(' ') : ''
export function thumbnailUrl(value: string, base?: string): string | null {
  try {
    if (value.length > 2048) return null
    const u = new URL(decodeEntities(value.trim()), base)
    if (u.protocol !== 'https:' || u.username || u.password || u.hostname === 'localhost' || u.hostname.endsWith('.local') || /^[\d.]+$/.test(u.hostname) || u.hostname.includes(':')) return null
    return u.href
  } catch { return null }
}
function feedThumbnail(node: XmlNode, description: string, source: NewsSource): string | undefined {
  const media = node.children.flatMap(n => n.name === 'media:group' ? n.children : [n])
  const candidates = [
    ...media.filter(n => n.name === 'media:thumbnail').map(n => n.attrs.url),
    ...media.filter(n => n.name === 'media:content' && (n.attrs.medium === 'image' || n.attrs.type?.startsWith('image/') || /\.(?:jpe?g|png|webp|gif)(?:\?|$)/i.test(n.attrs.url ?? ''))).map(n => n.attrs.url),
    ...node.children.filter(n => (local(n.name) === 'enclosure' || local(n.name) === 'link' && n.attrs.rel === 'enclosure') && n.attrs.type?.startsWith('image/')).map(n => n.attrs.url ?? n.attrs.href),
    ...node.children.filter(n => local(n.name) === 'image').map(n => textOf(n.children.find(c => local(c.name) === 'url'))),
    ...[...description.matchAll(/<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)].map(m => m[1]),
  ]
  for (const candidate of candidates) { const url = candidate && thumbnailUrl(candidate, source.siteUrl); if (url) return url }
}
export function parseFeed(xml: string, source: NewsSource): NewsItem[] {
  const root = parseXml(xml), atom = local(root.name) === 'feed'
  if (!atom && local(root.name) !== 'rss') throw new Error('Expected RSS 2.0 or Atom')
  const container = atom ? root : root.children.find(n => local(n.name) === 'channel')
  if (!container) throw new Error('RSS channel missing')
  const items: NewsItem[] = []
  for (const node of container.children.filter(n => local(n.name) === (atom ? 'entry' : 'item')).slice(0, 200)) {
    const get = (name: string) => node.children.find(n => local(n.name) === name)
    const link = atom ? node.children.find(n => local(n.name) === 'link' && (!n.attrs.rel || n.attrs.rel === 'alternate') && (!n.attrs.type || n.attrs.type === 'text/html'))?.attrs.href : textOf(get('link'))
    const url = canonicalUrl(link ?? '', source.siteUrl), title = cleanText(textOf(get('title'))).slice(0, 400)
    if (!url || !link || !title) continue
    const date = Date.parse(textOf(get(atom ? 'published' : 'pubdate')) || textOf(get('updated')) || textOf(get('date')))
    const description = textOf(get(atom ? 'summary' : 'description')), thumbnail = feedThumbnail(node, description, source)
    items.push({ title, url, publisher: source.publisher, sourceId: source.id, section: source.section, publishedAt: Number.isFinite(date) ? new Date(date).toISOString() : null, description: cleanText(description).slice(0, 600), ...(thumbnail ? { thumbnailUrl: thumbnail } : {}) })
  }
  return items
}
export function dedupeUrls(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>()
  return items.filter(item => { const url = canonicalUrl(item.url); if (!url || seen.has(url)) return false; item.url = url; seen.add(url); return true })
}
