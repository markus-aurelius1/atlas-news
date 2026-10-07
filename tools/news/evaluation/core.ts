import { createHash } from 'node:crypto'
import { canonicalUrl } from '../../../src/current-affairs/feed.ts'

/** Object keys canonicalized; array order remains meaningful (including recommendation order). */
export function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']'
  return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([key, item]) => JSON.stringify(key) + ':' + stableJson(item)).join(',') + '}'
}
export const digest = (value: unknown): string => createHash('sha256').update(stableJson(value)).digest('hex')
export function requireThat(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}
export function instant(value: string): number {
  requireThat(typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value), 'Expected explicit UTC ISO timestamp')
  const parsed = Date.parse(value)
  requireThat(Number.isFinite(parsed) && new Date(parsed).toISOString() === value, 'Invalid timestamp')
  return parsed
}
export function urlIdentity(value: string): string {
  const url = canonicalUrl(value)
  requireThat(url, 'Invalid article URL')
  return url
}
export function unique<T>(rows: T[], key: (row: T) => string, kind: string): void {
  const seen = new Set<string>()
  for (const row of rows) { const id = key(row); requireThat(!seen.has(id), `Duplicate ${kind} identity`); seen.add(id) }
}
export const ordered = <T extends { id: string }>(rows: readonly T[]): T[] => [...rows].sort((a, b) => a.id.localeCompare(b.id, 'en'))
