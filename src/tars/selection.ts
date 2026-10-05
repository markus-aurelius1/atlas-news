/** Ephemeral Atlas selection for command continuity. It never changes travel or recall history. */
import { create } from 'zustand'
export const useTarsSelection = create<{ placeId: string | null; questionId: string | null; set: (placeId:string|null,questionId:string|null)=>void }>((set)=>({placeId:null,questionId:null,set:(placeId,questionId)=>set({placeId,questionId})}))
