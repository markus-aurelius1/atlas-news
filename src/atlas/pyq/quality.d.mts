import type { CanonicalQuestion } from './types'
export const SUPPORTED_BLOCKS: string[]
export const SUPPORTED_TYPES: string[]
export function premiumRenderability(question: CanonicalQuestion): { pass: boolean; reasons: Array<{ code: string; path: string }> }
export function textLocations(question: Pick<CanonicalQuestion, 'content'> & Partial<Pick<CanonicalQuestion, 'options'>>): Array<{ text: string; location: string; path: string; optionKey?: string }>
