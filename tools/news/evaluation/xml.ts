/** Shared bounded scanner: full-content nodes remain excluded by metadata parsers. */
export { parseXml, textOf } from '../../../src/current-affairs/feed.ts'
export type { XmlNode } from '../../../src/current-affairs/feed.ts'
export const localName = (name: string): string => name.split(':').pop()!.toLowerCase()
