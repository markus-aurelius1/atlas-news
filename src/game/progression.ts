/** Atlas recall XP, ranks and map styles. */
import type { ChallengeClaim, RecallAttempt } from '@/data/types'

export const RECALL_XP_DAILY_CAP = 30

/** Recall XP per day, capped. */
export function recallXp(recalls: Pick<RecallAttempt, 'correct' | 'date'>[]): number {
  const perDay = new Map<string, number>()
  for (const r of recalls) if (r.correct) perDay.set(r.date, (perDay.get(r.date) ?? 0) + 1)
  let xp = 0
  for (const n of perDay.values()) xp += Math.min(RECALL_XP_DAILY_CAP, n)
  return xp
}

export interface XpBreakdown {
  challenges: number
  recall: number
  total: number
}

export function xpBreakdown(claims: ChallengeClaim[], recalls: RecallAttempt[]): XpBreakdown {
  let challenges = 0
  for (const c of claims) if (['d-review', 'w-recall', 'w-pass'].includes(c.challengeId)) challenges += c.reward
  const recall = recallXp(recalls)
  return { challenges, recall, total: challenges + recall }
}

// ───────────────────────── levels & ranks ─────────────────────────

export interface Rank {
  title: string
  minXp: number
}

/** Explorer ranks. Thresholds match the old hour-based ranks at 60 XP an hour. */
export const RANKS: Rank[] = [
  { title: 'Wayfarer', minXp: 0 },
  { title: 'Trailblazer', minXp: 300 },
  { title: 'Surveyor', minXp: 900 },
  { title: 'Cartographer', minXp: 2400 },
  { title: 'Navigator', minXp: 6000 },
  { title: 'Explorer', minXp: 15000 },
  { title: 'Geographer', minXp: 30000 },
  { title: 'Keeper of the Atlas', minXp: 60000 },
]

/** Level curve: level L starts at 30·(L−1)² XP – quick early levels, slower later (same as before, in XP). */
export const xpForLevel = (level: number) => 30 * (level - 1) ** 2

export function levelInfo(xp: number) {
  const level = Math.floor(Math.sqrt(Math.max(0, xp) / 30)) + 1
  const from = xpForLevel(level)
  const to = xpForLevel(level + 1)
  let rankIndex = 0
  for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].minXp) rankIndex = i
  const nextRank = RANKS[rankIndex + 1] ?? null
  return {
    xp,
    level,
    progress: Math.min(1, (xp - from) / (to - from)),
    xpToNext: Math.max(0, to - xp),
    rank: RANKS[rankIndex],
    rankIndex,
    nextRank,
  }
}

// ───────────────────────── map styles ─────────────────────────

export interface MapStyle {
  id: 'physical' | 'political' | 'night' | 'antique'
  name: string
  description: string
  /** Index into RANKS needed to use it. */
  minRank: number
}

/** Map styles are earned with rank – never bought. */
export const MAP_STYLES: MapStyle[] = [
  { id: 'physical', name: 'Physical', description: 'Relief, rivers and landforms', minRank: 0 },
  { id: 'political', name: 'Political', description: 'States and countries in colour', minRank: 0 },
  { id: 'night', name: 'Night chart', description: 'Navy chart with gold ink', minRank: 2 },
  { id: 'antique', name: 'Antique', description: 'An engraved, sepia atlas plate', minRank: 3 },
]

export const styleUnlocked = (id: MapStyle['id'], rankIndex: number) => (MAP_STYLES.find((s) => s.id === id)?.minRank ?? 0) <= rankIndex
