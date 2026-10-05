/** Frozen copy of the pre-overhaul validator and its 106-signal index, kept only as the audit baseline. */
import { COVERAGE_ALIASES } from './coverage-aliases-v1.ts'
import type { NewsItem, Relevance, RelevanceIndex } from '../../../src/current-affairs/types.ts'
export const normalize = (s: string) => s.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const negative = /\b(?:cricket|ipl|football|asian games|goal scorer|match score|wins? by \d|box office|film release|movie release|celebrity|actor|actress|horoscope|zodiac|viral video|murder|robbery|rape|arrested|road accident|car crash|smartphone|iphone|earbuds|smartwatch|stock price|share price|shares (?:rise|fall|jump|surge)|stocks (?:rise|fall|jump|surge)|sensex|nifty|answer practice|answer writing|quiz|mcqs?|mock test|extension of period)\b/i
const policy = /\b(?:constitution(?:al)?|fundamental rights|judg(?:e)?ment|ruling|regulat\w*|framework|policy|scheme|treaty|agreement|convention|bill|act|rules?|conservation|protected|ramsar|endangered|biodiversity|climate|emissions|mission|launch|space|discovery|discover\w*|genome|quantum|inflation|budget|tax|agriculture|report|index|indices|reform|security|monsoon|earthquake|geograph\w*|trade|econom\w*|poverty|development|commission|heritage|parliament|federal\w*|welfare|sanctuary|tiger reserve|national park)\b/i
const unique = (s: string[]) => [...new Set(s)]
export function classify(item: Pick<NewsItem, 'title' | 'description' | 'publisher' | 'section'> & Partial<Pick<NewsItem, 'sourceId'>>, index: RelevanceIndex): Relevance {
  const title = ` ${normalize(item.title)} `, text = ` ${normalize(item.title + ' ' + item.description)} `
  const aliases = (concept: string, original: string[]) => [...original, ...(COVERAGE_ALIASES[concept] ?? [])]
  const matches = index.signals.filter(s => aliases(s.concept, s.aliases).some(a => text.includes(` ${normalize(a)} `)))
  const strong = matches.filter(s => aliases(s.concept, s.aliases).some(a => title.includes(` ${normalize(a)} `)))
  const courtOnly = strong.length > 0 && strong.every(s => s.concept === 'Supreme Court') && !/\b(?:constitution\w*|fundamental|rights|landmark|federal\w*|article \d+|law|act|rules?|election|parliament)\b/i.test(item.title)
  const noise = negative.test(item.title) || courtOnly
  const curated = item.sourceId === 'ie-upsc' && item.publisher === 'Indian Express'
  const explainer = /explained|explainer/i.test(item.section)
  const substantive = policy.test(item.title + ' ' + item.description) || /\b(?:amendment|directions|guidelines|credit facilities|energy|payments|gdp|manufacturing|fssai|fcra|upi|glaciers?|landslides?|wildfires|contraceptive|coalmine|bond yields|treasury yields|electoral rolls?|voter registration|public health|leachate|landfills?|sewage|solid waste|floods|carbon neutral|land degradation)\b/i.test(item.title) || explainer
  // A crime/price/consumer/sports headline remains noise even if its teaser mentions a regulator or court.
  const supported = strong.length > 0 && matches.some(s => s.prelimsDemand || s.mainsDemand)
  const accepted = !noise && (substantive && supported || curated)
  const ordered = [...strong, ...matches.filter(s => !strong.includes(s))]
  const prelims = ordered.some(s => s.prelimsDemand), mains = ordered.some(s => s.mainsDemand)
  return { accepted, score: noise ? 0 : strong.length * 4 + matches.length + (substantive ? 2 : 0), exam: supported ? prelims && mains ? 'both' : mains ? 'mains' : 'prelims' : 'general', subjects: strong.length ? unique(strong.map(s => s.subject)).slice(0, 2) : curated ? ['General studies'] : [], topics: unique(strong.map(s => s.topic)).slice(0, 3), staticAnchors: unique(strong.map(s => s.concept)).slice(0, 3), signals: [...ordered.map(s => `${s.concept} · CSE P${s.prelimsCount}/M${s.mainsCount}`), ...(curated && !supported ? ['Publisher-curated UPSC coverage; no matched PYQ concept'] : [])], ...(!accepted ? { rejectionReason: noise ? 'Noise headline' : !strong.length ? 'No supported headline concept' : 'No substantive syllabus demand' } : {}) }
}
