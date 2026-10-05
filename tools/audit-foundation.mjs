/** Exact text-occurrence inventory, separate from product behavior tests. */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
const terms = 'focus|pomodoro|timer|task|calendar|planning|habit|insight|expedition|base.?camp|soundscape|quick capture'
const paths = ['.']
const args = ['--json', '--hidden', '--no-ignore', '-ni', terms, ...paths,
  '-g', '!node_modules/**', '-g', '!**/node_modules/**', '-g', '!.git/**', '-g', '!tools/browser/out/**',
  '-g', '!tools/atlas-build/.cache/**', '-g', '!tools/atlas-build/reports/**', '-g', '!tools/current-affairs/.cache/**',
  '-g', '!android/app/src/main/assets/public/**', '-g', '!ios/App/App/public/**']
const result = spawnSync('rg', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
if (result.error) throw result.error
if (result.status > 1) throw new Error(result.stderr)
const occurrences = []
function explain(file, term, text) {
  if (file === 'tools/audit-foundation.mjs') return 'The owner-requested audit expression and its classification logic.'
  if (file.startsWith('docs/') || file === 'README.md' || file === 'AGENTS.md') return 'Current foundation documentation: source provenance or explanation of compatibility/current platform terminology.'
  if (file === 'package-lock.json') return 'Required third-party dependency package identity; the lockfile is not product code.'
  if (file === 'eslint.config.js' && term.toLowerCase() === 'focus') return 'Accessibility lint rule and keyboard-focus documentation.'
  if (file.startsWith('public/atlas/') || file.startsWith('public/pyq-atlas/') || file.startsWith('public/current-affairs/')) return 'Unchanged sourced geographic facts, canonical question text or relevance vocabulary; source fidelity requires retaining the term.'
  if (file.startsWith('tools/atlas-build/content/')) return 'Curated geographic/PYQ source content or official source identity; retaining exact source meaning.'
  if (file === 'src/data/compatibility/schema.ts') return 'Exact historical database store/index or v2 upgrade key, necessary to preserve existing lodestar data.'
  if (file.startsWith('android/') && term.toLowerCase() === 'task') return 'Gradle build-language keyword.'
  if (file.startsWith('dist/')) {
    if (file.endsWith('.css') && term.toLowerCase() === 'calendar') return 'Standard browser date-control pseudo-element in Tailwind reset CSS.'
    if (file.endsWith('.json') && !file.endsWith('manifest.json')) return 'Shipped canonical/geographic/relevance data; same source-content rule as public assets.'
    if (term.toLowerCase() === 'focus') return 'Compiled keyboard/CSS accessibility API or retained Atlas camera focal rectangle.'
    if (term.toLowerCase() === 'task') return 'Compiled compatibility index key or required dependency scheduling identifier.'
    if (['habit','expedition','basecamp'].includes(term.toLowerCase())) return 'Compiled historical database store or upgrade key from compatibility/schema.ts.'
    if (term.toLowerCase() === 'timer') return 'Required browser/vendor scheduling API.'
  }
  if (file.startsWith('src/') || file.startsWith('tools/browser/')) {
    if (term.toLowerCase() === 'focus') return 'Keyboard accessibility/selection, map focal geometry, or focused QA wording.'
    if (term.toLowerCase() === 'timer') return 'Browser scheduling for map resource release, tooltips, toast dismissal, date rollover or Vitest clock control.'
    if (term.toLowerCase() === 'task' && file === 'src/lib/lazy.ts') return 'Generic idle callback parameter, unrelated to a product record.'
    if (term.toLowerCase() === 'calendar' && /day|boundar/i.test(text)) return 'Date boundary for current News archive/edition handling.'
    if (term.toLowerCase() === 'habit' && /habitat|inhabit/i.test(text)) return 'Factual biodiversity vocabulary in current News classification/fixture content.'
    if (term.toLowerCase() === 'planning' && file.startsWith('src/features/atlas/renderer/')) return 'Tile coverage scheduling in the unchanged baseline renderer.'
  }
  if (file.startsWith('tools/atlas-build/') && term.toLowerCase() === 'focus') return 'Question stem feature-selection variable in deterministic relevance classification.'
  if (file === 'tools/atlas-build/gazetteer/facts.mjs' && term.toLowerCase() === 'habit' && /habitat/.test(text)) return 'Geographic source-fact extraction vocabulary.'
  return null
}
for (const line of result.stdout.split('\n').filter(Boolean)) {
  const event = JSON.parse(line)
  if (event.type !== 'match') continue
  const { path, lines, line_number, submatches } = event.data
  const file = path.text.replaceAll('\\', '/').replace(/^\.\//, '')
  for (const match of submatches) {
    const snippet = lines.text.slice(Math.max(0, match.start - 70), match.end + 90).trim()
    occurrences.push({ file, line: line_number, term: match.match.text, snippet, reason: explain(file, match.match.text, lines.text) })
  }
}
const unexplained = occurrences.filter(row => !row.reason)
const byFile = Object.fromEntries([...new Set(occurrences.map(row => row.file))].sort().map(file => [file, occurrences.filter(row => row.file === file).length]))
const publicChecks = JSON.parse(readFileSync('docs/asset-origins.json', 'utf8'))
for (const asset of publicChecks.assets) {
  const hash = createHash('sha256').update(readFileSync('public/' + asset.path)).digest('hex')
  if (hash !== asset.sha256) throw new Error('Baseline asset changed: ' + asset.path)
}
const places = JSON.parse(readFileSync('public/atlas/v1/places.json', 'utf8'))
if (createHash('sha256').update(JSON.stringify(places.places)).digest('hex') !== publicChecks.placesSha256) throw new Error('Baseline place records changed')
mkdirSync('tools/browser/out', { recursive: true })
writeFileSync('tools/browser/out/text-audit.json', JSON.stringify({ command: ['rg', ...args], occurrences: occurrences.length, unexplained: unexplained.length, byFile, matches: occurrences }, null, 2) + '\n')
console.log(JSON.stringify({ occurrences: occurrences.length, unexplained: unexplained.length, byFile }, null, 2))
if (unexplained.length) { console.error(unexplained); process.exitCode = 1 }
