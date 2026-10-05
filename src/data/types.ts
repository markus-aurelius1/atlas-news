/** Current Atlas and shared preferences. Historical records remain opaque in compatibility/schema.ts. */
import type { DayKey, WeekStart } from '@/lib/time'
export interface Entity {
  id: string
  createdAt: number
  updatedAt: number
}


export interface ChallengeClaim extends Entity {
  challengeId: string
  /** Day key (daily) or week-start key (weekly). */
  period: string
  /** Awarded recall challenge XP. */
  reward: number
}

export type QuestionType = 'locate' | 'identify' | 'state' | 'river' | 'relation' | 'border' | 'order' | 'fact'
export type RecallSource = 'review' | 'card' | 'break' | 'checkpoint'

/** One answered recall question. Mastery is always derived from these. */
export interface RecallAttempt extends Entity {
  placeId: string
  type: QuestionType | 'pyq'
  correct: 0 | 1
  at: number
  date: DayKey
  source: RecallSource
  /** Canonical attempts are history, not bodies or mutable progression counters. Optional, non-indexed v2 extension. */
  pyq?: { canonicalQuestionId: string; baseQuestionHash: string; suppliedAnswerHash: string; selectedAnswer: 'A' | 'B' | 'C' | 'D'; acceptedAnswers: Array<'A' | 'B' | 'C' | 'D'>; eligiblePlaceIds: string[] }
}


export interface Tombstone {
  /** `${table}:${entityId}` */
  id: string
  table: string
  entityId: string
  deletedAt: number
}


export type ThemePreference = 'system' | 'light' | 'dark'
export type AtlasStyle = 'physical' | 'political' | 'night' | 'antique'

export interface AtlasLayers {
  /** Draw places not yet discovered (muted) as well as discovered ones. */
  undiscovered: boolean
  /** Protected-area outlines and disputed regions. */
  areas: boolean
  /** Place categories to show (ids from features/atlas/groups.ts); empty = all. */
  groups: string[]
}


export interface Settings {
  id: 'settings'
  updatedAt: number
  theme: ThemePreference
  weekStartsOn: WeekStart
  haptics: boolean
  atlasStyle: AtlasStyle
  atlasLayers?: AtlasLayers
  /** Unknown preferences from earlier releases round-trip through backup without active consumers. */
  [key: string]: unknown
}
export interface TableMap { claims: ChallengeClaim; recalls: RecallAttempt }
export type SyncTable = keyof TableMap
