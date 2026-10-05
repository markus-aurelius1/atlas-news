/** Survey of India boundary validation shared by the one-time importer and the runtime asset build. */
export const SOI_OUTLINE_URL = 'https://surveyofindia.gov.in/documents/Outline_of_India.zip'
export const SOI_OUTLINE_PAGE = 'https://surveyofindia.gov.in/pages/outline-maps-of-india'
export const SOI_OUTLINE_SCALE = 16_000_000

function linesFromGeometry(geometry) {
  if (!geometry) return []
  if (geometry.type === 'LineString') return [geometry.coordinates]
  if (geometry.type === 'MultiLineString') return geometry.coordinates
  if (geometry.type === 'Polygon') return geometry.coordinates.length ? [geometry.coordinates[0]] : []
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flatMap(poly => poly.length ? [poly[0]] : [])
  if (geometry.type === 'GeometryCollection') return geometry.geometries.flatMap(linesFromGeometry)
  return []
}

export function boundaryLines(input) {
  if (!input) return []
  if (input.type === 'FeatureCollection') return input.features.flatMap(feature => linesFromGeometry(feature.geometry))
  if (input.type === 'Feature') return linesFromGeometry(input.geometry)
  return linesFromGeometry(input)
}

export function boundaryStats(input) {
  const lines = boundaryLines(input)
  const points = lines.flat()
  if (!points.length) return { lines: 0, points: 0, west: Infinity, south: Infinity, east: -Infinity, north: -Infinity, northWestClaim: false }
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity, northWestClaim = false
  for (const point of points) {
    const [lon, lat] = point
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) throw new Error('Boundary contains non-finite coordinates')
    if (Math.abs(lon) > 180 || Math.abs(lat) > 90) throw new Error('Boundary is not geographic longitude/latitude; export the official source as EPSG:4326 first')
    west = Math.min(west, lon)
    south = Math.min(south, lat)
    east = Math.max(east, lon)
    north = Math.max(north, lat)
    if (lat >= 34.5 && lon <= 76.5) northWestClaim = true
  }
  return { lines: lines.length, points: points.length, west, south, east, north, northWestClaim }
}

export function validateSoiBoundary(input) {
  const stats = boundaryStats(input)
  if (stats.lines < 1 || stats.points < 20) throw new Error('Survey of India boundary has too little geometry')
  if (stats.west > 69 || stats.east < 96 || stats.south > 9 || stats.north < 36.5) throw new Error(`Survey of India boundary extent is incomplete: ${JSON.stringify(stats)}`)
  if (!stats.northWestClaim) throw new Error('Survey of India boundary validation failed in the north-western claimed-territory sector')
  return stats
}

export function soiBoundaryFeatureCollection(lines, sourceSha256) {
  const collection = {
    type: 'FeatureCollection',
    features: lines.map((coordinates, index) => ({
      type: 'Feature',
      properties: {
        id: `india-soi-boundary-${index}`,
        source: 'Survey of India',
        authority: 'survey-of-india',
        scale: '1:16M',
        sourceUrl: SOI_OUTLINE_URL,
        sourcePage: SOI_OUTLINE_PAGE,
        sourceSha256,
      },
      geometry: { type: 'LineString', coordinates },
    })),
  }
  validateSoiBoundary(collection)
  return collection
}
