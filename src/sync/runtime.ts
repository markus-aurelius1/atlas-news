/**
 * Runs the sync engine in the browser: once at start, shortly after anything changes here, when the app wakes
 * or the network returns, and every few minutes while it is open. One exchange at a time, in one tab.
 */
import { liveQuery } from 'dexie'
import { CA_STATE_KEY } from '@/current-affairs/personal-state'
import { SMRY_KEY } from '@/current-affairs/reader/elsewhere'
import { highlights } from '@/current-affairs/reader/highlights/repository'
import { CA_NOTES_KEY } from '@/data/compatibility/notes'
import { db } from '@/data/db'
import { isNative } from '@/lib/platform'
import { onWake } from '@/services/lifecycle'
import { toast } from '@/ui/toast'
import { adapters } from './adapters.ts'
import { createSyncEngine, type SyncEngine, type SyncOutcome } from './engine.ts'
import { LOCAL_CHANGE_EVENT, NOTES_EVENT, PERSONAL_STATE_EVENT, PINNED_EVENT, READER_EVENT } from './signal.ts'
import { signIn, useSyncStatus, type SyncPhase } from './status.ts'
import { syncStore } from './store.ts'
import { fetchTransport } from './transport.ts'
import { createHighlightSync } from './highlights-engine'
import { highlightTransport } from './highlights-transport'
import { authored, highlightValue } from './highlights-protocol'

type Reason = 'start' | 'local' | 'wake' | 'poll' | 'manual'

/** A change is sent this soon after it is made; a burst of changes goes together. */
const LOCAL_DELAY_MS = 1500
const POLL_MS = 5 * 60 * 1000
const WAKE_GAP_MS = 30 * 1000
const LOCK = 'tars-sync'
/** While one of these holds, a local change is tracked but does not knock on the server again. */
const WAITING: SyncPhase[] = ['signin', 'unavailable', 'mismatch', 'clock']

let engine: SyncEngine | undefined
let highlightEngine: ReturnType<typeof createHighlightSync> | undefined
let generalWaiting: SyncOutcome | undefined
let highlightsWaiting: SyncOutcome | undefined
let running: Promise<void> | null = null
let queued: Reason | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let lastAttempt = 0
let warned = false

const EVENTS = { news: PERSONAL_STATE_EVENT, articles: PINNED_EVENT, notes: NOTES_EVENT, reader: READER_EVENT } as const

function build(): SyncEngine {
  return createSyncEngine({
    store: syncStore(),
    adapters: adapters({ storage: window.localStorage, archive: indexedDB, notify: (what) => window.dispatchEvent(new Event(EVENTS[what])) }),
    transport: isNative ? undefined : fetchTransport(),
  })
}

async function locked<T>(task: () => Promise<T>): Promise<T | null> {
  if (typeof navigator === 'undefined' || !navigator.locks) return task()
  // Another tab is already exchanging: it will carry this tab's changes too, since storage is shared.
  return navigator.locks.request(LOCK, { ifAvailable: true }, (lock) => (lock ? task() : null))
}

function report(outcome: SyncOutcome, linked: string | undefined) {
  const previous = useSyncStatus.getState()
  if (outcome.state === 'synced') useSyncStatus.setState({ phase: 'synced', busy: !!outcome.more, pending: outcome.pending, account: outcome.account, lastSyncedAt: outcome.at, detail: undefined })
  // A scan that needed no network leaves the last known state standing.
  else if (outcome.state === 'local') useSyncStatus.setState({ busy: false, pending: outcome.pending, ...(engineIsLocal() ? { phase: 'local' as const } : {}) })
  else useSyncStatus.setState({ phase: outcome.state, busy: false, pending: outcome.pending, detail: outcome.detail, account: outcome.state === 'mismatch' ? linked ?? previous.account : previous.account ?? linked })
  // Say so once when a device that was syncing no longer can; the Settings line carries it after that.
  if ((outcome.state === 'signin' || outcome.state === 'mismatch') && linked && !warned) {
    warned = true
    toast({ title: outcome.state === 'signin' ? 'Sign in to keep syncing' : 'Sync paused: a different account is signed in', body: 'Your changes stay on this device until then.', tone: 'warning', action: { label: 'Sign in', run: signIn } })
  }
}

const engineIsLocal = () => isNative

async function run(reason: Reason): Promise<void> {
  if (running) {
    queued = reason === 'local' && queued ? queued : reason
    return running
  }
  running = (async () => {
    engine ??= build()
    highlightEngine ??= createHighlightSync({ repository: highlights, transport: isNative ? undefined : highlightTransport(), linkedAccount: async () => (await syncStore().readMeta()).account })
    // A paused/unavailable stream must not suppress authored uploads in the other stream.
    const generalNetwork = reason !== 'local' || !generalWaiting || !WAITING.includes(generalWaiting.state as SyncPhase)
    const highlightsNetwork = reason !== 'local' || !highlightsWaiting || !WAITING.includes(highlightsWaiting.state as SyncPhase)
    const network = generalNetwork || highlightsNetwork
    if (network) { lastAttempt = Date.now(); if (reason !== 'local') useSyncStatus.setState({ busy: true }) }
    try {
      const meta = await syncStore().readMeta()
      let continueHighlights = false
      const outcome = await locked(async (): Promise<SyncOutcome> => {
        const general = generalNetwork ? await engine!.sync({ onlyIfChanged: reason === 'local' }) : { ...generalWaiting!, pending: await engine!.scan() }
        // Separate protocol/cursor/outbox; share only lifecycle and the cross-tab exchange lock.
        const excerpts = highlightsNetwork ? await highlightEngine!.sync({ onlyIfChanged: reason === 'local' }) : { ...highlightsWaiting!, pending: await highlightEngine!.scan() }
        continueHighlights = excerpts.state === 'synced' && !!excerpts.more
        if (general.state !== 'local') generalWaiting = general.state === 'synced' ? undefined : general
        if (excerpts.state !== 'local') highlightsWaiting = excerpts.state === 'synced' ? undefined : excerpts
        const failures = [general, excerpts].filter(o => o.state !== 'synced' && o.state !== 'local')
        const chosen: SyncOutcome = failures.length
          ? failures.find(o => o.state === 'mismatch') ?? failures[0]
          : general.state === 'synced' ? general : excerpts
        return { ...chosen, pending: general.pending + excerpts.pending, ...(chosen.state === 'synced' ? { more: (general.state === 'synced' && general.more) || (excerpts.state === 'synced' && excerpts.more) } : {}) }
      })
      const highlightAccount = (await highlights.syncMeta.get('meta'))?.account
      if (outcome) report(outcome, highlightAccount ?? meta.account)
      else useSyncStatus.setState({ busy: false })
      if (continueHighlights || (outcome?.state === 'synced' && (outcome.pending || outcome.more))) schedule(LOCAL_DELAY_MS)
    } catch (error) {
      // Local storage that cannot be read is never overwritten; sync simply stops until it can be.
      console.error('[sync]', error)
      useSyncStatus.setState({ phase: 'error', busy: false, detail: 'Stored data on this device could not be read' })
    }
  })().finally(() => {
    running = null
    const next = queued
    queued = null
    if (next) void run(next)
  })
  return running
}

function schedule(delay = LOCAL_DELAY_MS) {
  clearTimeout(timer)
  timer = setTimeout(() => void run('local'), delay)
}

export function syncNow(reason: Reason = 'manual'): Promise<void> {
  return run(reason)
}

let started = false
export function startSync(): void {
  if (started || typeof window === 'undefined' || typeof indexedDB === 'undefined') return
  started = true
  void syncStore().readMeta().then((meta) => useSyncStatus.setState({ account: meta.account, lastSyncedAt: meta.lastSyncedAt })).catch(() => {})
  void run('start')
  window.addEventListener(LOCAL_CHANGE_EVENT, () => schedule())
  // Another device's smry.ai count was united with this one's: if that made the set larger, send the union on.
  window.addEventListener(READER_EVENT, () => schedule())
  // Another tab changed the reading state or the notes.
  window.addEventListener('storage', (event) => { if (event.key === CA_STATE_KEY || event.key === CA_NOTES_KEY || event.key === SMRY_KEY) schedule() })
  // Atlas answers, reward claims, deletions and settings all live in the database.
  let first = true
  liveQuery(() => Promise.all([db.recalls.count(), db.claims.count(), db.tombstones.count(), db.settings.get('settings')])).subscribe({
    next: () => { if (first) first = false; else schedule() },
    error: () => {},
  })
  // Full authored fingerprint also sees cross-tab writes and backup restore. Resolution-only emissions do
  // not schedule a request; preview Ranges and availability never enter this database.
  let previousHighlights: string | undefined
  liveQuery(async () => (await highlights.records.toArray()).map(r => highlightValue(authored(r))).sort().join('\n')).subscribe({
    next: value => { if (previousHighlights !== undefined && previousHighlights !== value) schedule(); previousHighlights = value },
    error: () => {},
  })
  onWake((why) => { if (why === 'online' || Date.now() - lastAttempt > WAKE_GAP_MS) void run('wake') })
  setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine !== false) void run('poll') }, POLL_MS)
}
