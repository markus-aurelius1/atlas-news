/** Survey of India boundary import must reject incomplete or non-geographic geometry before it can ship. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { boundaryStats, soiBoundaryFeatureCollection, validateSoiBoundary } from '../lib/soi-boundary.mjs'

const validLines = [
  [[68, 23], [72, 35], [75, 36], [78, 37.5], [97.5, 28], [95, 8], [77, 6.5], [68, 23]],
  ...Array.from({ length: 3 }, (_, j) => Array.from({ length: 10 }, (_, i) => [72 + i * 2 + j * 0.1, 10 + j * 3 + i * 0.2])),
]

test('accepts an India-scale geographic outline with the north-western claimed sector', () => {
  const collection = soiBoundaryFeatureCollection(validLines, 'a'.repeat(64))
  const stats = validateSoiBoundary(collection)
  assert.equal(stats.northWestClaim, true)
  assert.ok(stats.west <= 68)
  assert.ok(stats.east >= 97)
  assert.ok(stats.north >= 37)
  assert.ok(stats.south <= 7)
})

test('rejects a boundary missing the north-western claimed sector', () => {
  const shifted = validLines.map(line => line.map(([lon, lat]) => lat >= 34.5 && lon <= 76.5 ? [77, lat] : [lon, lat]))
  assert.throws(() => validateSoiBoundary({ type: 'MultiLineString', coordinates: shifted }), /north-western claimed-territory/)
})

test('rejects projected coordinates masquerading as lon\/lat', () => {
  assert.throws(() => boundaryStats({ type: 'LineString', coordinates: [[500000, 3000000], [510000, 3010000]] }), /not geographic/)
})
