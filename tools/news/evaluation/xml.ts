/** Isolated evaluation parser, based on feed.ts's bounded scanner; no production exports changed. */
import { decodeEntities } from '../../../src/current-affairs/feed.ts'
export interface XmlNode { name: string; attrs: Record<string, string>; text: string; children: XmlNode[] }
export const localName = (name: string): string => name.split(':').pop()!.toLowerCase()
export const textOf = (node: XmlNode | undefined): string => node ? node.text + node.children.map(textOf).join(' ') : ''
export function parseXml(xml: string): XmlNode {
  if (xml.length > 4 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('Unsupported XML')
  const root: XmlNode = { name: '', attrs: {}, text: '', children: [] }, stack = [root]
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
      if (++nodes > 60000 || stack.length > 40) throw new Error('XML limit')
      const name = token.match(/^<([\w:.-]+)/)![1], attrs: Record<string, string> = {}
      for (const a of token.matchAll(/([\w:.-]+)\s*=\s*(["'])([\s\S]*?)\2/g)) attrs[a[1]] = decodeEntities(a[3])
      parent.children.push({ name, attrs, text: '', children: [] })
      if (!token.endsWith('/>')) stack.push(parent.children[parent.children.length - 1])
    } else parent.text += token
  }
  if (cursor !== xml.length || stack.length !== 1 || root.children.length !== 1 || root.text.trim()) throw new Error('Incomplete XML')
  return root.children[0]
}
