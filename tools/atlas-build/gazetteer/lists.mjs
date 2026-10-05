/**
 * Reads official-list articles on Wikipedia (each cites the list's owner:
 * Ramsar RSIS, NTCA, MoEFCC/UNESCO MAB) into candidate files, one row per
 * designated site with the article it links to.
 *
 *   node gazetteer/lists.mjs
 *
 * Writes content/candidates/lists/*.json. Re-run to pick up new designations.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { wikiUrl, wpParseHtml } from '../lib/wiki.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = join(here, '../content/candidates/lists')
mkdirSync(OUT, { recursive: true })

const decode = (s) =>
  s
    .replace(/&#160;|&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
const text = (html) =>
  decode(
    html
      .replace(/<style[\s\S]*?<\/style>/g, '')
      .replace(/<sup[\s\S]*?<\/sup>/g, '')
      .replace(/<span class="geo[\s\S]*?<\/span>/g, '')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim()

/** Rows of every wikitable as arrays of { html, text, link } cells (rowspans filled in). */
function tables(html) {
  return [...html.matchAll(/<table class="wikitable[^"]*"[\s\S]*?<\/table>/g)].map((m) => {
    const rows = []
    const carry = [] // column → { cell, left }
    for (const r of m[0].matchAll(/<tr[\s\S]*?<\/tr>/g)) {
      const cells = [...r[0].matchAll(/<(td|th)([^>]*)>([\s\S]*?)<\/\1>/g)].map((c) => {
        const link = /<a href="\/wiki\/([^"#?]+)"[^>]*title="([^"]+)"/.exec(c[3].replace(/<sup[\s\S]*?<\/sup>/g, ''))
        const rowspan = Number(/rowspan="(\d+)"/.exec(c[2])?.[1] ?? 1)
        return { tag: c[1], html: c[3], text: text(c[3]), link: link ? decode(link[2]) : null, rowspan }
      })
      const row = []
      let ci = 0
      for (let col = 0; ci < cells.length || carry[col]; col++) {
        if (carry[col]?.left > 0) {
          row.push(carry[col].cell)
          carry[col].left--
          continue
        }
        const c = cells[ci++]
        if (!c) break
        row.push(c)
        if (c.rowspan > 1) carry[col] = { cell: c, left: c.rowspan - 1 }
      }
      rows.push(row)
    }
    return rows
  })
}

const coordOf = (html) => {
  const m = /<span class="geo">\s*(-?[\d.]+)\s*;\s*(-?[\d.]+)\s*<\/span>/.exec(html)
  return m ? [Number(m[1]), Number(m[2])] : null
}

async function ramsar() {
  const title = 'List of Ramsar sites in India'
  const html = await wpParseHtml(title)
  const [, sites] = tables(html)
  const out = []
  for (const row of sites.slice(1)) {
    const [, name, where, date, area] = row
    if (!name?.text) continue
    out.push({ title: name.link, name: name.text, state: where?.text, designated: date?.text, areaKm2: Number(String(area?.text).replace(/,/g, '')) || undefined })
  }
  return { list: title, url: wikiUrl(title), owner: 'Ramsar Sites Information Service (rsis.ramsar.org)', items: out }
}

async function tigerReserves() {
  const title = 'List of tiger reserves in India'
  const html = await wpParseHtml(title)
  const [t] = tables(html)
  const out = []
  for (const row of t.slice(2)) {
    const [name, inclusion, , state, loc] = row
    if (!name?.text) continue
    out.push({ title: name.link, name: name.text, state: state?.text, since: inclusion?.text, coord: loc ? coordOf(loc.html) : null })
  }
  return { list: title, url: wikiUrl(title), owner: 'National Tiger Conservation Authority (ntca.gov.in)', items: out }
}

async function nationalParks() {
  const title = 'List of national parks of India'
  const html = await wpParseHtml(title)
  const all = tables(html)
  const out = []
  for (const t of all.slice(1)) {
    const head = t[0]?.map((c) => c.text.toLowerCase()) ?? []
    const nameCol = head.findIndex((h) => h.startsWith('name'))
    if (nameCol < 0) continue
    const locCol = head.findIndex((h) => h.startsWith('location'))
    const formedCol = head.findIndex((h) => h.startsWith('formed') || h.startsWith('established'))
    for (const row of t.slice(1)) {
      const c = row[nameCol]
      if (!c?.link) continue
      out.push({ title: c.link, name: c.text, where: row[locCol]?.text, formed: row[formedCol]?.text })
    }
  }
  return { list: title, url: wikiUrl(title), owner: 'Ministry of Environment, Forest and Climate Change / Wildlife Institute of India (ENVIS)', items: out }
}

async function biosphere() {
  const title = 'Biosphere reserves of India'
  const html = await wpParseHtml(title)
  const [unesco, all] = tables(html)
  const mab = new Map(unesco.slice(1).flatMap((r) => [[r[1]?.text, r[3]?.text], [r[1]?.link, r[3]?.text]]))
  const out = []
  for (const row of all.slice(1)) {
    const [name, fauna] = row
    if (!name?.text) continue
    out.push({ title: name.link, name: name.text, unesco: mab.get(name.link) ?? mab.get(name.text), fauna: fauna?.text })
  }
  return { list: title, url: wikiUrl(title), owner: 'MoEFCC; UNESCO Man and the Biosphere Programme', items: out }
}

for (const [file, fn] of [
  ['india-ramsar', ramsar],
  ['india-tiger-reserves', tigerReserves],
  ['india-national-parks', nationalParks],
  ['india-biosphere-reserves', biosphere],
]) {
  const data = await fn()
  writeFileSync(join(OUT, `${file}.json`), JSON.stringify(data, null, 1))
  console.log(`${file}: ${data.items.length}`)
}

// ── World: national capitals (Natural Earth populated places, sovereign states) ──
{
  const { naturalEarth } = await import('../lib/fetch.mjs')
  const fc = await naturalEarth('ne_10m_populated_places')
  const items = fc.features
    .map((f) => f.properties)
    .filter((p) => /^Admin-0 capital/.test(p.FEATURECLA) && p.ADM0_A3 === p.SOV_A3)
    .map((p) => ({ name: p.NAME, qid: p.WIKIDATAID || null, iso: p.ADM0_A3, alt: p.FEATURECLA.endsWith('alt') || undefined, lat: p.LATITUDE, lon: p.LONGITUDE }))
  const data = { list: 'Natural Earth 1:10m populated places (Admin-0 capitals)', url: 'https://www.naturalearthdata.com/downloads/10m-cultural-vectors/10m-populated-places/', owner: 'Natural Earth (public domain)', items }
  writeFileSync(join(OUT, 'world-capitals.json'), JSON.stringify(data, null, 1))
  console.log(`world-capitals: ${items.length}`)
}
