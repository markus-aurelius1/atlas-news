/** Shared read-only context bridge. Map geometry is never needed to understand study state. */
import { useEffect, useMemo } from 'react'
import { currentRoute, useRoute } from '@/app/router'
import { useExploration } from '@/atlas/useExploration'
import { todayKey } from '@/lib/time'
import { deriveContext, type ContextInput } from './context'
import { dueForReview } from '@/atlas/mastery'
import { useDay } from '@/lib/useDay'
import { useTarsSelection } from './selection'
let projection:ContextInput|null=null
export function currentContext() {
  const today=todayKey(), selection=useTarsSelection.getState()
  let exploration=projection?.exploration ?? null
  if(exploration && exploration.today!==today) exploration={...exploration,today,due:dueForReview(exploration.state.discovered,exploration.mastery,today,id=>exploration!.atlas.byId.get(id)?.yield?.score ?? 0)}
  return deriveContext({...projection,route:currentRoute().name,today,exploration,selectedPlace:selection.placeId,selectedPyq:selection.questionId})
}
/**
 * Keeps the projection that imperative actions read (currentContext) up to date
 * on every screen. Mounted once by the app shell; renders nothing.
 */
export function TarsContextBridge() {
  useTarsContext()
  return null
}
export function useTarsContext() {
  const route=useRoute(), ex=useExploration(false), selection=useTarsSelection(), today=useDay()
  const context=useMemo(()=>deriveContext({route:route.name,today,exploration:ex,selectedPlace:selection.placeId,selectedPyq:selection.questionId}),[route.name,today,ex,selection.placeId,selection.questionId])
  useEffect(()=>{projection={route:route.name,today,exploration:ex,selectedPlace:selection.placeId,selectedPyq:selection.questionId}},[context,route.name,today,ex,selection.placeId,selection.questionId])
  return context
}
