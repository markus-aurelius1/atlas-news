/** Map access is universal; historical discovered data describes travel only. */
import type { SourceRef } from './types'
export const geographicSources = (sources: SourceRef[] = []) => [...new Map(sources.filter((s) => /^https?:/.test(s.url) && !/\.pdf(?:[?#]|$)|publisher|workbook|question papers|\bpp\./i.test(`${s.url} ${s.title}`)).map((s) => [s.url, { title: s.title, url: s.url }])).values()]
