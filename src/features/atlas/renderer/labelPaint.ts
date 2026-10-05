/** Shared lettering palette for HTML names and the worker curve painter. */
import { STYLE_SPEC, FONT_SANS, type PlacedLabel } from '../labels'
import { TONES } from './palette'
import type { Tone } from './types'
export function labelPaint(l: PlacedLabel, toneId: Tone) {
  const spec = STYLE_SPEC[l.style]
  const c = TONES[toneId].text
  const fill =
    l.style === 'state'
      ? c.state
      : l.style === 'country'
        ? c.country
        : l.style.startsWith('water') || l.style === 'river' || l.style === 'place-water'
          ? c.water
          : l.style.startsWith('physical') || l.style === 'place-physical'
            ? c.physical
            : c.place
  return {
    fill,
    fontFamily: FONT_SANS,
    fontStyle: spec.italic ? 'italic' : 'normal',
    fontWeight: spec.weight,
    fontSize: l.size,
    letterSpacing: `${spec.spacing}em`,
    halo: TONES[toneId].halo,
    haloWidth: l.style === 'state' || l.style === 'country' ? 3.2 : 2.8,
    // Names are never greyed for places or states not yet studied: travel is shown by what it adds, not by dimming the rest.
    opacity: 1,
    color: fill,
  }
}
