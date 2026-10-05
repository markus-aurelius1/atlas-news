/** One-time deterministic importer for the official Survey of India Outline of India vector data. */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as shapefile from 'shapefile'
import { boundaryLines, SOI_OUTLINE_PAGE, SOI_OUTLINE_SCALE, SOI_OUTLINE_URL, soiBoundaryFeatureCollection, validateSoiBoundary } from './lib/soi-boundary.mjs'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

const args = Object.fromEntries(process.argv.slice(2).map(arg => {
  const match = arg.match(/^--([^=]+)=(.*)$/)
  return match ? [match[1], match[2]] : [arg.replace(/^--/, ''), true]
}))

const out = args.out ? resolve(String(args.out)) : join(repoRoot, 'public/atlas-assets/v1/india-controlled-border.geojson')
const metaOut = args.meta ? resolve(String(args.meta)) : join(repoRoot, 'public/atlas-assets/v1/india-boundary-source.json')

const sha = buffers => {
  const h = createHash('sha256')
  for (const buffer of buffers) h.update(buffer)
  return h.digest('hex')
}

async function readShapefile() {
  const shp = resolve(String(args.shp || ''))
  if (!args.shp || !existsSync(shp)) throw new Error('Pass the extracted official shapefile with --shp=<path>. Download it only from the Survey of India Outline Maps page.')
  const stem = shp.slice(0, -extname(shp).length)
  const dbf = args.dbf ? resolve(String(args.dbf)) : existsSync(stem + '.dbf') ? stem + '.dbf' : undefined
  const prj = existsSync(stem + '.prj') ? stem + '.prj' : undefined
  const reader = await shapefile.open(shp, dbf)
  const features = []
  while (true) {
    const next = await reader.read()
    if (next.done) break
    features.push(next.value)
  }
  const sourceBytes = [readFileSync(shp)]
  if (dbf) sourceBytes.push(readFileSync(dbf))
  if (prj) sourceBytes.push(readFileSync(prj))
  return { input: { type: 'FeatureCollection', features }, sourceSha256: sha(sourceBytes), files: [shp, dbf, prj].filter(Boolean) }
}

function readGeoJson() {
  const file = resolve(String(args.geojson || ''))
  if (!args.geojson || !existsSync(file)) throw new Error('Pass --geojson=<path> or --shp=<path>')
  const bytes = readFileSync(file)
  return { input: JSON.parse(bytes.toString('utf8')), sourceSha256: String(args['source-sha256'] || sha([bytes])), convertedSha256: sha([bytes]), files: [file] }
}

const source = args.geojson ? readGeoJson() : await readShapefile()
const lines = boundaryLines(source.input)
const collection = soiBoundaryFeatureCollection(lines, source.sourceSha256)
const stats = validateSoiBoundary(collection)

mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(collection) + '\n')
writeFileSync(metaOut, JSON.stringify({
  schema: 'tars-soi-boundary-source/v1',
  authority: 'Survey of India',
  product: 'International Boundary Vector data (Outline of India)',
  scale: SOI_OUTLINE_SCALE,
  sourcePage: SOI_OUTLINE_PAGE,
  sourceUrl: SOI_OUTLINE_URL,
  sourceSha256: source.sourceSha256,
  convertedSha256: source.convertedSha256 ?? source.sourceSha256,
  displayGeneralization: args.generalization ? String(args.generalization) : null,
  importedFiles: source.files.map(file => file.split(/[\\/]/).pop()),
  geometry: stats,
}, null, 2) + '\n')

console.log(`Survey of India boundary imported: ${stats.lines} lines, ${stats.points} points, sha256 ${source.sourceSha256}`)
console.log(`Wrote ${out}`)
