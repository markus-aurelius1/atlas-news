/** Read-only Atlas selection and due reviews. */
import type { Exploration } from '@/atlas/useExploration'
import type { RouteName } from '@/app/router'
export interface TarsContext {
  route: RouteName
  today: string
  selectedPlace: string | null
  selectedPyq: string | null
  dueReviews: string[]
  availableActions: string[]
}
export interface ContextInput { route: RouteName; today: string; exploration: Exploration | null; selectedPlace?: string | null; selectedPyq?: string | null }
export function deriveContext(input: ContextInput): TarsContext {
  const dueReviews = input.exploration?.due.map(d => d.id) ?? []
  const selectedPlace = input.route === 'atlas' ? input.selectedPlace ?? null : null
  return { route: input.route, today: input.today, selectedPlace, selectedPyq: input.route === 'atlas' ? input.selectedPyq ?? null : null, dueReviews,
    availableActions: ['atlas.open', 'atlas.search', 'settings.open', ...(dueReviews.length ? ['review.startDue'] : []), ...(selectedPlace ? ['atlas.reviewPlace', 'pyq.reviewForPlace'] : [])] }
}
export interface ContextSuggestion { title: string; action: string; input: Record<string, unknown> }
export function suggestActions(c: TarsContext): ContextSuggestion[] {
  return [...(c.selectedPlace ? [{ title: 'Questions for this place', action: 'pyq.reviewForPlace', input: { placeId: c.selectedPlace } }] : []),
    ...(c.dueReviews.length ? [{ title: c.dueReviews.length + ' Atlas reviews due', action: 'review.startDue', input: {} }] : [])]
}
