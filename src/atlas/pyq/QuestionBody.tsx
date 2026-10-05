/** The future quiz and developer audit use the same dedicated block components and responsive CSS. No raw HTML/source reconstruction. */
import { createElement } from 'react'
import type { ReactNode } from 'react'
import type { CanonicalBlock } from './types'
import { blockNodes } from './render.mjs'
import type { PresentationNode } from './render.mjs'
import './blocks.css'

const renderNode = (node: PresentationNode | string, key: number): ReactNode => typeof node === 'string' ? node : createElement(node.tag, { key, className: node.className || undefined }, node.children.map(renderNode))
export function AtlasPyqBody({ blocks }: { blocks: CanonicalBlock[] }) {
  return <div className="pyq-body">{blockNodes(blocks).map(renderNode)}</div>
}
