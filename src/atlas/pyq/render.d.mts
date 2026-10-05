import type { CanonicalBlock } from './types'
export interface PresentationNode { tag: string; className: string; children: Array<PresentationNode | string> }
export function blockNodes(blocks: CanonicalBlock[]): PresentationNode[]
export function nodesHtml(nodes: Array<PresentationNode | string>): string
export function escapeHtml(text: string): string
