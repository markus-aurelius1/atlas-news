/** Exact bundled Manrope faces for worker placement; no new media or network sources. */
import { fontSources } from './fontSources'
export const workerFonts = Promise.all(
  fontSources.map(async ([source, unicodeRange]) => {
    const font = new FontFace('Manrope', source, { weight: '200 800', unicodeRange })
    await font.load()
    const scope = self as unknown as { fonts: FontFaceSet }
    scope.fonts.add(font)
  }),
)
