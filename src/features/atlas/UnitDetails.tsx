/** State and country cards. */
import type { Exploration } from '@/atlas/useExploration'
import type { MapTarget } from './AtlasMap'
import { MASTERY_COLOUR } from './style'
import { DEVELOPMENT_HINT, DEVELOPMENT_LABEL, developmentOf, masteryFn, PlaceIcon } from './util'

export function UnitDetails({ ex, unit, onSelect }: { ex: Exploration; unit: { type: 'state' | 'country'; id: string }; onSelect: (t: MapTarget) => void }) {
  const { atlas } = ex
  const state = unit.type === 'state' ? atlas.state(unit.id) : undefined
  const country = unit.type === 'country' ? (atlas.countries.find((c) => c.id === unit.id) ?? atlas.country(unit.id)) : undefined
  const key = state ? state.id : (country?.iso ?? unit.id)
  const dev = developmentOf(ex, key)
  const level = masteryFn(ex)
  const places = [...(atlas.inUnit.get(key) ?? [])].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  const name = state?.name ?? country?.name ?? unit.id
  const share = (n: number) => `${dev.total ? (n / dev.total) * 100 : 0}%`
  const foreign = state?.borderCountries ?? country?.neighbours ?? []
  return (
    <article className="place" key={`${unit.type}:${unit.id}`}>
      <header className="place-head">
        <p className="eyebrow place-kind">{state ? (state.type === 'ut' ? 'Union Territory' : 'State') : (country?.continent ?? 'Country')}</p>
        <h2 className="place-name">{name}</h2>
        {state && (
          <p className="place-sub">
            Capital {state.capital}
            {state.coastal && ' · Coastal'}
          </p>
        )}
      </header>
      {state?.fact && (
        <ul className="place-facts">
          <li>{state.fact}</li>
        </ul>
      )}

      <section className="place-section" aria-label="Recall progress">
        <h3 className="eyebrow">Recall · {DEVELOPMENT_LABEL[dev.level]}</h3>
        <div className="unit-bar" role="img" aria-label={`${dev.familiar} familiar, ${dev.strong} strong, ${dev.mastered} mastered of ${dev.total} places`}>
          <span style={{ width: share(dev.familiar), background: MASTERY_COLOUR.familiar }} />
          <span style={{ width: share(dev.strong), background: MASTERY_COLOUR.strong }} />
          <span style={{ width: share(dev.mastered), background: MASTERY_COLOUR.mastered }} />
        </div>
        <p className="place-hint">
          <span className="type-numeric">
            {dev.familiar}/{dev.total}
          </span>{' '}
          familiar · {DEVELOPMENT_HINT[dev.level]}
        </p>
      </section>

      {(state?.neighbours.length || foreign.length) ? (
        <dl className="place-rels">
          <div>
            <dt>Neighbours</dt>
            <dd>
              {state?.neighbours.map((n) => (
                <button key={n} type="button" onClick={() => onSelect({ type: 'state', id: n })} className="place-link">
                  {atlas.state(n)?.name ?? n}
                </button>
              ))}
              {foreign.map((iso) => {
                const c = atlas.country(iso)
                return (
                  <button key={iso} type="button" onClick={() => c && onSelect({ type: 'country', id: c.id })} className="place-link" data-foreign>
                    {c?.name ?? iso}
                  </button>
                )
              })}
            </dd>
          </div>
        </dl>
      ) : null}

      <section className="place-section" aria-label="Places here">
        <h3 className="eyebrow">Accessible here · {places.length} places</h3>
        {places.length ? (
          <ul className="unit-places">
            {places.map((p) => {
              const l = level(p.id)
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => onSelect({ type: 'place', id: p.id })}>
                    <PlaceIcon kind={p.kind} tags={p.tags} size={16} />
                    <span>{p.name}</span>
                    {l !== 'discovered' && l !== 'unknown' && <i style={{ background: MASTERY_COLOUR[l] }} />}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="place-hint">No gazetteer places recorded here.</p>
        )}
      </section>
    </article>
  )
}
