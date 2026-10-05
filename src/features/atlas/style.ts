/**
 * The Atlas visual language – modelled on printed school atlases: bold,
 * unambiguous boundaries, pastel political colours, hypsometric relief, blue
 * water lettering, brown physical lettering, black cultural lettering, and
 * white halos behind every label so text stays readable on any background.
 */
export const INK = '#161616'
export const INK_SOFT = '#4a4a48'
export const WATER = '#1f5f9f'
export const WATER_LINE = '#3a7fc1'
export const PHYSICAL = '#6e3a12'
export const SEA_FLAT = '#c6e1f2'
export const NEIGHBOUR_FILL = '#f5f2ea'
/** Where the learner has studied: a warm edge and ring. Nothing marks the places they haven't. */
export const STUDIED = '#b8781b'
export const HIGHLIGHT = '#d9480f'

/** Political colours – soft enough for black lettering, distinct enough to separate neighbours. */
export const POLITICAL = ['#f3cf8a', '#c2dd92', '#f3b7a6', '#afd0ef', '#ddc1e6', '#f5e38a', '#a9ddc8']

/** Greedy graph colouring (deterministic): no two neighbours share a colour. */
export function colourAssignment(ids: string[], neighbours: Map<string, string[]>): Map<string, string> {
  const order = [...ids].sort((a, b) => (neighbours.get(b)?.length ?? 0) - (neighbours.get(a)?.length ?? 0) || a.localeCompare(b))
  const assigned = new Map<string, number>()
  for (const id of order) {
    const used = new Set((neighbours.get(id) ?? []).map((n) => assigned.get(n)).filter((x) => x !== undefined))
    let c = 0
    while (used.has(c)) c++
    assigned.set(id, c % POLITICAL.length)
  }
  return new Map([...assigned].map(([id, c]) => [id, POLITICAL[c]]))
}

export const MASTERY_COLOUR = {
  unknown: '#9a9a9a',
  discovered: '#7a7a7a',
  familiar: '#2f6fd0',
  strong: '#2e8b57',
  mastered: '#c99400',
} as const

export type MasteryLevel = keyof typeof MASTERY_COLOUR

/** Marker colors sit over cartography; small UI text needs theme-aware ink. */
export const MASTERY_TEXT_COLOUR: Record<MasteryLevel, string> = {
  unknown: 'var(--ink)', discovered: 'var(--ink)',
  familiar: 'var(--mastery-familiar-ink)', strong: 'var(--success)', mastered: 'var(--accent)',
}
