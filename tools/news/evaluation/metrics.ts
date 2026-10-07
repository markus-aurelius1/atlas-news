import { digest, requireThat } from './core.ts'

export interface Rate { numerator: number; denominator: number; value: number | null; interval95: [number, number] | null; intervalMethod: 'wilson' | 'none'; status: 'measured' | 'undefined_zero_denominator' }
export function rate(numerator: number, denominator: number, weighted = false): Rate {
  requireThat(Number.isFinite(numerator) && Number.isFinite(denominator) && numerator >= 0 && denominator >= numerator, 'Invalid rate counts')
  const value = denominator ? numerator / denominator : null
  let interval95: [number, number] | null = null
  if (denominator && !weighted) {
    const z2 = 1.959963984540054 ** 2, divisor = 1 + z2 / denominator
    const center = (value! + z2 / (2 * denominator)) / divisor
    const margin = Math.sqrt(z2 * (value! * (1 - value!) / denominator + z2 / (4 * denominator ** 2))) / divisor
    interval95 = [Math.max(0, center - margin), Math.min(1, center + margin)]
  }
  return { numerator, denominator, value, interval95, intervalMethod: interval95 ? 'wilson' : 'none', status: denominator ? 'measured' : 'undefined_zero_denominator' }
}
export function binary(rows: { positive: boolean; accepted: boolean; weight?: number }[], weighted = false) {
  let tp = 0, fp = 0, fn = 0, tn = 0
  for (const row of rows) {
    const w = weighted ? row.weight ?? 1 : 1
    requireThat(Number.isFinite(w) && w > 0, 'Invalid evaluation weight')
    if (row.positive && row.accepted) tp += w
    else if (row.accepted) fp += w
    else if (row.positive) fn += w
    else tn += w
  }
  // F1 is not a binomial proportion. Use grouped bootstrap, never a fictitious Wilson interval.
  return { tp, fp, fn, tn, precision: rate(tp, tp + fp, weighted), recall: rate(tp, tp + fn, weighted), f1: rate(2 * tp, 2 * tp + fp + fn, true) }
}
/** Seeded group bootstrap complements descriptive Wilson intervals for dependent observations. */
export function groupedBootstrap<T>(rows: T[], group: (row: T) => string, measure: (sample: T[]) => number | null, seed: string, repetitions = 300) {
  requireThat(seed && Number.isInteger(repetitions) && repetitions >= 100, 'Invalid bootstrap configuration')
  const groups = new Map<string, T[]>()
  for (const row of rows) groups.set(group(row), [...groups.get(group(row)) ?? [], row])
  const ids = [...groups.keys()].sort()
  if (ids.length < 2) return { interval95: null, groups: ids.length, repetitions: 0, usable: 0, status: 'insufficient_groups' }
  const values: number[] = []
  for (let r = 0; r < repetitions; r++) {
    const sampled = ids.flatMap((_, draw) => groups.get(ids[Number.parseInt(digest([seed, r, draw]).slice(0, 12), 16) % ids.length])!)
    const value = measure(sampled); if (value !== null) values.push(value)
  }
  values.sort((a, b) => a - b)
  return { interval95: values.length ? [values[Math.floor((values.length - 1) * 0.025)], values[Math.ceil((values.length - 1) * 0.975)]] : null, groups: ids.length, repetitions, usable: values.length, status: values.length ? 'estimated' : 'undefined' }
}
export function clustering(rows: { id: string; gold: string; predicted: string | null }[]) {
  let tp = 0, fp = 0, fn = 0; let bPrecision = 0, bRecall = 0
  const predicted = (row: typeof rows[number]) => row.predicted === null ? 'abstain:' + row.id : 'cluster:' + row.predicted
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const goldSame = rows[i].gold === rows[j].gold, predSame = predicted(rows[i]) === predicted(rows[j])
      if (goldSame && predSame) tp++; else if (predSame) fp++; else if (goldSame) fn++
    }
    const truth = rows.filter(r => r.gold === rows[i].gold), cluster = rows.filter(r => predicted(r) === predicted(rows[i]))
    const intersection = cluster.filter(r => r.gold === rows[i].gold).length
    bPrecision += intersection / cluster.length; bRecall += intersection / truth.length
  }
  const p = rows.length ? bPrecision / rows.length : null, r = rows.length ? bRecall / rows.length : null
  return { pairs: { tp, fp, fn, precision: rate(tp, tp + fp), recall: rate(tp, tp + fn), f1: rate(2 * tp, 2 * tp + fp + fn,true), falseMerge: rate(fp, tp + fp), falseSplit: rate(fn, tp + fn) },
    bCubed: { count: rows.length, precision: p, recall: r, f1: p !== null && r !== null && p + r ? 2 * p * r / (p + r) : null }, abstentions: rows.filter(row => row.predicted === null).length }
}
export function pairMetric(pairs: { left: string; right: string; same: boolean | null; predictedSame: boolean }[]) {
  const resolved = pairs.filter(p => p.same !== null)
  return { ...binary(resolved.map(p => ({ positive: p.same!, accepted: p.predictedSame }))), unresolved: pairs.length - resolved.length }
}
export function agreement(pairs: { left: string | null; right: string | null }[]) {
  const resolved = pairs.filter(p => p.left !== null && p.right !== null), n = resolved.length
  const observed = rate(resolved.filter(p => p.left === p.right).length, n)
  const labels = new Set(resolved.flatMap(p => [p.left!, p.right!]))
  const expected = n ? [...labels].reduce((sum, label) => sum + resolved.filter(p => p.left === label).length * resolved.filter(p => p.right === label).length / n ** 2, 0) : null
  return { agreement: observed, kappa: expected !== null && expected < 1 ? (observed.value! - expected) / (1 - expected) : null, unresolved: pairs.length - n }
}
/** Explicitly supplied ordinal gains; missing judgments prevent a measured nDCG. */
export function ndcg(gains: (number | null)[], candidateGains: number[], k: number) {
  requireThat(Number.isInteger(k) && k > 0, 'Invalid rank cutoff')
  const ranked = gains.slice(0, k), unresolved = ranked.filter(g => g === null).length
  const dcg = (values: number[]) => values.reduce((sum, gain, i) => sum + gain / Math.log2(i + 2), 0)
  const ideal = dcg([...candidateGains].sort((a, b) => b - a).slice(0, k))
  return { k, ranked: ranked.length, unresolved, value: !unresolved && ideal > 0 ? dcg(ranked as number[]) / ideal : null, ideal, status: unresolved ? 'pending_judgments' : ideal ? 'measured_conditional_candidate_pool' : 'undefined_zero_gain' }
}
export function anchorPreference(sets: { preferredAvailable: boolean; comparable: boolean | null; selectedPreferred: boolean; materiallyInferiorOverride: boolean | null }[]) {
  const comparable = sets.filter(s => s.preferredAvailable && s.comparable === true)
  return { preference: rate(comparable.filter(s => s.selectedPreferred).length, comparable.length), materiallyInferiorOverrides: sets.filter(s => s.materiallyInferiorOverride === true).length, unresolved: sets.filter(s => s.comparable === null || s.materiallyInferiorOverride === null).length }
}
/** Distribution describes quality-qualified supply/selection; entropy is never a target. */
export function distribution(values:string[]){
  const counts=Object.fromEntries([...new Set(values)].sort().map(v=>[v,values.filter(x=>x===v).length]))
  const shares=Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,values.length?v/values.length:0]))
  return {total:values.length,counts,shares,entropy:values.length?-Object.values(shares).reduce((s,p)=>s+p*Math.log2(p),0):null,largestShare:values.length?Math.max(...Object.values(shares)):null}
}
export function diversityRegret(selected:{id:string;gain:0|1|3}[],qualityOnly:{id:string;gain:0|1|3}[]){
  const score=(rows:typeof selected)=>[...new Map(rows.map(r=>[r.id,r.gain])).values()].reduce<number>((s,g)=>s+g,0)
  const must=(rows:typeof selected)=>new Set(rows.filter(r=>r.gain===3).map(r=>r.id)).size
  return {selectedUtility:score(selected),qualityOnlyUtility:score(qualityOnly),utilityLoss:score(qualityOnly)-score(selected),uniqueMustReadLoss:must(qualityOnly)-must(selected)}
}
