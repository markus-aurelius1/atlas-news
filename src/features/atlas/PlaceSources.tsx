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
  if (!sources.length) return <p className="tabular mt-5 border-t border-line pt-3 text-[12px] text-ink-3">{where}</p>
  return (
    <details className="group mt-5 border-t border-line pt-3 text-[12.5px] text-ink-3">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-semibold select-none hover:text-ink-2 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
        <span>Sources ({sources.length})</span>
        <span className="tabular font-medium">· {where}</span>
      </summary>
      <ul className="mt-2 space-y-1 pl-5 leading-snug">
        {sources.map((s) => (
          <li key={s.url}>
            {/^https?:/.test(s.url) ? (
              <a href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink-2">
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
