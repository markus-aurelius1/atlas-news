/**
 * Tiny authoring helpers for the gazetteer.
 *
 *   P(kind, name, lat, lon, {
 *     id,      // slug override (default: slug(name))
 *     st,      // India: state id or ids (source → mouth for rivers)
 *     co,      // World: ISO3 country code(s)
 *     lvl,     // 1 core · 2 standard · 3 advanced (default 2)
 *     el,      // elevation in metres
 *     f,       // fact or facts
 *     aka, tags, sub, region,
 *     rel,     // relations; ids like 'river.ganga' resolve on the same sheet
 *     geom,    // linked sheet feature, e.g. 'river:ganga' (auto for rivers/lakes)
 *     line,    // rivers missing from Natural Earth: { trace: { from, to? } } or { course: [[lat,lon]…] }
 *     src,     // provenance: { title, url } or a list of them (where the place/facts come from)
 *   })
 *
 * Coordinates are decimal degrees, latitude first.
 */
export const P = (kind, name, lat, lon, o = {}) => ({ kind, name, lat, lon, ...o })

/**
 * One previous-year question appearance for the PYQ ledger (content/pyq/).
 *
 *   Q('UPSC CSE Prelims', 2019, 'Consider the following pairs: Glacier – River …',
 *     ['Bandarpunch', 'in.glacier.siachen', { name: 'Milam', kind: 'glacier' }],
 *     { topic: ['glaciers', 'rivers'], source: { title: 'UPSC CSE Prelims 2019 GS-I, Q.37', url: 'pdf:upsc-2019-gs1.pdf#p12' } })
 *
 * `places` are place ids or names/aliases; use `{ name, kind?, sheet?, state? }`
 * when a name is ambiguous. Every entry needs a real source (link or PDF page).
 */
export const Q = (exam, year, q, places, o = {}) => ({ exam, year, q, places, ...o })
