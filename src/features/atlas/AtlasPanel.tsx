/** The Atlas side panel: explorer rank, reviews, recall challenges, regions and map styles. */
import { motion } from 'motion/react'
import { Check, GraduationCap, Lock, Map as MapIcon, Trophy } from 'lucide-react'
import type { ReactNode } from 'react'
import { atlasActivity } from '@/atlas/activity'
import type { Exploration } from '@/atlas/useExploration'
import { db } from '@/data/db'
import { useClaims, useRecalls, useSettings } from '@/data/hooks'
import { dailyChallenges, weeklyChallenges, type ChallengeInstance } from '@/game/challenges'
import { MAP_STYLES, RANKS } from '@/game/progression'
import { cn } from '@/lib/cn'
import { addDaysKey, startOfWeekKey } from '@/lib/time'
import { haptics } from '@/services/haptics'
import { Button } from '@/ui/controls'
import { toast } from '@/ui/toast'
import { DEVELOPMENT_LABEL, developmentOf } from './util'

export interface PanelActions {
  startReview: () => void
  pickState: (id: string) => void
}

export function ExplorerCard({ ex, compact }: { ex: Exploration; compact?: boolean }) {
  const { level } = ex
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[15px] font-bold">
          {level.rank.title} <span className="font-semibold text-ink-3">· Level {level.level}</span>
        </p>
        <p className="text-[12px] font-semibold text-ink-2 tabular">{ex.xp.total.toLocaleString()} XP</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <motion.div className="h-full rounded-full bg-accent" initial={{ width: 0 }} animate={{ width: `${level.progress * 100}%` }} transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }} />
      </div>
      {!compact && (
        <p className="mt-1.5 text-[12px] text-ink-2">
          {level.xpToNext} XP to level {level.level + 1}
          {level.nextRank && ` · ${(level.nextRank.minXp - ex.xp.total).toLocaleString()} XP to ${level.nextRank.title}`}
        </p>
      )}
    </div>
  )
}

export function AtlasPanel({ ex, actions, hideExplorer }: { ex: Exploration; actions: PanelActions; hideExplorer?: boolean }) {
  return (
    <div className="mt-5">
      {!hideExplorer && (
        <Section>
          <ExplorerCard ex={ex} />
        </Section>
      )}

      <Section title="Field review" icon={<GraduationCap className="size-3.5" />}>
        <p className="text-[13.5px] text-ink-2">
          {ex.due.length ? `${ex.due.length} place${ex.due.length === 1 ? '' : 's'} due – spaced reviews make places Strong, then Mastered.` : ex.state.discovered.size ? 'All caught up. New reviews appear as places come due.' : 'Choose any place to test your recall.'}
        </p>
        <Button variant="primary" size="sm" className="mt-3" disabled={!ex.due.length} onClick={actions.startReview}>
          Review {Math.min(8, ex.due.length) || ''} now
        </Button>
      </Section>

      <Challenges ex={ex} />

      <Regions ex={ex} onPick={actions.pickState} />

      <MapStyles ex={ex} />
    </div>
  )
}

function Section({ title, icon, action, children }: { title?: string; icon?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="border-t border-line py-4 first:border-t-0 first:pt-0">
      {title && (
        <div className="mb-2 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 t-label text-[12px]">
            {icon}
            {title}
          </h3>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

function Challenges({ ex }: { ex: Exploration }) {
  const settings = useSettings()
  const claims = useClaims()
  const recalls = useRecalls()
  const today = ex.today
  const week = startOfWeekKey(today, settings.weekStartsOn)
  const daily = dailyChallenges(today, { atlas: atlasActivity(ex, recalls, today, today) }, claims)
  const weekly = weeklyChallenges(today, settings.weekStartsOn, { atlas: atlasActivity(ex, recalls, week, addDaysKey(week, 6)) }, claims)
  const claim = async (c: ChallengeInstance) => {
    haptics.success()
    await db.claims.put({ id: c.key, challengeId: c.id, period: c.periodKey, reward: c.reward, createdAt: Date.now(), updatedAt: Date.now() })
    toast({ title: `+${c.reward} XP`, body: c.title, tone: 'celebrate' })
  }
  return (
    <Section title="Challenges" icon={<Trophy className="size-3.5" />}>
      <ul className="space-y-3">
        {[...daily, ...weekly].map((c) => (
          <li key={c.key} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">{c.title}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-line">
                  <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.min(1, c.progress / c.target) * 100}%` }} />
                </span>
                <span className="text-[11px] font-bold text-ink-3 tabular">
                  {c.period === 'week' ? 'Week' : 'Today'} · +{c.reward}
                </span>
              </div>
            </div>
            {c.claimed ? (
              <span className="flex size-8 items-center justify-center rounded-full bg-success/15 text-success" aria-label="Claimed">
                <Check className="size-4" />
              </span>
            ) : (
              <Button size="sm" variant={c.complete ? 'accent' : 'secondary'} disabled={!c.complete} onClick={() => claim(c)}>
                Claim
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Section>
  )
}

function Regions({ ex, onPick }: { ex: Exploration; onPick: (id: string) => void }) {
  const rows = ex.atlas.states
    .filter((s) => ex.state.explored.has(s.id))
    .map((s) => ({ s, d: developmentOf(ex, s.id) }))
    .sort((a, b) => b.d.discovered - a.d.discovered || a.s.name.localeCompare(b.s.name))
  return (
    <Section title="Regions" icon={<MapIcon className="size-3.5" />}>
      <ul className="space-y-1">
        {rows.slice(0, 12).map(({ s, d }) => (
          <li key={s.id}>
            <button type="button" onClick={() => onPick(s.id)} className="flex w-full items-center gap-3 rounded-xl px-1 py-1.5 text-left hover:bg-surface-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{s.name}</span>
                <span className="block text-[12px] text-ink-3">
                  {DEVELOPMENT_LABEL[d.level]} · {d.discovered}/{d.total} Familiar
                </span>
              </span>
              <span className="h-1 w-16 overflow-hidden rounded-full bg-line">
                <span className="block h-full rounded-full bg-accent" style={{ width: `${d.total ? (d.familiar / d.total) * 100 : 0}%` }} />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[12px] text-ink-3">{rows.length} of 36 states and UTs explored</p>
    </Section>
  )
}

function MapStyles({ ex }: { ex: Exploration }) {
  return (<Section title="Map styles">
      <ul className="mt-1.5 space-y-1">
        {MAP_STYLES.map((s) => {
          const open = s.minRank <= ex.level.rankIndex
          return (
            <li key={s.id} className={cn('flex items-center gap-2 text-[13px]', !open && 'text-ink-3')}>
              {open ? <Check className="size-3.5 text-success" /> : <Lock className="size-3.5" />}
              <span className="font-semibold">{s.name}</span>
              {!open && <span>· {RANKS[s.minRank].title}</span>}
            </li>
          )
        })}
      </ul>
    </Section>
  )
}
