import { expect, it } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { readSelection, retainSelection } from './history'
import { storyFrame } from './stories'
import type { NewsItem } from '../types'

it('cold reload preserves stable selected identities and replacement without storing bodies', async () => {
  const factory = new IDBFactory(), now = Date.parse('2026-10-09T00:00:00.000Z')
  const item = { title: 'RBI changes liquidity framework', url: 'https://indianexpress.com/fixture', publisher: 'Indian Express', sourceId: 'ie-explained', section: 'Explained', description: 'Bounded feed excerpt', publishedAt: null, body: 'PRIVATE ARTICLE BODY', html: '<p>private</p>' } as NewsItem
  const selected = { id: 'reading-1', selectedAt: now, lastSelectedAt: now, representative: item, members: [item.url], frame: storyFrame(item) }
  await retainSelection({ history: [{ item, observedAt: now, firstSeenAt: now }], selected: [selected] }, now, factory)
  const restored = await readSelection(factory)
  expect(restored.selected[0].id).toBe('reading-1'); expect(JSON.stringify(restored)).not.toContain('PRIVATE ARTICLE BODY'); expect(JSON.stringify(restored)).not.toContain('<p>private</p>')
  const replacement = { ...item, url: 'https://www.thehindu.com/fixture', publisher: 'The Hindu' }
  await retainSelection({ history: [], selected: [{ ...selected, representative: replacement, members: [replacement.url], lastSelectedAt: now + 1 }] }, now + 1, factory)
  const replaced = await readSelection(factory)
  expect(replaced.selected).toHaveLength(1); expect(replaced.selected[0].representative.url).toBe(replacement.url); expect(replaced.selected[0].selectedAt).toBe(now); expect(replaced.selected[0].members).toHaveLength(2)
  await retainSelection({ history: [], selected: [] }, now + 30 * 86400000, factory)
  expect((await readSelection(factory)).history).toHaveLength(0); expect((await readSelection(factory)).selected).toHaveLength(1)
})

it('late writes cannot overwrite a fresher representative or erase members', async () => {
  const factory = new IDBFactory(), item: NewsItem = { title: 'RBI changes liquidity framework', url: 'https://indianexpress.com/a', publisher: 'Indian Express', sourceId: 'ie-explained', section: 'Explained', description: '', publishedAt: null }
  const newer = { id: 'stable', selectedAt: 1, lastSelectedAt: 20, representative: item, members: [item.url], frame: storyFrame(item) }
  await retainSelection({ history: [], selected: [newer] }, 20, factory)
  await retainSelection({ history: [], selected: [{ ...newer, lastSelectedAt: 10, representative: { ...item, title: 'stale' } }] }, 20, factory)
  expect((await readSelection(factory)).selected[0].representative.title).toBe(item.title)
})
