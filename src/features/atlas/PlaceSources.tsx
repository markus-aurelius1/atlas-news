/**
 * Where a place's data comes from, folded into one quiet line at the foot of
 * its card: the position, then (on demand) every source – reference pages,
 * official lists and geometry. PYQ provenance stays with canonical questions.
 */
import { ChevronRight } from 'lucide-react'
import { geographicSources } from '@/atlas/access'
import type { Place } from '@/atlas/types'

const deg = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(2)}° ${v >= 0 ? pos : neg}`

export function PlaceSources({ place: p }: { place: Place }) {
  const sources = geographicSources(p.sources)
  const where = `${deg(p.lat, 'N', 'S')}, ${deg(p.lon, 'E', 'W')}`
  if (!sources.length) return <p className="place-sources type-numeric">{where}</p>
  return (
    <details className="place-sources">
      <summary>
        <ChevronRight aria-hidden="true" />
        <span>Sources ({sources.length})</span>
        <span className="type-numeric">· {where}</span>
      </summary>
      <ul>
        {sources.map((s) => (
          <li key={s.url}>
            {/^https?:/.test(s.url) ? (
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
              </a>
            ) : (
              s.title
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}
