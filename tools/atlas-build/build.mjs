/**
 * Builds the offline Atlas into public/atlas/v1:
 *   {india,world}.json          vector layers + labels, pre-projected to sheet pixels
 *   {india,world}-relief.webp   physical plate (hypsometric tints + hillshade)
 *   {india,world}-shade.webp    hillshade for the political plate
 *   places.json                 the gazetteer (see content/), with exam history and
 *                               study-priority scores from the PYQ ledger (content/pyq/) when it has entries
 *
 * Usage: node build.mjs [--no-relief] [--only=india|world] [--places-only]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSheet } from './lib/sheetBuild.mjs'
import { compilePlaces } from './lib/places.mjs'
import { buildOverlay } from './lib/overlay.mjs'
import { applyPyq, explainUnmatched } from './lib/pyq.mjs'
import PYQ_LEDGER from './content/pyq/index.mjs'
import PYQ_NOT_MAPPED from './content/pyq/not-mapped.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '../..')
const OUT = join(root, 'public/atlas/v1')
const PREVIEW = join(dirname(fileURLToPath(import.meta.url)), '.cache/preview')
mkdirSync(OUT, { recursive: true })
mkdirSync(PREVIEW, { recursive: true })

const args = new Set(process.argv.slice(2))
const only = [...args].find((a) => a.startsWith('--only='))?.split('=')[1]
const skipRelief = args.has('--no-relief')

const sheets = {}
const placesOnly = args.has('--places-only')
for (const id of ['india', 'world']) {
  if (placesOnly || (only && only !== id)) continue
  const built = await buildSheet(id, { skipRelief })
  sheets[id] = built
  const json = JSON.stringify(built.data)
  writeFileSync(join(OUT, `${id}.json`), json)
  console.log(`  ${id}.json ${(json.length / 1024).toFixed(0)} KB`)
  if (built.relief) {
    writeFileSync(join(OUT, `${id}-relief.webp`), built.relief.reliefWebp)
    writeFileSync(join(OUT, `${id}-shade.webp`), built.relief.shadeWebp)
    writeFileSync(join(PREVIEW, `${id}-relief.png`), built.relief.previewPng)
    console.log(`  relief ${(built.relief.reliefWebp.length / 1024).toFixed(0)} KB, shade ${(built.relief.shadeWebp.length / 1024).toFixed(0)} KB`)
  }
}

// ── gazetteer ─────────────────────────────────────────────────────────────
const sheetData = {}
for (const id of ['india', 'world']) sheetData[id] = sheets[id]?.data ?? JSON.parse(readFileSync(join(OUT, `${id}.json`), 'utf8'))

// Pass 1 links places to what the base sheets draw; the overlay adds courses and
// outlines for the rest (Natural Earth 1:10m, then OpenStreetMap by Wikidata id).
const first = compilePlaces(sheetData)
const overlays = {}
if (placesOnly) {
  const prior = JSON.parse(readFileSync(join(OUT, 'places.json'), 'utf8'))
  for (const id of ['india', 'world']) {
    const data = JSON.parse(readFileSync(join(OUT, `${id}-overlay.json`), 'utf8'))
    const rows = prior.places.filter(p => p.sheet === id)
    overlays[id] = {
      data,
      geomOf: new Map(rows.filter(p => p.geom).map(p => [p.id, p.geom])),
      sources: new Map(rows.flatMap(p => (p.sources ?? []).filter(s => s.title.endsWith(' (outline or course)')).map(s => [p.id, { ...s, title: s.title.replace(' (outline or course)', '') }]))),
    }
  }
} else if (!args.has('--no-overlay')) {
  console.log('\n▸ overlay')
  for (const id of ['india', 'world']) {
    const onSheet = first.data.places.filter((p) => p.sheet === id)
    const linked = new Set(onSheet.filter((p) => p.geom).map((p) => p.id))
    const ov = await buildOverlay(id, onSheet.map((p) => ({ id: p.id, kind: p.kind, name: p.name, qid: p.wikidata, sub: p.subtitle, lvl: p.level, x: p.x, y: p.y })), sheetData[id], linked)
    overlays[id] = ov
    const json = JSON.stringify(ov.data)
    writeFileSync(join(OUT, `${id}-overlay.json`), json)
    console.log(`  ${id}-overlay.json ${(json.length / 1024).toFixed(0)} KB`)
  }
} else for (const id of ['india', 'world']) overlays[id] = null

// Pass 2: the full gazetteer, linked to base and overlay geometry.
const { data: places, warnings } = compilePlaces(sheetData, overlays)
for (const w of warnings) console.warn('  ⚠ ' + w)

// ── previous-year questions → exam history + study priority ───────────────
const pyq = applyPyq(places.places, PYQ_LEDGER)
if (pyq.applied) {
  places.yieldModel = pyq.model
  const REPORTS = join(dirname(fileURLToPath(import.meta.url)), 'reports')
  mkdirSync(REPORTS, { recursive: true })
  const { unmatched, explained } = explainUnmatched(pyq.unmatched, PYQ_NOT_MAPPED)
  writeFileSync(join(REPORTS, 'pyq-review.json'), JSON.stringify({ unmatched, ambiguous: pyq.ambiguous, invalid: pyq.invalid, explained }, null, 2))
  console.log(
    `▸ PYQ: ${PYQ_LEDGER.length} ledger entries → ${pyq.matched} places; ${unmatched.length} unmatched, ${pyq.ambiguous.length} ambiguous, ${pyq.invalid.length} invalid, ${explained.length} explained as not mapped (see reports/pyq-review.json)`,
  )
} else console.log('▸ PYQ ledger is empty: no exam history or priority scores attached')
const placesJson = JSON.stringify(places)
writeFileSync(join(OUT, 'places.json'), placesJson)
const counts = places.places.reduce((a, p) => ((a[p.sheet] = (a[p.sheet] ?? 0) + 1), a), {})
console.log(`\n▸ places.json ${(placesJson.length / 1024).toFixed(0)} KB — india ${counts.india}, world ${counts.world}, ${warnings.length} warnings`)

writeFileSync(
  join(OUT, 'ATTRIBUTION.txt'),
  `Tars Atlas data (version 1)

Countries, rivers, lakes, glaciers, physical regions and seas (and, in the
overlay, further river courses, lakes and regions matched by Wikidata id):
  Natural Earth (naturalearthdata.com) – public domain. India is drawn from
  Natural Earth's India point-of-view boundaries (ne_10m_admin_0_countries_ind).

States and Union Territories of India:
  DataMeet, "maps" repository (github.com/datameet/maps) – CC BY 4.0.

Relief, hillshade and traced river courses:
  Derived from AWS Terrain Tiles (registry.opendata.aws/terrain-tiles), which
  combine SRTM, GMTED2010, ETOPO1 and other public elevation sources.

Protected-area, wetland and disputed-region outlines, and river courses that
Natural Earth does not have (the overlay files):
  © OpenStreetMap contributors (openstreetmap.org/copyright), available under
  the Open Database License (ODbL). Each place lists its OpenStreetMap element.

Places and facts:
  Compiled for Tars from public reference sources. Every place links to
  its Wikipedia article (CC BY-SA 4.0) and Wikidata item (CC0); places added in
  data version 2 take their position from Wikidata and their facts verbatim
  from the article's lead. Designated sites follow the official lists: Ramsar
  Sites Information Service, National Tiger Conservation Authority, MoEFCC /
  UNESCO Man and the Biosphere; national capitals follow Natural Earth.
  Places added from previous-year papers take their position and facts from
  Wikipedia (CC BY-SA 4.0) and, where noted, coordinates from Wikidata (CC0);
  each such place lists its pages under "sources".

Previous-year question history:
  Transcribed from UPPSC question papers and the UPSC CSE sections of a PYQ
  workbook; every ledger entry cites its paper and page (tools/atlas-build/content/pyq).

The Atlas is a learning aid and not an authoritative map. External boundaries
of India follow the Government of India's depiction as closely as the source
data allows.
`,
)

export { sheets }
