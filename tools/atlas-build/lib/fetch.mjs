import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
export const CACHE = join(root, '.cache')

/** Download once, then serve from tools/atlas-build/.cache (git-ignored). */
export async function cached(url, { name, retries = 4 } = {}) {
  mkdirSync(CACHE, { recursive: true })
  const file = join(CACHE, name ?? createHash('sha1').update(url).digest('hex').slice(0, 16) + '-' + url.split('/').pop().split('?')[0])
  if (existsSync(file)) return readFileSync(file)
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      const buf = Buffer.from(await res.arrayBuffer())
      mkdirSync(dirname(file), { recursive: true })
      writeFileSync(file, buf)
      return buf
    } catch (err) {
      if (attempt >= retries) throw err
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt))
    }
  }
}

export const cachedJson = async (url, opts) => JSON.parse((await cached(url, opts)).toString('utf8'))

const NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson'
export const naturalEarth = (layer) => cachedJson(`${NE}/${layer}.geojson`, { name: `ne/${layer}.geojson` })

const DM = 'https://raw.githubusercontent.com/datameet/maps/master'
export const dataMeet = (path) => cached(`${DM}/${path}`, { name: `datameet/${path}` })

/** AWS Terrain Tiles (Terrarium encoding): elevation = R*256 + G + B/256 − 32768 metres. */
export const terrainTile = (z, x, y) =>
  cached(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`, { name: `terrain/${z}/${x}/${y}.png` })

/** Run async jobs with bounded concurrency. */
export async function pool(items, limit, fn) {
  const out = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++
        out[idx] = await fn(items[idx], idx)
      }
    }),
  )
  return out
}
