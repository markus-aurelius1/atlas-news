/** Memoised place symbols and names; the settled layout owns their coordinates. */
import { memo } from 'react'
import type { Place } from '@/atlas/types'
import { baselineFromTop, type PlacedLabel } from '../labels'
import { HIGHLIGHT, STUDIED, type MasteryLevel } from '../style'
import { MasteryBadge, Symbol } from '../symbols'
import type { Tone } from './types'
import { labelPaint } from './labelPaint'
export { labelPaint } from './labelPaint'

/**
 * A place's symbol. Memoised: when the view settles only its outer translate
 * changes, so React leaves the symbol itself alone.
 */
export const PlaceSymbol = memo(function PlaceSymbol({
  place: p,
  studied,
  selected,
  mastery,
  glowId,
  pyq,
}: {
  place: Place
  studied: boolean
  selected: boolean
  mastery: MasteryLevel
  glowId?: string
  pyq?: boolean
}) {
  // Inner group: hover lift and fade-in, in CSS. Every place is drawn at full strength; a studied one gains a warm ring.
  return (
    <g data-place={p.id} className="atlas-sym" data-studied={studied || undefined}>
      {glowId && <circle r={12} fill={`url(#${glowId})`} />}
      {studied && <circle r={10.5} fill={STUDIED} fillOpacity={0.14} stroke={STUDIED} strokeWidth={1.3} strokeOpacity={0.85} />}
      {pyq && <circle r={15} fill="none" stroke="#b8781b" strokeWidth={1.6} strokeDasharray="2 3" />}
      {selected && <circle r={12} fill="none" stroke={HIGHLIGHT} strokeWidth={2.5} className="atlas-selected" />}
      <Symbol kind={p.kind} tags={p.tags} national={p.tags?.includes('national')} />
      <MasteryBadge level={mastery} />
    </g>
  )
})

/** A name that follows a river's course (SVG textPath). */
export const RiverName = memo(function RiverName({ label: l, tone: toneId, idPrefix }: { label: PlacedLabel; tone: Tone; idPrefix: string }) {
  const { fill, fontFamily, fontStyle, fontWeight, fontSize, letterSpacing, halo, haloWidth, opacity } = labelPaint(l, toneId)
  // Ids are per map instance: the review map can be open over the Atlas.
  const id = `lp-${idPrefix}-${l.key.replace(/[^a-z0-9]/gi, '')}`
  return (
    <g>
      <path id={id} d={l.path} fill="none" stroke="none" />
      <text
        fill={fill}
        fontFamily={fontFamily}
        fontStyle={fontStyle}
        fontWeight={fontWeight}
        fontSize={fontSize}
        letterSpacing={letterSpacing}
        stroke={halo}
        strokeWidth={haloWidth}
        strokeLinejoin="round"
        paintOrder="stroke"
        opacity={opacity}
      >
        <textPath href={`#${id}`} startOffset="50%" textAnchor="middle">
          {l.text}
        </textPath>
      </text>
    </g>
  )
})

/** A point name, positioned so its baseline sits where an SVG `<text y>` would put it. */
export const PlaceName = memo(function PlaceName({ label: l, tone: toneId }: { label: PlacedLabel; tone: Tone }) {
  const { color, fontFamily, fontStyle, fontWeight, fontSize, letterSpacing, halo, haloWidth } = labelPaint(l, toneId)
  const x = l.anchor === 'middle' ? '-50%' : l.anchor === 'end' ? '-100%' : '0'
  const y = -(l.baseline ?? baselineFromTop(l.style, l.size))
  const textStyle = { color, fontFamily, fontStyle, fontWeight, fontSize, letterSpacing, WebkitTextStroke: `${haloWidth}px ${halo}` }
  const delay = String([...l.key].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0) >>> 0).slice(-2) + 'ms'
  // A fixed alignment translate and the camera's animation compose on one HTML word.
  // Older engines retain the two-span path; both use the same font, baseline and world anchor.
  if (typeof CSS !== 'undefined' && CSS.supports('translate', '0px')) return (
    <span className="atlas-name atlas-name-text atlas-point-name" data-beyond={l.beyond || undefined} data-label-key={l.key}
      style={{ ...textStyle, translate: `${x} ${y}px`, animationDelay: delay }}>{l.text}</span>
  )
  return (
    // LabelLayer owns the unscaled world anchor; this span only holds the screen-size text and halo.
    <span
      className="atlas-name"
      data-beyond={l.beyond || undefined}
      data-label-key={l.key}
      style={{ animationDelay: delay }}
    >
      <span
        className="atlas-name-text"
        style={{
          ...textStyle,
          transform: `translate(${x},${y}px)`,
        }}
      >
        {l.text}
      </span>
    </span>
  )
}, sameName)

/** A layout makes new label objects every time; a name only needs rendering again if what it shows has changed. */
function sameName(a: { label: PlacedLabel; tone: Tone }, b: { label: PlacedLabel; tone: Tone }) {
  const p = a.label
  const n = b.label
  return a.tone === b.tone && p.text === n.text && p.size === n.size && p.anchor === n.anchor && p.style === n.style && p.baseline === n.baseline && !p.beyond === !n.beyond
}
