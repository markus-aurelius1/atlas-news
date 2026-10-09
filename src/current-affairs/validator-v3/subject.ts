import type { StageCMetadata } from './contracts.ts'

export const SUBJECT_POLICY = 'tars-subject/1'
export const SUBJECTS = ['Polity', 'Governance', 'Economy', 'International relations', 'Security', 'Sci-Tech', 'Environment', 'Geography', 'History & Culture'] as const
export type Subject = typeof SUBJECTS[number]
export interface SubjectDecision {
  policy: typeof SUBJECT_POLICY; primary: Subject | 'Unresolved'; secondary: Subject[]
  confidence: 'high' | 'moderate' | 'unresolved'; margin: number
  reason: 'dominant_frame' | 'conflicting_frames' | 'insufficient_subject_evidence'
  evidence: { subject: Subject; field: 'title' | 'description'; start: number; end: number; text: string; rule: string }[]
}
// Compound issue/action/object frames outrank isolated entities. Places, publisher,
// section, author, acceptance and PYQ frequency never vote for primary subject.
const frames: readonly [Subject, string, string][] = [
  ['Polity', 'constitutional', String.raw`\b(constitutional (?:powers?|rights?|institutions?|court|federalism)|fundamental rights|judicial independence|electoral (?:law|roll|rights)|election commission|anti.defection|federalism|voter rights|judicial autonomy|parliamentary privileges|separation of powers|institutional (?:independence|accountability)|mining law)\b`],
  ['Polity', 'judgment', String.raw`\b(?:supreme court|constitutional court)\b.{0,55}\b(?:rul\w*|judgment|invalidat\w*|rights|powers?|law|approve|form)\b|\bEC\b.{0,70}\bmass deletions\b|\b(?:election|electoral)\b.{0,50}\b(?:financ\w*|spending|expen\w*)\b|\b(?:expen\w*|funding)\b.{0,30}\belection\b`],
  ['Governance', 'service', String.raw`\b(public service delivery|service delivery|implementation (?:of|impact)|welfare (?:delivery|scheme)|public health system|law enforcement|administrative reform|digital public services|benefit delivery|Ayushman Bharat)\b`],
  ['Economy', 'economic', String.raw`\b(inflation(?: transmission)?|monetary policy|fiscal policy|fiscal federalism|tax devolution|capex strategy|public debt|credit regulation|lending transparency|loan rates|borrower protection|GDP|economic mobility|income distribution|labou?r market|inequality|middle.class|economics|oil prices?|crude oil costs?|energy costs?|supply shock|banking (?:regulation|liquidity)|fiscal (?:equity|efficiency))\b|\boil\b.{0,80}\bprices?\b`],
  ['Economy', 'fiscal-mechanism', String.raw`\bfiscal federalism\b.{0,55}\b(?:efficiency|equity|devolution)\b`],
  ['International relations', 'diplomatic', String.raw`\b(diplomac\w*|diplomatic (?:talks|negotiations?|treaty)|bilateral (?:talks|relations|agreement)|trade agreement|multipolar (?:world|order)|great.power|international order|global governance|sanctions bargaining|peace deal|ceasefire|US.Iran deal)\b`],
  ['International relations', 'strategic-argument', String.raw`\bdiplomacy\b.{0,45}\b(?:acting|fails?|reforms?|constraints?)\b|\b(?:Iran|Ukraine|Russia|Gaza)\b.{0,15}\bwar\b.{0,70}\b(?:elections?|front|regional order)\b`],
  ['Security', 'capability', String.raw`\b(defen[cs]e (?:readiness|doctrine|capability)|naval (?:blockade|capability|protection)|military (?:blockade|readiness|doctrine)|border (?:security|management)|cyber (?:infrastructure|security|attack)|terror financ\w*|nuclear (?:enrichment|arsenal|proliferation|security)|uranium enrichment|arms control|non.proliferation|strategic (?:exclave|deterrence)|Baltic exclave|maritime (?:security|chokepoint)|deterrence)\b|\bIran\b.{0,35}\benrichment\b`],
  ['Sci-Tech', 'research', String.raw`\b(quantum (?:computing|research)|optogenetics|gene editing|gravitational waves|ion channels|Nobel (?:Medicine|Physics|Chemistry)|fossils?|dinosaur|exoplanet|space (?:mission|instrumentation)|telescope (?:findings?|discover\w*)|R&D ecosystem|research and development|science policy|innovation system|IndiaAI|MeitY|artificial intelligence|AI governance)\b`],
  ['Environment', 'ecology', String.raw`\b(climate change|global warming|biodiversity|ocean warming|carbon cycle|ecological restoration|restoration methods?|conservation strategy|rejuvenation strategy|wetland conservation|Ramsar|IUCN|tipping point|habitat loss|species extinction|carbon emissions)\b`],
  ['Geography', 'physical', String.raw`\b(bathymetry|plate tectonics|geomorphology|strait formation|how (?:a )?strait forms|monsoon mechanism|ocean currents|river formation|physical geography|volcanic formation|glacial landforms)\b`],
  ['History & Culture', 'heritage', String.raw`\b(archaeolog\w*|ancient (?:civilisation|civilization|inscription)|cultural heritage|historical (?:monument|inscription)|medieval architecture|Buddhist art|Indus Valley)\b`],
]

export function classifySubject(metadata: Pick<StageCMetadata, 'title' | 'description'>): SubjectDecision {
  const scores = new Map<Subject, number>(), evidence: SubjectDecision['evidence'] = []
  for (const [subject, rule, pattern] of frames) {
    for (const field of ['title', 'description'] as const) {
      const match = new RegExp(pattern, 'i').exec(metadata[field])
      if (!match) continue
      evidence.push({ subject, field, start: match.index, end: match.index + match[0].length, text: match[0], rule: `D.${rule}.v1` })
      // Independent matched families support dominance; repeating a word does not.
      scores.set(subject, (scores.get(subject) ?? 0) + (field === 'title' ? 9 : 3))
    }
  }
  const ranked = [...scores].sort((a, b) => b[1] - a[1] || SUBJECTS.indexOf(a[0]) - SUBJECTS.indexOf(b[0]))
  const best = ranked[0], margin = best ? best[1] - (ranked[1]?.[1] ?? 0) : 0
  const resolved = !!best && margin >= 3
  return { policy: SUBJECT_POLICY, primary: resolved ? best[0] : 'Unresolved', secondary: resolved ? ranked.slice(1).map(([s]) => s) : [], confidence: resolved ? margin >= 9 ? 'high' : 'moderate' : 'unresolved', margin,
    reason: resolved ? 'dominant_frame' : best ? 'conflicting_frames' : 'insufficient_subject_evidence', evidence }
}
