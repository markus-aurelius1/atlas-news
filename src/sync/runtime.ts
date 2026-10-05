/**
 * Runs the sync engine in the browser: once at start, shortly after anything changes here, when the app wakes
 * or the network returns, and every few minutes while it is open. One exchange at a time, in one tab.
 */
import { liveQuery } from 'dexie'
import { CA_STATE_KEY } from '@/current-affairs/personal-state'
import { CA_NOTES_KEY } from '@/data/compatibility/notes'
import { db } from '@/data/db'
import { isNative } from '@/lib/platform'
import { onWake } from '@/services/lifecycle'
import { toast } from '@/ui/toast'
import { adapters } from './adapters.ts'
import { createSyncEngine, type SyncEngine, type SyncOutcome } from './engine.ts'
import { LOCAL_CHANGE_EVENT, NOTES_EVENT, PERSONAL_STATE_EVENT, PINNED_EVENT } from './signal.ts'
import { signIn, useSyncStatus, type SyncPhase } from './status.ts'
import { syncStore } from './store.ts'
import { fetchTransport } from './transport.ts'

type Reason = 'start' | 'local' | 'wake' | 'poll' | 'manual'

/** A change is sent this soon after it is made; a burst of changes goes together. */
const LOCAL_DELAY_MS = 1500
const POLL_MS = 5 * 60 * 1000
const WAKE_GAP_MS = 30 * 1000
const LOCK = 'tars-sync'
/** While one of these holds, a local change is tracked but does not knock on the server again. */
const WAITING: SyncPhase[] = ['signin', 'unavailable', 'mismatch', 'clock']

let engine: SyncEngine | undefined
let running: Promise<void> | null = null
let queued: Reason | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let lastAttempt = 0
let warned = false

const EVENTS = { news: PERSONAL_STATE_EVENT, articles: PINNED_EVENT, notes: NOTES_EVENT } as const

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
  if (outcome.state === 'synced') useSyncStatus.setState({ phase: 'synced', busy: false, pending: outcome.pending, account: outcome.account, lastSyncedAt: outcome.at, detail: undefined })
  // A scan that needed no network leaves the last known state standing.
  else if (outcome.state === 'local') useSyncStatus.setState({ busy: false, pending: outcome.pending, ...(engineIsLocal() ? { phase: 'local' as const } : {}) })
  else useSyncStatus.setState({ phase: outcome.state, busy: false, pending: outcome.pending, detail: outcome.detail, account: previous.account ?? linked })
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
    const phase = useSyncStatus.getState().phase
    const network = reason !== 'local' || !WAITING.includes(phase)
    if (network) { lastAttempt = Date.now(); if (reason !== 'local') useSyncStatus.setState({ busy: true }) }
    try {
      const meta = await syncStore().readMeta()
      const outcome = await locked(async (): Promise<SyncOutcome> => (network ? engine!.sync({ onlyIfChanged: reason === 'local' }) : { state: 'local', pending: await engine!.scan() }))
      if (outcome) report(outcome, meta.account)
      else useSyncStatus.setState({ busy: false })
      if (outcome?.state === 'synced' && outcome.pending) schedule(LOCAL_DELAY_MS)
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
  // Another tab changed the reading state or the notes.
  window.addEventListener('storage', (event) => { if (event.key === CA_STATE_KEY || event.key === CA_NOTES_KEY) schedule() })
  // Atlas answers, reward claims, deletions and settings all live in the database.
  let first = true
  liveQuery(() => Promise.all([db.recalls.count(), db.claims.count(), db.tombstones.count(), db.settings.get('settings')])).subscribe({
    next: () => { if (first) first = false; else schedule() },
    error: () => {},
  })
  onWake((why) => { if (why === 'online' || Date.now() - lastAttempt > WAKE_GAP_MS) void run('wake') })
  setInterval(() => { if (document.visibilityState === 'visible' && navigator.onLine !== false) void run('poll') }, POLL_MS)
}
