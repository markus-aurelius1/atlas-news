/** What the app shows about sync. Kept apart from the engine so a screen can read it without loading the engine. */
import { create } from 'zustand'
import { SESSION_ENDPOINT } from './protocol.ts'

/**
 * starting     nothing attempted yet                 synced       the last exchange succeeded
 * offline      no network; changes are kept          signin       the Access session has lapsed
 * unavailable  this site has no sync endpoint        local        no server to talk to (native app)
 * mismatch     a different account is signed in      clock        this device's clock is too far ahead
 * error        anything else
 */
export type SyncPhase = 'starting' | 'synced' | 'offline' | 'signin' | 'unavailable' | 'local' | 'mismatch' | 'clock' | 'error'

export interface SyncStatus {
  phase: SyncPhase
  busy: boolean
  /** Rows changed here that the server has not accepted yet. */
  pending: number
  account?: string
  lastSyncedAt?: number
  detail?: string
}

export const useSyncStatus = create<SyncStatus>(() => ({ phase: 'starting', busy: false, pending: 0 }))

export function requestSync(): void {
  void import('./runtime.ts').then((runtime) => runtime.syncNow('manual'))
}

/** A network navigation the offline cache does not answer, so Access can ask for the login. */
export function signIn(): void {
  location.assign(SESSION_ENDPOINT)
}

const ago = (at: number, now: number) => {
  const minutes = Math.max(0, Math.floor((now - at) / 60000))
  return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} min ago` : minutes < 1440 ? `${Math.floor(minutes / 60)} h ago` : `${Math.floor(minutes / 1440)} d ago`
}
const waiting = (n: number) => (n ? ` ${n} ${n === 1 ? 'change is' : 'changes are'} waiting on this device.` : '')

export function describeSync(s: SyncStatus, now = Date.now()): { title: string; body: string; tone: 'ok' | 'idle' | 'warning'; action?: 'signin' | 'sync' } {
  switch (s.phase) {
    case 'synced':
      return { title: s.account ? `Syncing as ${s.account}` : 'Syncing', body: s.busy ? 'Syncing…' : `Up to date · ${ago(s.lastSyncedAt ?? now, now)}.${waiting(s.pending)}`, tone: 'ok', action: 'sync' }
    case 'offline':
      return { title: 'Offline', body: `Everything works on this device.${waiting(s.pending) || ' Sync resumes when the connection returns.'}`, tone: 'idle', action: 'sync' }
    case 'signin':
      return { title: 'Sign in to sync', body: `This device is not signed in.${waiting(s.pending)} Nothing is lost; sync resumes after you sign in.`, tone: 'warning', action: 'signin' }
    case 'mismatch':
      return { title: 'Sync paused', body: `This device is linked to ${s.account ?? 'another account'}, but a different account is signed in. Sign in with the linked account to continue.`, tone: 'warning', action: 'signin' }
    case 'clock':
      return { title: 'Sync paused', body: 'This device’s clock is ahead of the real time. Correct the date and time, then sync again.', tone: 'warning', action: 'sync' }
    case 'error':
      return { title: 'Sync couldn’t finish', body: `It will try again on its own.${waiting(s.pending)}${s.detail ? ` (${s.detail})` : ''}`, tone: 'warning', action: 'sync' }
    case 'unavailable':
      return { title: 'Sync is not set up here', body: 'This copy of Tars has no sync service. Everything stays on this device; use a backup to move it.', tone: 'idle' }
    case 'local':
      return { title: 'On this device only', body: 'The installed app keeps everything on this device; use a backup to move it.', tone: 'idle' }
    default:
      return { title: 'Sync', body: s.busy ? 'Checking…' : 'Not checked yet.', tone: 'idle' }
  }
}
