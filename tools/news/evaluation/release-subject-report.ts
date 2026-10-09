/** Exposed owner calibration diagnostics only. No labels enter the runtime. */
import { readFileSync, writeFileSync } from 'node:fs'
import { classifySubject, SUBJECTS } from '../../../src/current-affairs/validator-v3/subject.ts'
const gold = JSON.parse(readFileSync('tools/news/evaluation/calibration-gold-v1/gold.json', 'utf8'))
const rows = gold.records.map((r: { id: string; record: { metadata: { title: string; description: string } }; resolvedGold: { value: string; primarySubject: string } | null }, i: number) => {
  const predicted = classifySubject(r.record.metadata), truth = r.resolvedGold
  return { number: i + 1, id: r.id, title: r.record.metadata.title, gold: truth?.primarySubject ?? null, value: truth?.value ?? null, prediction: predicted }
})
const positive = rows.filter((r: { value: string }) => ['must_read', 'useful'].includes(r.value))
const correct = positive.filter((r: { gold: string; prediction: { primary: string } }) => r.gold === r.prediction.primary).length
const confusion: Record<string, Record<string, number>> = {}
for (const r of positive) { confusion[r.gold] ??= {}; confusion[r.gold][r.prediction.primary] = (confusion[r.gold][r.prediction.primary] ?? 0) + 1 }
const classes = SUBJECTS.map(s => {
  const tp = positive.filter((r: { gold: string; prediction: { primary: string } }) => r.gold === s && r.prediction.primary === s).length
  const support = positive.filter((r: { gold: string }) => r.gold === s).length
  const predicted = positive.filter((r: { prediction: { primary: string } }) => r.prediction.primary === s).length
  return { subject: s, support, tp, predicted, recall: support ? tp / support : null, f1: support + predicted ? 2 * tp / (support + predicted) : null }
})
writeFileSync('docs/release/subject-calibration.json', JSON.stringify({ label: 'Exposed enriched owner calibration; not statistical release evaluation', independentOfAcceptance: true, correct, denominator: positive.length, accuracy: correct / positive.length, macroF1: classes.filter(s => s.f1 !== null).reduce((n, s) => n + s.f1!, 0) / classes.filter(s => s.f1 !== null).length, classes, confusion, rows }, null, 2) + '\n')
console.log(JSON.stringify({ correct, denominator: positive.length, errors: positive.filter((r: { gold: string; prediction: { primary: string } }) => r.gold !== r.prediction.primary).map((r: { number: number; gold: string; prediction: { primary: string } }) => ({ number: r.number, gold: r.gold, predicted: r.prediction.primary })) }))
