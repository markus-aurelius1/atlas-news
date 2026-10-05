/** Legacy study-priority chip styles. Canonical packs are the runtime question authority. */
import type { PriorityBand } from '@/atlas/types'

export const BAND_LABEL: Record<PriorityBand, string> = { core: 'Top priority', high: 'High priority', medium: 'Medium priority', low: 'Low priority' }

export const BAND_CLASS: Record<PriorityBand, string> = {
  core: 'bg-accent text-accent-ink',
  high: 'bg-accent-soft text-accent',
  medium: 'bg-surface-3 text-ink-2',
  low: 'bg-surface-2 text-ink-3',
}
