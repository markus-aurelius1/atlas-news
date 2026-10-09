/**
 * The Today list the app would show for a registry snapshot, with the reason for every choice. Feed metadata only.
 *
 *   node tools/news/snapshot.ts                 save a live collection (git-ignored cache)
 *   node tools/news/today.mjs                    the list by subject, each reading with its value and further coverage
 *   node tools/news/today.mjs --left-out         what qualified but was left out: topic already covered, subject cap, ceiling
 *   node tools/news/today.mjs --near             what fell just short of the floor, with every point weighed
 *   node tools/news/today.mjs --why=<text|text>  every point behind the verdict on headlines matching the text
 *     --snapshot=<path>  --clock=<ISO instant> (default: when the snapshot was collected)
 */
import { readFileSync } from 'node:fs'
import { NEWS_SUBJECTS } from '../../src/current-affairs/subjects.ts'
import { evaluateProduction } from '../../src/current-affairs/validator-v3/adapter.ts'

const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3), flag = name => process.argv.includes(`--${name}`)
const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'))
const feed = json(arg('snapshot') ?? './.cache/snapshot.json'), index = json('../../public/current-affairs/v2/relevance-index.json')
const clock = arg('clock') ?? feed.fetchedAt, now = Date.parse(clock)
const { output } = await evaluateProduction(feed, index, { history: [], selected: [] }, clock)
const { today, suppressed, diagnostics } = output.selection
const points = e => e.excluded ?? e.reasons.map(r => `${r.points > 0 ? '+' : ''}${r.points} ${r.label}${r.text ? ` [${r.text}]` : ''}`).join('; ')
const recent = output.articles.filter(a => { const t = Date.parse(a.item.publishedAt ?? ''); return t > now - 86400000 && t <= now })
const reasons = {}
for (const s of suppressed) if (s.reason !== 'undated_or_stale') reasons[s.reason] = (reasons[s.reason] ?? 0) + 1
console.log(`${clock}: ${recent.length} articles in the past 24 hours, ${recent.filter(a => a.acceptance.accepted).length} above the floor, ${today.length} readings listed (${diagnostics.mergedStories} further reports joined to them); left out: ${JSON.stringify(reasons)}`)

const why = arg('why')
if (why) {
  const pattern = new RegExp(why, 'i')
  for (const a of recent.filter(a => pattern.test(a.item.title))) console.log(`\n${a.acceptance.accepted ? 'OFFERED ' : 'rejected'} ${a.editorial.score}/${a.editorial.floor} ${a.subject.primary} | ${a.item.publisher}: ${a.item.title}\n    ${points(a.editorial)}`)
} else if (flag('near')) {
  for (const a of recent.filter(a => !a.acceptance.accepted && a.editorial.score >= a.editorial.floor - 2).sort((x, y) => y.editorial.score - x.editorial.score)) console.log(`${String(a.editorial.score).padStart(4)}/${a.editorial.floor} ${a.subject.primary} | ${a.item.publisher}: ${a.item.title}\n        ${points(a.editorial)}`)
} else if (flag('left-out')) {
  const units = new Map(output.stories.units.map(u => [u.id, u])), articles = new Map(output.articles.map(a => [a.item.url, a])), leads = new Map(today.map(r => [r.unit.id, r.primary.item.title]))
  for (const s of suppressed.filter(s => s.reason !== 'undated_or_stale')) { const item = units.get(s.id).members[0], a = articles.get(item.url); console.log(`${s.reason.padEnd(13)} ${String(a.editorial.score).padStart(4)} ${a.subject.primary} | ${item.publisher}: ${item.title}${s.by ? `\n        covered by: ${leads.get(s.by)}` : ''}`) }
} else {
  for (const subject of NEWS_SUBJECTS) {
    const readings = today.filter(r => r.primary.subject.primary === subject)
    if (!readings.length) continue
    console.log(`\n## ${subject} (${readings.length})`)
    for (const r of readings) {
      console.log(`${String(r.quality).padStart(5)}${r.mustRead ? '*' : ' '} ${r.primary.item.publisher}: ${r.primary.item.title}`)
      for (const member of r.unit.members) if (member.url !== r.primary.item.url) console.log(`           + ${member.publisher}: ${member.title}`)
    }
  }
}
