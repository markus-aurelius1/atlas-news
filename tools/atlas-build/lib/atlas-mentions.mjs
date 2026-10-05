/** Broad coverage extraction and conservative resolution. Exact dictionaries plus lexical review; no fuzzy matching or coordinate inference. */
import { normalizeName } from './pyq.mjs'
import { textLocations } from '../../../src/atlas/pyq/quality.mjs'

export function buildEntityIndex(atlas, mappings, candidates = []) {
  const byId = new Map(atlas.places.map((p) => [p.id, p]))
  const tiers = Array.from({ length: 4 }, () => new Map())
  const trie = new Map(), qids = new Map(), candidateNames = new Set()
  const stopWords = new Set(['to', 'in', 'on', 'at', 'of', 'for', 'by', 'as', 'an', 'and', 'the', 'a', 'it', 'is', 'or', 'be', 'do', 'if', 'up', 'indian'])
  const rejectedAliasDefinitions = []
  const addTrie = (name) => {
    const words = normalizeName(name).split(' ').filter(Boolean)
    if (!words.length || (words.length === 1 && (stopWords.has(words[0]) || words[0].length < 3))) return
    let branch = trie
    for (const word of words) { if (!branch.has(word)) branch.set(word, new Map()); branch = branch.get(word) }
    branch.set('', normalizeName(name))
  }
  const add = (tier, key, id) => {
    if (!key) return
    if (stopWords.has(normalizeName(key))) { rejectedAliasDefinitions.push({ placeId: id, alias: key, reason: 'generic-word-is-not-geographic-identity' }); return }
    const values = tiers[tier].get(key) ?? []; if (!values.includes(id)) values.push(id); tiers[tier].set(key, values); addTrie(key)
  }
  for (const p of atlas.places) {
    add(0, p.name, p.id)
    for (const name of p.aka ?? []) add(1, name, p.id)
    add(2, normalizeName(p.name), p.id)
    for (const name of p.aka ?? []) add(2, normalizeName(name), p.id)
    // Descriptors identify an existing feature's kind, rather than constituting a new spelling-based place.
    const descriptors = { river: ['River'], lake: ['Lake'], glacier: ['Glacier'], plateau: ['Plateau'], desert: ['Desert'], island: ['Island', 'Islands'], dam: ['Dam'], port: ['Port'], pass: ['Pass'], range: ['Range', 'Hills'], waterfall: ['Falls', 'Waterfall'], park: ['National Park', 'Wildlife Sanctuary'], wetland: ['Wetland', 'Wetlands'], valley: ['Valley', 'Canyon'], plain: ['Plain', 'Plains'] }[p.kind]
    if (descriptors) for (const name of [p.name, ...(p.aka ?? [])]) {
      const key = normalizeName(name)
      for (const descriptor of descriptors) {
        const d = descriptor.toLowerCase()
        if (key.endsWith(' ' + d)) add(2, key.slice(0, -d.length).trim(), p.id)
        else if (key.startsWith(d + ' ')) add(2, key.slice(d.length).trim(), p.id)
        else if (!key.includes(d)) { add(2, `${key} ${d}`, p.id); add(2, `${d} ${key}`, p.id) }
      }
    }
    addTrie(p.id)
    if (p.wikidata) qids.set(p.wikidata, [...(qids.get(p.wikidata) ?? []), p.id])
  }
  // Existing polygon identities are reported separately; they are never passed off as gazetteer place IDs.
  const sheetEntities = new Map()
  for (const entity of [...atlas.states.map((s) => ({ ...s, entityType: 'state' })), ...atlas.countries.map((c) => ({ ...c, entityType: 'country' }))]) {
    const key = normalizeName(entity.name)
    sheetEntities.set(key, entity); addTrie(entity.name)
  }
  for (const c of candidates) { const name = c.name ?? c.title; if (name) { candidateNames.add(normalizeName(name)); addTrie(name) } }
  for (const mapping of [...mappings.aliases, ...mappings.wikidata]) {
    if (!mapping.reason || !/^https:\/\//.test(mapping.sourceUrl ?? '') || (mapping.placeId && !byId.has(mapping.placeId)) || (mapping.wikidataId && !qids.has(mapping.wikidataId))) throw new Error(`Invalid identity override: ${mapping.mention}`)
    addTrie(mapping.mention)
  }
  return { byId, tiers, trie, qids, sheetEntities, candidateNames, mappings, rejectedAliasDefinitions }
}

export function resolveEntity(index, mention, questionId) {
  if (index.byId.has(mention)) return { placeId: mention, resolution: 'exact-id' }
  const key = normalizeName(mention)
  let ambiguous
  const collisions = index.tiers[2].get(key) ?? []
  const polygonCollision = index.sheetEntities.has(key) && collisions.length
  const collidingIdentities = collisions.length > 1 && !collisions.map((id) => index.byId.get(id)).every((p) => p.wikidata && p.wikidata === index.byId.get(collisions[0]).wikidata && p.kind === index.byId.get(collisions[0]).kind)
  if (!polygonCollision && !collidingIdentities && !index.mappings.ambiguousNames.includes(key) && key.length > 3) {
    for (const [n, map] of index.tiers.entries()) {
      const ids = map.get(n < 2 ? mention : key) ?? []
      if (ids.length === 1) return { placeId: ids[0], resolution: ['canonical-name', 'alias', 'normalized-alias', 'reserved'][n] }
      if (ids.length > 1) {
        const ps = ids.map((id) => index.byId.get(id))
        if (ps[0].wikidata && ps.every((p) => p.wikidata === ps[0].wikidata && p.kind === ps[0].kind) && new Set(ps.map((p) => p.sheet)).size === ps.length) {
          const ordered = [...ps].sort((a, b) => (a.sheet === 'india' ? -1 : 1) - (b.sheet === 'india' ? -1 : 1))
          return { placeId: ordered[0].id, alsoPlaceIds: ordered.slice(1).map((p) => p.id), resolution: 'same-wikidata-across-sheets' }
        }
        ambiguous = ids; break
      }
    }
  } else ambiguous = collisions
  const scoped = (mapping) => normalizeName(mapping.mention) === key && (!mapping.questionId || mapping.questionId === questionId)
  const wd = index.mappings.wikidata.filter(scoped)
  if (wd.length === 1) {
    const ids = index.qids.get(wd[0].wikidataId)
    if (ids?.length === 1) return { placeId: ids[0], resolution: 'wikidata-override', evidence: wd[0] }
    ambiguous = ids
  }
  const overrides = index.mappings.aliases.filter(scoped)
  if (overrides.length === 1) return { placeId: overrides[0].placeId, resolution: 'deterministic-override', evidence: overrides[0] }
  if (overrides.length > 1) throw new Error(`Conflicting identity overrides: ${mention}`)
  const entity = index.sheetEntities.get(key)
  return { placeId: null, resolution: polygonCollision ? 'name-versus-sheet-entity-review' : ambiguous?.length ? 'ambiguous-review' : entity ? 'sheet-entity-review' : 'unresolved-review', ...(ambiguous ? { candidates: ambiguous } : {}), ...(entity ? { entityId: entity.id, entityType: entity.entityType } : {}) }
}

const tokens = (text) => [...text.matchAll(/[\p{L}\p{N}]+(?:[’'][\p{L}\p{N}]+)?/gu)].map((m) => ({ word: normalizeName(m[0]), start: m.index, end: m.index + m[0].length }))
const feature = /\b(?:[A-Z][\p{L}’'-]+(?:\s+(?:[A-Z][\p{L}’'-]+|of|the)){0,5}?\s+(?:National Park|Wildlife Sanctuary|Tiger Reserve|Biosphere Reserve|River|Lake|Sea|Ocean|Strait|Channel|Island|Islands|Glacier|Plateau|Desert|Mountains|Hills|Pass|Valley|Dam|Port|Falls|Bay|Gulf|Range|Wetlands|Reservoir|Plains?|Peninsula|Trench|Estuary|Reef|Lagoon|Basin|Hydel Project|Project|Complex|Temple|Stupa|Pipeline)|(?:River|Lake|Mount|Strait of|Gulf of|Bay of)\s+[A-Z][\p{L}’'-]+)\b/gu
const properName = /\b[A-Z][\p{L}’'-]{2,}(?:\s+(?:[A-Z][\p{L}’'-]{2,}|of|the|and)){0,5}\b/gu

export function extractMentions(questionId, question, index) {
  const mentions = [], potentialNames = []
  for (const location of textLocations(question)) {
    const words = tokens(location.text), covered = []
    for (let i = 0; i < words.length; i++) {
      let branch = index.trie, found
      for (let j = i; j < words.length; j++) {
        branch = branch.get(words[j].word)
        if (!branch) break
        if (branch.has('')) found = { start: words[i].start, end: words[j].end, next: j }
      }
      if (!found) continue
      const mentionText = location.text.slice(found.start, found.end)
      // Lower-case common nouns may match a city alias; retain them for review, never resolve silently.
      const r = resolveEntity(index, mentionText, questionId)
      if (!/[A-Z]/.test(mentionText) && r.placeId) { r.candidates = [r.placeId]; r.placeId = null; r.resolution = 'case-context-review' }
      mentions.push({ questionId, mentionText, locationInQuestion: location.location, path: location.path, start: found.start, end: found.end, ...(location.optionKey ? { optionKey: location.optionKey } : {}), ...r })
      covered.push(found); i = found.next
    }
    for (const m of location.text.matchAll(feature)) {
      if (covered.some((c) => c.start <= m.index && c.end >= m.index + m[0].length)) continue
      // A feature phrase must not be reduced to an embedded shorter place name (e.g. city vs a named park).
      const start = m.index, end = start + m[0].length
      if (covered.some((c) => c.start >= start && c.end <= end && /^(?:The|Which|Consider|In|At|A|With|Bay of)\b/.test(m[0]))) continue
      const r = resolveEntity(index, m[0], questionId)
      for (let n = mentions.length - 1; n >= 0; n--) if (mentions[n].path === location.path && mentions[n].start >= start && mentions[n].end <= end) mentions.splice(n, 1)
      mentions.push({ questionId, mentionText: m[0], locationInQuestion: location.location, path: location.path, start, end, ...(location.optionKey ? { optionKey: location.optionKey } : {}), ...r })
      covered.push({ start, end })
    }
    // An explicit residual audit queue makes dictionary blind spots visible without claiming every proper noun is geographic.
    for (const m of location.text.matchAll(properName)) if (!covered.some((c) => c.start < m.index + m[0].length && c.end > m.index)) potentialNames.push({ questionId, text: m[0], path: location.path, locationInQuestion: location.location, status: 'potential-name-not-confirmed-geographic' })
  }
  return { mentions, potentialNames }
}
