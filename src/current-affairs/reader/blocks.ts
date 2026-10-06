/**
 * Publisher infographics written as markup: stat grids, comparison cards, titled point lists and tabbed panels
 * built from anonymous <div>s whose only structure is in their class names. Read as plain text they collapse
 * into fragments ("11,098", "km", "Length of India's coastline" as three loose lines). Before Readability reads
 * the page, each recognised shape is rewritten as the semantic element it stands for:
 *
 *   a grid of number / unit / label cells   →  <dl class="tars-stats">  label, then the figure (and a note)
 *   a list of badge / title / description   →  <ol> or <ul> of "Title. Description"
 *   an eyebrow / title / body card          →  a small heading and a paragraph that opens with the title
 *   a tab strip over panels                 →  each panel under its tab's name as a heading
 *
 * Shapes are recognised by the role a class name ends with (`…__stat-number`, `…-stat_label`), not by any one
 * publisher's prefix, and only when the whole shape is there; anything else is left exactly as it was.
 * Modelled on the Indian Express "infographic-*" blocks (see extract.test.ts).
 */

/** The class Readability is told to keep, so the sanitizer can tell a stat grid from an ordinary list of terms. */
export const STATS_CLASS = 'tars-stats'

const squash = (text: string | null | undefined) => (text ?? '').replace(/\s+/g, ' ').trim()

/** True when one of the element's classes ends with one of these role names (after `__`, `-` or `_`, or alone). */
function role(el: Element, names: string): boolean {
  const pattern = new RegExp(`(?:^|__|[-_])(?:${names})$`, 'i')
  return (el.getAttribute('class') ?? '').split(/\s+/).some((name) => pattern.test(name))
}
const child = (el: Element, names: string): Element | null => Array.from(el.children).find((c) => role(c, names)) ?? null
const within = (el: Element, names: string): Element | null => Array.from(el.querySelectorAll('[class]')).find((c) => role(c, names)) ?? null

const VALUE = 'stat-number|stat-value|stat-num|stat-figure|compare-value|kpi-value|metric-value|number|value|figure'
const UNIT = 'stat-unit|unit|suffix'
const LABEL = 'stat-label|compare-label|kpi-label|metric-label|label|caption'
const NOTE = 'compare-text|stat-text|stat-desc|stat-note|text|desc|description|note'
const CELL = 'stat-cell|stat-item|stat-card|stat-box|stat|compare-card|compare-item|kpi|metric'
const ITEM = 'icon-item|list-item|point|step|fact-item|timeline-item'
const ITEM_TITLE = 'icon-title|item-title|point-title|step-title|title|heading'
const ITEM_BODY = 'icon-desc|item-desc|point-desc|step-desc|desc|description|text|body'
const BADGE = 'icon-badge|badge|bullet|index|step-number|num'
const CARD = 'narrative-card|info-card|note-card|callout|takeaway'
const CARD_KICKER = 'eyebrow|kicker|overline'
const CARD_TITLE = 'card-title|title|heading'
const CARD_BODY = 'card-body|body|text|desc'

/** A figure is short: a number with its sign, magnitude or currency, not a sentence. */
const figure = (text: string) => text.length > 0 && text.length <= 24 && /\d/.test(text)

interface Stat { label: string; value: string; unit: string; note: string }

function stat(cell: Element): Stat | null {
  const value = squash(child(cell, VALUE)?.textContent), label = squash(child(cell, LABEL)?.textContent)
  if (!figure(value) || !label || label.length > 160) return null
  return { value, label, unit: squash(child(cell, UNIT)?.textContent).slice(0, 40), note: squash(child(cell, NOTE)?.textContent).slice(0, 400) }
}

function statList(doc: Document, stats: Stat[]): Element {
  const list = doc.createElement('dl')
  list.setAttribute('class', STATS_CLASS)
  for (const s of stats) {
    const term = doc.createElement('dt'), value = doc.createElement('dd'), number = doc.createElement('strong')
    term.textContent = s.label
    number.textContent = s.value
    value.appendChild(number)
    if (s.unit) value.appendChild(doc.createTextNode(' ' + s.unit))
    list.append(term, value)
    if (s.note) {
      const note = doc.createElement('dd')
      note.textContent = s.note
      list.appendChild(note)
    }
  }
  return list
}

/** Sibling runs of `cells` under one parent, each replaced by what `build` makes of them (or left alone). */
function replaceRuns(root: Element, names: string, build: (cells: Element[]) => Element | null) {
  const parents = new Set<Element>()
  for (const el of Array.from(root.querySelectorAll('[class]'))) if (role(el, names) && el.parentElement) parents.add(el.parentElement)
  for (const parent of parents) {
    if (!parent.isConnected) continue
    const cells = Array.from(parent.children).filter((c) => role(c, names))
    const made = build(cells)
    if (!made) continue
    parent.insertBefore(made, cells[0])
    for (const cell of cells) cell.remove()
    // A wrapper that held only the cells is the grid itself.
    if (parent.children.length === 1 && !squash(Array.from(parent.childNodes).filter((n) => n.nodeType === 3).map((n) => n.nodeValue).join(''))) parent.replaceWith(made)
  }
}

export function normaliseInfographics(doc: Document) {
  const body = doc.body
  if (!body) return

  // Tabs: every panel is shown, under the name its tab gave it. The strip of tab labels itself is not content.
  for (const strip of Array.from(body.querySelectorAll('[role="tablist"]'))) {
    const labels = Array.from(strip.querySelectorAll('[role="tab"], label, button, a')).map((tab) => squash(tab.textContent)).filter(Boolean)
    const scope = strip.parentElement
    const panels = scope ? Array.from(scope.querySelectorAll('[role="tabpanel"]')) : []
    if (!labels.length || labels.length !== panels.length || labels.some((label) => label.length > 80)) continue
    panels.forEach((panel, i) => {
      const heading = doc.createElement('h3')
      heading.textContent = labels[i]
      panel.insertBefore(heading, panel.firstChild)
    })
    strip.remove()
  }

  replaceRuns(body, CELL, (cells) => {
    const stats = cells.map(stat)
    return cells.length >= 1 && stats.every((s): s is Stat => !!s) ? statList(doc, stats) : null
  })

  replaceRuns(body, ITEM, (items) => {
    const points = items.map((item) => {
      const title = squash(within(item, ITEM_TITLE)?.textContent), text = squash(within(item, ITEM_BODY)?.textContent)
      return title && text && title !== text && title.length <= 120 ? { title, text, badge: squash(within(item, BADGE)?.textContent) } : null
    })
    if (items.length < 2 || points.some((p) => !p)) return null
    const numbered = points.every((p, i) => p!.badge === String(i + 1))
    const list = doc.createElement(numbered ? 'ol' : 'ul')
    for (const point of points) {
      const li = doc.createElement('li'), title = doc.createElement('strong')
      title.textContent = /[.!?:]$/.test(point!.title) ? point!.title : point!.title + '.'
      li.append(title, doc.createTextNode(' ' + point!.text))
      list.appendChild(li)
    }
    return list
  })

  for (const card of Array.from(body.querySelectorAll('[class]')).filter((el) => role(el, CARD))) {
    if (!card.isConnected) continue
    const kicker = child(card, CARD_KICKER), title = child(card, CARD_TITLE), text = child(card, CARD_BODY)
    const heading = squash(title?.textContent), copy = squash(text?.textContent)
    if (!heading || !copy || heading.length > 140 || card.children.length !== [kicker, title, text].filter(Boolean).length) continue
    const made: Element[] = []
    if (kicker && squash(kicker.textContent)) {
      const small = doc.createElement('h4')
      small.textContent = squash(kicker.textContent)
      made.push(small)
    }
    const p = doc.createElement('p'), lead = doc.createElement('strong')
    lead.textContent = /[.!?:]$/.test(heading) ? heading : heading + '.'
    p.append(lead, doc.createTextNode(' ' + copy))
    made.push(p)
    card.replaceWith(...made)
  }

  // Keyword chips under an infographic are navigation, not text.
  for (const tags of Array.from(body.querySelectorAll('[class]')).filter((el) => role(el, 'tags|tags-list|tag-list|chips'))) if (tags.isConnected && squash(tags.textContent).length < 300) tags.remove()
}
