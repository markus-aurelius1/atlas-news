/**
 * Candidate places: what to add, not what to say about it. Each candidate
 * names a Wikipedia article; gazetteer/generate.mjs takes the position,
 * facts and identifiers from that article and its Wikidata item, drops
 * candidates the gazetteer already has (same Wikidata item, or same name
 * nearby), and records every source.
 *
 *   C(kind, 'Wikipedia title', { lvl, tags, name, why, rel, sub, st, co, aka, f })
 *
 *   lvl   1 core · 2 standard · 3 advanced (default 3)
 *   why   the curation reason, kept with the place (e.g. 'pyq', 'ramsar', 'current-affairs')
 *   name  display name when it should differ from the article title
 *   f     facts to use instead of the article's lead (must still come from the cited sources)
 */
export const C = (kind, title, o = {}) => ({ kind, title, ...o })

/** Many candidates of one kind and level: G('river', 3, 'pyq', ['Mandakini River', …]). Items may be [title, opts]. */
export const G = (kind, lvl, why, items, o = {}) =>
  items.map((it) => (Array.isArray(it) ? C(kind, it[0], { lvl, why, ...o, ...it[1] }) : C(kind, it, { lvl, why, ...o })))
