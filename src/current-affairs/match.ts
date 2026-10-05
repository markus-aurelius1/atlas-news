/** Token phrase matching shared by the index builder and the runtime validator, so PYQ counts and news matches agree. */
export interface Token { raw: string; low: string }
/** Accents fold to their base letter; every other non-alphanumeric character separates tokens. */
export const tokenize = (text: string): Token[] => text.normalize('NFKD').replace(/[̀-ͯ]/g, '').split(/[^A-Za-z0-9]+/).filter(Boolean).map(raw => ({ raw, low: raw.toLowerCase() }))
export interface PhraseHit<T> { value: T; start: number; length: number }
interface Entry<T> { words: string[]; exact: boolean; value: T }
/** A leading ^ marks a spelling that must match case-sensitively (short acronyms that are also ordinary words). */
export const parseTerm = (term: string) => term.startsWith('^') ? { text: term.slice(1), exact: true } : { text: term, exact: false }
const plural = (word: string) => word.length < 4 || /\d/.test(word) ? [] : word.endsWith('ss') ? [] : word.endsWith('s') ? word.length > 4 ? [word.slice(0, -1)] : [] : word.endsWith('y') ? [word + 's', word.slice(0, -1) + 'ies'] : [word + 's']
export class PhraseMatcher<T> {
  private readonly byFirst = new Map<string, Entry<T>[]>()
  private readonly seen = new Set<string>()
  /** Case-insensitive spellings also match their simple singular or plural form. */
  add(term: string, value: T, id: string): void {
    const { text, exact } = parseTerm(term), tokens = tokenize(text)
    if (!tokens.length) return
    const forms = [exact ? tokens.map(t => t.raw) : tokens.map(t => t.low)]
    if (!exact) for (const last of plural(forms[0][forms[0].length - 1])) forms.push([...forms[0].slice(0, -1), last])
    for (const words of forms) {
      const key = `${id}\u0000${exact ? 'x' : ''}${words.join(' ')}`
      if (this.seen.has(key)) continue
      this.seen.add(key)
      const first = words[0].toLowerCase(), list = this.byFirst.get(first)
      if (list) list.push({ words, exact, value }); else this.byFirst.set(first, [{ words, exact, value }])
    }
  }
  scan(tokens: Token[]): PhraseHit<T>[] {
    const hits: PhraseHit<T>[] = []
    for (let i = 0; i < tokens.length; i++) {
      const candidates = this.byFirst.get(tokens[i].low)
      if (!candidates) continue
      for (const entry of candidates) {
        const n = entry.words.length
        if (i + n > tokens.length) continue
        let ok = true
        for (let k = 0; k < n && ok; k++) ok = entry.exact ? tokens[i + k].raw === entry.words[k] : tokens[i + k].low === entry.words[k]
        if (ok) hits.push({ value: entry.value, start: i, length: n })
      }
    }
    return hits
  }
}
