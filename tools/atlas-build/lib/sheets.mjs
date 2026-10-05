/**
 * Atlas "sheets" – each is a fixed projection fitted to a fixed pixel frame.
 * Everything (vectors, rasters, place coordinates) is pre-projected into sheet
 * pixels at build time, so the app never needs a projection library and the
 * relief image and the vector overlay always line up exactly.
 */
import { geoConicConformal, geoPath } from 'd3-geo'
import { geoRobinson } from 'd3-geo-projection'

/** A lon/lat rectangle as a polygon (clockwise, densified so it projects as a curve). */
const bboxFeature = ([x0, y0, x1, y1]) => {
  const n = 40
  const ring = [
    ...Array.from({ length: n }, (_, i) => [x0, y0 + ((y1 - y0) * i) / n]),
    ...Array.from({ length: n }, (_, i) => [x0 + ((x1 - x0) * i) / n, y1]),
    ...Array.from({ length: n }, (_, i) => [x1, y1 - ((y1 - y0) * i) / n]),
    ...Array.from({ length: n }, (_, i) => [x1 - ((x1 - x0) * i) / n, y0]),
  ]
  ring.push(ring[0])
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }
}

export const SHEETS = {
  india: {
    id: 'india',
    title: 'India',
    width: 2400,
    // Lon/lat window shown on the sheet (India plus neighbours for context).
    bbox: [62, 4.5, 101, 38.5],
    projection: () => geoConicConformal().parallels([12, 32]).rotate([-81, 0]),
    // Terrain tile zoom used for the relief plate.
    terrainZoom: 7,
    exaggeration: 5,
    graticuleStep: 5,
  },
  world: {
    id: 'world',
    title: 'World',
    width: 2800,
    bbox: [-180, -60, 180, 84],
    projection: () => geoRobinson().rotate([-10, 0]),
    terrainZoom: 4,
    exaggeration: 14,
    graticuleStep: 20,
  },
}

/** Build the fitted projection and frame size for a sheet. */
export { bboxFeature }

export function sheetFrame(sheet) {
  const projection = sheet.projection()
  const [, y0, , y1] = sheet.bbox
  if (sheet.id === 'world') {
    projection.fitWidth(sheet.width, { type: 'Sphere' })
    // Crop to the latitude window (drop Antarctica), measured on the central meridian.
    const lon = -projection.rotate()[0]
    const top = projection([lon, y1])[1]
    const bottom = projection([lon, y0])[1]
    const [tx, ty] = projection.translate()
    projection.translate([tx, ty - top])
    return { projection, width: sheet.width, height: Math.ceil(bottom - top) }
  }
  const frame = bboxFeature(sheet.bbox)
  projection.fitWidth(sheet.width, frame)
  const path = geoPath(projection)
  const [[bx0, by0], [, by1]] = path.bounds(frame)
  const [tx, ty] = projection.translate()
  projection.translate([tx - bx0, ty - by0])
  return { projection, width: sheet.width, height: Math.ceil(by1 - by0) }
}
