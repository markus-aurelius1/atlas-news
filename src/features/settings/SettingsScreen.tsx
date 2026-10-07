import { Download, FileJson, HardDrive, Info, Smartphone, Trash2, Upload } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { backupCounts, BackupError, createBackup, eraseEverything, parseBackup, restoreBackup, type BackupFile } from '@/data/backup'
import { updateSettings, useSettings } from '@/data/hooks'
import { useXp } from '@/atlas/useExploration'
import { MAP_STYLES, RANKS } from '@/game/progression'
import { ensureSeed } from '@/data/seed'
import type { AtlasStyle, ThemePreference } from '@/data/types'
import { isNative, isStandalonePwa, platform } from '@/lib/platform'
import { pickTextFile, saveTextFile, stamp } from '@/services/files'
import { promptInstall, useInstall } from '@/services/install'
import { Button, ListRow, SegmentedControl, Select, SwitchRow } from '@/ui/controls'
import { confirmDialog } from '@/ui/feedback'
import { LogoMark } from '@/ui/Logo'
import { Sheet, SheetActions } from '@/ui/Sheet'
import { toast } from '@/ui/toast'
import { motionChoice, setMotionChoice, type MotionChoice } from '@/lib/motion'
import { OfflineAtlas } from '@/features/atlas/OfflineAtlas'
import { describeSync, requestSync, signIn, useSyncStatus } from '@/sync/status'
import './settings.css'


function AtlasSettings() {
  const settings = useSettings()
  const { level } = useXp()
  return (
    <Group title="Atlas">
      <Line label="Map style" hint="More styles unlock as your rank rises.">
        <Select compact value={settings.atlasStyle} onChange={(e) => void updateSettings({ atlasStyle: e.target.value as AtlasStyle })} aria-label="Map style">
          {MAP_STYLES.map((s) => (
            <option key={s.id} value={s.id} disabled={s.minRank > level.rankIndex}>
              {s.name}
              {s.minRank > level.rankIndex ? ` – ${RANKS[s.minRank].title}` : ''}
            </option>
          ))}
        </Select>
      </Line>
    </Group>
  )
}

export default function SettingsScreen() {
  const settings = useSettings()
  const [motion, setMotion] = useState<MotionChoice>(motionChoice)

  return (
    <div className="settings">
      <header className="settings-head">
        <h1>Settings</h1>
      </header>
      <Group title="Appearance">
        <Line label="Theme">
          <SegmentedControl<ThemePreference>
            label="Theme"
            size="sm"
            value={settings.theme}
            onChange={(v) => void updateSettings({ theme: v })}
            options={[
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'system', label: 'System' },
            ]}
          />
        </Line>
        <Line label="Motion" hint="Reduced swaps movement for quick fades and stops looping animation. Auto follows your device.">
          <SegmentedControl<MotionChoice>
            label="Motion"
            size="sm"
            value={motion}
            onChange={(v) => {
              setMotionChoice(v)
              setMotion(v)
            }}
            options={[
              { value: 'system', label: 'Auto' },
              { value: 'reduced', label: 'Reduced' },
              { value: 'full', label: 'Full' },
            ]}
          />
        </Line>
      </Group>

      <AtlasSettings />

      <Group title="General">
        <SwitchRow className="settings-line" title="Haptics" description="Gentle vibrations on supported devices." checked={settings.haptics} onChange={(v) => void updateSettings({ haptics: v })} />
      </Group>

      <SyncGroup />

      <DataGroup />

      <InstallGroup />

      <Group title="Offline">
        <OfflineAtlas />
      </Group>

      <footer className="settings-foot">
        <LogoMark className="size-5" />
        <p>
          Tars {__APP_VERSION__} · Local-first: your data lives on this device and everything works offline. When you are signed in, reading state, notes, Atlas progress and settings also sync to your own account; the news feed itself is never uploaded. News opens on the publisher’s site.
        </p>
      </footer>
    </div>
  )
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="settings-group">
      <h2 className="eyebrow">
        {title}
        {hint && <span>{hint}</span>}
      </h2>
      <div className="settings-rows">{children}</div>
    </section>
  )
}

function Line({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="settings-line">
      <span className="settings-label">
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </span>
      <span className="shrink-0">{children}</span>
    </div>
  )
}

function ActionRow({ icon, title, body, onClick, danger }: { icon: ReactNode; title: string; body: string; onClick: () => void; danger?: boolean }) {
  return (
    <ListRow
      className="settings-action"
      leading={<span className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${danger ? 'bg-danger/10 text-danger' : 'bg-surface-2 text-ink-2'}`}>{icon}</span>}
      title={<span className={danger ? 'text-danger' : undefined}>{title}</span>}
      meta={body}
      onClick={onClick}
    />
  )
}

/** One line: who is syncing and whether it is up to date, with the single action that state calls for. */
function SyncGroup() {
  const status = useSyncStatus()
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(tick)
  }, [])
  const view = describeSync(status, now)
  return (
    <Group title="Sync">
      <div className="settings-line" data-sync={status.phase} role={view.tone === 'warning' ? 'alert' : 'status'}>
        <span className="settings-label">
          <b>{view.title}</b>
          <small>{view.body}</small>
        </span>
        {view.action && (
          <span className="shrink-0">
            <Button size="sm" variant={view.action === 'signin' ? 'primary' : 'secondary'} loading={status.busy} onClick={view.action === 'signin' ? signIn : requestSync}>
              {view.action === 'signin' ? 'Sign in' : 'Sync now'}
            </Button>
          </span>
        )}
      </div>
    </Group>
  )
}

function DataGroup() {
  const [pending, setPending] = useState<BackupFile | null>(null)
  const [storage, setStorage] = useState<string>('')

  const refresh = async () => {
    try {
      const est = await navigator.storage?.estimate?.()
      const persisted = await navigator.storage?.persisted?.()
      if (est?.usage !== undefined) setStorage(`${(est.usage / 1024 / 1024).toFixed(1)} MB used${persisted ? ' · protected from eviction' : ''}`)
    } catch {
      /* unsupported */
    }
  }
  useEffect(() => {
    void refresh()
  }, [])

  const exportJson = async () => {
    const backup = await createBackup()
    await saveTextFile(`tars-backup-${stamp()}.json`, JSON.stringify(backup, null, 2), 'application/json')
    toast({ title: 'Backup saved', body: 'Keep it somewhere safe – you can restore it on any device.', tone: 'success' })
  }

  const importJson = async () => {
    const file = await pickTextFile('application/json,.json')
    if (!file) return
    try {
      setPending(parseBackup(file.text))
    } catch (err) {
      toast({ title: 'Couldn’t read that backup', body: err instanceof BackupError ? err.message : 'The file may be damaged.', tone: 'warning' })
    }
  }

  const restore = async (mode: 'merge' | 'replace') => {
    if (!pending) return
    if (mode === 'replace' && !(await confirmDialog({ title: 'Replace everything?', body: 'All data on this device is replaced by the backup. This can’t be undone – export a backup first if unsure.', confirmLabel: 'Replace', danger: true }))) return
    const report = await restoreBackup(pending, mode)
    setPending(null)
    await ensureSeed()
    await refresh()
    // Notes and reading state live outside the database: tell their open views, and say what came with the backup.
    window.dispatchEvent(new Event('tars:notes-changed'))
    const extra = [report.extras.highlights ? `${report.extras.highlights} highlights` : '', report.extras.notes ? `${report.extras.notes} ${report.extras.notes === 1 ? 'note' : 'notes'}` : '', report.extras.articles ? `reading state for ${report.extras.articles} ${report.extras.articles === 1 ? 'article' : 'articles'}` : ''].filter(Boolean).join(' · ')
    const records = mode === 'merge' ? `${report.inserted} added · ${report.updated} updated · ${report.skipped} already up to date` : `${report.inserted} records loaded`
    toast({ title: 'Backup restored', body: extra ? `${records} · ${extra}` : records, tone: 'success' })
    if (report.extras.preserved.length) toast({ title: 'Some of the backup was not merged', body: `${report.extras.preserved.map(part => part === 'notes' ? 'Notes' : part === 'readerHighlights' ? 'Reader highlights' : 'Current Affairs reading state').join(' and ')} on this device couldn’t be read, so nothing there was changed.`, tone: 'warning' })
  }

  const erase = async () => {
    if (!(await confirmDialog({ title: 'Erase all data?', body: useSyncStatus.getState().account ? 'All Atlas progress, News reading state, Reader highlights, notes, settings and historical data on this device will be deleted. What has synced to your account stays there and returns when this device next syncs.' : 'All Atlas progress, News reading state, Reader highlights, notes, settings and historical data on this device will be deleted. This can’t be undone.', confirmLabel: 'Erase everything', danger: true }))) return
    await eraseEverything()
    location.reload()
  }

  return (
    <>
      <Group title="Your data" hint={storage}>
        <ActionRow icon={<FileJson className="size-4.5" />} title="Back up everything" body="One JSON file: Atlas progress, News reading state, notes and settings. Existing historical data is included." onClick={() => void exportJson()} />
        <ActionRow icon={<Upload className="size-4.5" />} title="Restore from backup" body="Merge a backup into this device, or replace it." onClick={() => void importJson()} />
        <ActionRow icon={<Trash2 className="size-4.5" />} title="Erase all data" body="Start completely fresh on this device." onClick={() => void erase()} danger />
      </Group>

      <Sheet
        open={!!pending}
        onClose={() => setPending(null)}
        title="Restore backup"
        size="sm"
        footer={
          <SheetActions stack>
            <Button variant="primary" block onClick={() => void restore('merge')}>
              Merge – keep the newest of each item
            </Button>
            <Button variant="danger" block onClick={() => void restore('replace')}>
              Replace everything on this device
            </Button>
          </SheetActions>
        }
      >
        {pending && (
          <div className="space-y-4">
            <p className="text-[15px] text-ink-2">Backup from {new Date(pending.exportedAt).toLocaleString()}.</p>
            <ul className="grid grid-cols-2 gap-1 text-[13px] text-ink-2">
              {Object.entries(backupCounts(pending))
                .filter(([, n]) => n > 0)
                .map(([k, n]) => (
                  <li key={k}>
                    <b className="text-ink">{n}</b> {k}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </Sheet>
    </>
  )
}

function InstallGroup() {
  const canPrompt = useInstall((s) => !!s.event)
  const installed = useInstall((s) => s.installed) || isStandalonePwa()
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
  return (
    <Group title="App">
      {isNative ? (
        <Line label={`Tars for ${platform === 'ios' ? 'iOS' : 'Android'}`} hint="Atlas and saved reading state stay on this device.">
          <Smartphone className="size-5 text-ink-3" />
        </Line>
      ) : installed ? (
        <Line label="Installed" hint="Running as an app. Long-press the icon for quick actions.">
          <HardDrive className="size-5 text-success" />
        </Line>
      ) : canPrompt ? (
        <ActionRow icon={<Download className="size-4.5" />} title="Install Tars" body="Add it to your home screen or dock. Works fully offline." onClick={() => void promptInstall()} />
      ) : (
        <Line label="Install as an app" hint={ios ? 'In Safari, tap Share → Add to Home Screen.' : 'Use your browser’s “Install app” or “Add to Home screen” option.'}>
          <Info className="size-5 text-ink-3" />
        </Line>
      )}
    </Group>
  )
}
