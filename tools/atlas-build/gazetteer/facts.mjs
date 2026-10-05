/**
 * Facts from a Wikipedia lead: cleaned, split into sentences, and the most
 * useful few kept. Nothing is paraphrased: each fact is a sentence (or the
 * first clause of one) from the cited article.
 */

/** Remove pronunciations, native-script glosses and other bracketed asides. */
export function cleanLead(text) {
  let s = String(text)
    .replace(/ /g, ' ')
    .replace(/\s*\[\d+\]/g, '')
  // Drop parentheses that hold non-Latin script, IPA, "listen", language glosses or lone years/abbreviations.
  for (let i = 0; i < 3; i++)
    s = s.replace(/\s*\(([^()]*)\)/g, (m, inner) => {
      const t = inner.trim()
      if (!t) return ''
      if (/[^\u0000-ɏḀ-ỿ‐-‧°′″–—’‘“”€£]/.test(t)) return ''
      if (/(listen|pronounced|pron|IPA|lit\.|literally|Hindi|Urdu|Sanskrit|Bengali|Tamil|Telugu|Kannada|Malayalam|Marathi|Gujarati|Punjabi|Odia|Assamese|Nepali|Tibetan|Chinese|Arabic|Persian|Russian|Greek|Latin|French|Spanish|Portuguese|German|Italian|Japanese|Korean|Turkish|Hebrew|Kurdish|Pashto|Dari|Mongolian|Malay|Indonesian|Thai|Burmese|Khmer|Vietnamese|Amharic|Swahili|romani[sz]ed|also spelled|also known|formerly|meaning)/i.test(t)) return ''
      if (/^[A-Z]{2,6}:?\s/.test(t)) return ''
      return m
    })
  return s
    .replace(/\s+,/g, ',')
    .replace(/\(\s*;\s*/g, '(')
    .replace(/\s{2,}/g, ' ')
    .replace(/ ,/g, ',')
    .trim()
}

const ABBR = /\b(?:St|Mt|Ft|Pt|Dr|Mr|Mrs|No|Nos|Vol|vs|approx|est|ca|c|e\.g|i\.e|U\.S|U\.K|D\.C|a\.m|p\.m|Jr|Sr|Co|Inc|Ltd|km|sq|ft|mi|Gen|Lt|Col|Capt|Sgt|Rev|Prof|Govt|Dept|Rs|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.$/i

/** Sentence split that survives "St. Lawrence", "U.S." and initials. */
export function sentences(text) {
  const out = []
  let cur = ''
  const parts = text.split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/)
  for (const p of parts) {
    cur = cur ? cur + ' ' + p : p
    if (ABBR.test(cur) || /\b[A-Z]\.$/.test(cur)) continue
    out.push(cur.trim())
    cur = ''
  }
  if (cur) out.push(cur.trim())
  return out.filter((s) => s.length > 20 && !/^(For other uses|This article|Not to be confused)/.test(s))
}

const INFORMATIVE = /\b(largest|longest|highest|deepest|smallest|oldest|first|only|major|important|known for|famous|home to|habitat|endemic|confluence|tributar|originates|rises|source|flows|drains|empties|joins|border|bounded|separates|connects|links|located|situated|lies|between|elevation|altitude|metres|km|square|hectares|area|declared|designated|established|notified|Ramsar|UNESCO|World Heritage|biosphere|tiger|elephant|rhino|lion|species|mangrove|coral|glacier|volcan|erupt|dam|reservoir|hydroelectric|irrigation|port|harbour|strait|channel|capital|headquarters|administrative)\b/i
const WEAK = /\b(etymology|named after|the name|derives from|is derived|census|population of|as of the \d{4} census|constituency|assembly|lok sabha|pin code|postal|railway station|is served by|nearest airport|tourist|tourism|temple of|festival)\b/i

/**
 * Pick up to `max` facts from a lead: the defining first sentence, then the
 * most informative of the rest. `prefer` ranks sentences matching it first
 * (e.g. recent years for places in the news).
 */
export function pickFacts(lead, { max = 3, maxLen = 260, prefer } = {}) {
  const all = sentences(cleanLead(lead))
  if (!all.length) return []
  // The defining sentence may run long; keep it whole up to a generous limit.
  const first = trimSentence(all[0], maxLen + 160)
  const rest = all
    .slice(1)
    .map((s, i) => ({ s: trimSentence(s, maxLen), i }))
    .filter(({ s }) => s && !WEAK.test(s))
    .map(({ s, i }) => ({ s, score: (INFORMATIVE.test(s) ? 2 : 0) + (prefer?.test(s) ? 3 : 0) + (/\d/.test(s) ? 1 : 0) - i * 0.15 }))
    .sort((a, b) => b.score - a.score)
  const out = first ? [first] : []
  for (const { s } of rest) {
    if (out.length >= max) break
    if (out.some((o) => o.includes(s) || s.includes(o))) continue
    out.push(s)
  }
  return out
}

/** Keep a sentence whole when it fits; otherwise cut at the last clause boundary that does. */
function trimSentence(s, maxLen) {
  if (s.length <= maxLen) return s
  const cut = s.slice(0, maxLen)
  const at = Math.max(cut.lastIndexOf('; '), cut.lastIndexOf(', and '), cut.lastIndexOf(', which'), cut.lastIndexOf(', where'))
  if (at > maxLen * 0.5) return cut.slice(0, at).replace(/[,;]$/, '') + '.'
  return null
}
