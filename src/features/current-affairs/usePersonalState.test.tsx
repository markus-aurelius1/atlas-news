// @vitest-environment happy-dom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { usePersonalState } from './usePersonalState'
import { readArchive } from '@/current-affairs/archive'
import { articleAdapter } from '@/sync/adapters'
import type { NewsEvent, ClassifiedItem } from '@/current-affairs/types'
vi.mock('@/sync/signal', () => ({ noteLocalChange: vi.fn(), PERSONAL_STATE_EVENT: 'synthetic-personal-change' }))
beforeEach(() => { localStorage.clear(); vi.stubGlobal('indexedDB', new IDBFactory()) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('explicit Save retains body-free metadata for every alternative before cross-device article scan', async () => {
  const members = ['ie-explained', 'hindu-science'].map((sourceId, i) => ({ title: 'Synthetic quantum research report', description: 'Captured short summary', sourceId, publisher: i ? 'The Hindu' : 'Indian Express', section: 'Science', url: i ? 'https://www.thehindu.com/synthetic' : 'https://indianexpress.com/synthetic', publishedAt: null, body: 'PRIVATE_FULL_BODY', html: '<article>PRIVATE_FULL_BODY</article>' })) as unknown as ClassifiedItem[]
  const event: NewsEvent = { id: members[0].url, primary: members[0], members }
  const hook = renderHook(usePersonalState)
  act(() => { expect(hook.result.current.patch(event, { savedAt: 1800000000000 })).toBe(true) })
  await waitFor(async () => expect(await readArchive()).toHaveLength(2))
  const rows = await articleAdapter({ storage: localStorage, archive: indexedDB }).scan(new Map())
  expect(rows.map(r => r.k).sort()).toEqual(members.map(m => m.url).sort())
  expect(rows.every(r => !r.v?.includes('PRIVATE_FULL_BODY'))).toBe(true)
  expect(hook.result.current.state.entries[members[1].url].savedAt).toBe(1800000000000)
  act(() => { hook.result.current.patch(event, { savedAt: undefined }) })
  expect(await articleAdapter({ storage: localStorage, archive: indexedDB }).scan(new Map(rows.map(r => [r.k, { ...r, c: 'article', t: 1800000000000, s: 1 }])))).toEqual(rows.map(r => ({ k: r.k, v: null, d: 1 })))
  expect(await readArchive()).toHaveLength(2)
})
it('read/remove marks do not create metadata retention or fill the curated archive', async () => {
  const member = { title: 'Synthetic report', sourceId: 'ie-explained', publisher: 'Indian Express', section: 'Explained', description: '', url: 'https://indianexpress.com/synthetic', publishedAt: null } as ClassifiedItem
  const hook = renderHook(usePersonalState)
  act(() => { hook.result.current.patch({ id: member.url, primary: member, members: [member] }, { readAt: 1800000000000, ignoredAt: 1800000000000 }) })
  expect(await readArchive()).toEqual([])
})
