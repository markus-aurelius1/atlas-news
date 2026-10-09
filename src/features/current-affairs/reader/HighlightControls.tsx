import { Highlighter, Palette, Check, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { HIGHLIGHT_COLORS, type HighlightColor } from '@/current-affairs/reader/highlights/model'
import { Pressable } from '@/ui/controls'
import { Popover } from '@/ui/surface/Popover'
import type { useHighlights } from './useHighlights'

const label = (color: string) => color[0].toUpperCase() + color.slice(1)
export function PaletteChoices({ color, onChoose }: { color: HighlightColor; onChoose: (color: HighlightColor) => void }) {
  return <div className="highlight-palette" role="group" aria-label="Highlight color">
    {HIGHLIGHT_COLORS.map((c) => <Pressable plain haptic="none" key={c} type="button" className="highlight-swatch" data-color={c} aria-label={label(c)} aria-pressed={color === c} onClick={() => onChoose(c)}>{color === c && <Check aria-hidden="true" />}</Pressable>)}
  </div>
}
/** Only edits excerpts for the open article. The cross-article library uses the same five-color palette. */
export function HighlightControls({ value, available }: { value: ReturnType<typeof useHighlights>; available: boolean }) {
  const anchor = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  if (!available) return null
  return <>
    <Pressable plain haptic="none" type="button" className="tool reader-tool reader-highlighter" aria-label="Highlighter" aria-pressed={value.enabled} disabled={!value.supported} title={value.supported ? 'Highlighter: select article text to highlight' : 'Highlighting requires a browser with CSS Custom Highlights'} onClick={() => value.setEnabled(!value.enabled)}>
      <Highlighter aria-hidden="true" /><span>{value.enabled ? 'On' : 'Highlight'}</span>
    </Pressable>
    <Pressable plain haptic="none" ref={anchor} type="button" className="tool reader-tool" aria-label="Highlight colors and edits" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(!open)}><Palette aria-hidden="true" /><span className="highlight-color-dot" data-color={value.color} /></Pressable>
    <span className="highlight-status" role="status" aria-live="polite">{value.message}</span>
    <Popover open={open} onClose={() => setOpen(false)} anchor={anchor} label="Highlight colors and edits" side="bottom" align="end" minWidth={300} sheet={{ title: 'Highlights in this article' }}>
      <div className="highlight-panel" data-highlight-ui>
        <p className="highlight-panel-title">Next highlight</p>
        <PaletteChoices color={value.color} onChoose={value.choose} />
        <p className="highlight-hint">{!value.supported ? 'Update your browser to show highlights.' : value.enabled ? 'Select text naturally. Touch and pen selections save after a brief pause.' : 'Turn on Highlighter, then select article text.'}</p>
        {value.message && <p className="highlight-feedback" role="status">{value.message}</p>}
        {value.records.length > 0 && <p className="highlight-panel-title">In this article · {value.records.length}</p>}
        {value.records.map((r) => <div className="highlight-edit" key={r.highlightId}>
          <p className="highlight-quote">“{r.quote}”</p>
          {r.resolution === 'unresolved' && <p className="highlight-hint">Passage changed · saved excerpt kept</p>}
          <div className="highlight-edit-actions"><PaletteChoices color={r.color} onChoose={(c) => value.edit(r.highlightId, c)} /><Pressable plain haptic="none" type="button" className="tool" aria-label={'Delete highlight: ' + r.quote.slice(0, 40)} onClick={() => value.edit(r.highlightId)}><Trash2 aria-hidden="true" /></Pressable></div>
        </div>)}
      </div>
    </Popover>
  </>
}
