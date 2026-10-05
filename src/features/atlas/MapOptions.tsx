/** Map layers: the plate, what is drawn over it, and the legend – one small popover. */
import { AnimatePresence, motion } from 'motion/react'
import { Check, Info, Lock } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useScreenActive } from '@/app/screenActive'
import { updateSettings } from '@/data/hooks'
import type { AtlasLayers } from '@/data/types'
import { MAP_STYLES, RANKS } from '@/game/progression'
import { Toggle } from '@/ui/controls'
import { useSurface } from '@/ui/surface/core'

interface TriggerProps {
  onClick: () => void
  'aria-expanded': boolean
  'aria-haspopup': 'dialog'
}

export function MapOptions({ current, rankIndex, layers, onLayers, hotspots, onHotspots, onLegend, trigger }: {
  current: string
  rankIndex: number
  layers: AtlasLayers
  onLayers: (patch: Partial<AtlasLayers>) => void
  hotspots: boolean
  onHotspots: (on: boolean) => void
  onLegend: () => void
  trigger: (props: TriggerProps) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const id = useId()
  useSurface({ open, onClose: () => setOpen(false), id, panel, anchor: box, modal: false, focusOnOpen: true, history: false, dismissOnOutsidePress: true })
  const active = useScreenActive()
  useEffect(() => {
    if (!active) setOpen(false)
  }, [active])
  return (
    <div className="map-options" ref={box}>
      {trigger({ onClick: () => setOpen((o) => !o), 'aria-expanded': open, 'aria-haspopup': 'dialog' })}
      <AnimatePresence>
        {open && (
          <motion.div ref={panel} role="dialog" aria-label="Map layers" tabIndex={-1} className="map-options-panel scrollbar-thin" initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.13, ease: [0.2, 0.8, 0.2, 1] }}>
            <p className="eyebrow">Plate</p>
            <div className="map-styles" role="radiogroup" aria-label="Map style">
              {MAP_STYLES.map((s) => {
                const locked = s.minRank > rankIndex
                return (
                  <button key={s.id} type="button" role="radio" aria-checked={current === s.id} disabled={locked} data-style={s.id} className="map-style" title={locked ? `Unlocks at ${RANKS[s.minRank].title}` : s.description} onClick={() => void updateSettings({ atlasStyle: s.id })}>
                    <span className="map-style-swatch" aria-hidden="true">
                      {locked ? <Lock /> : current === s.id && <Check />}
                    </span>
                    <span className="map-style-name">{s.name}</span>
                    {locked && <span className="map-style-lock">{RANKS[s.minRank].title}</span>}
                  </button>
                )
              })}
            </div>
            <p className="eyebrow mt-4">Overlays</p>
            <label className="map-option">
              <span>
                <b>Protected &amp; disputed areas</b>
                <small>Park outlines appear as you zoom in</small>
              </span>
              <Toggle checked={layers.areas} onChange={(v) => onLayers({ areas: v })} label="Protected areas and disputed regions" />
            </label>
            <label className="map-option">
              <span>
                <b>PYQ hotspots</b>
                <small>Ring the places past papers ask about</small>
              </span>
              <Toggle checked={hotspots} onChange={onHotspots} label="PYQ hotspots" />
            </label>
            <button type="button" className="map-option map-option-link" onClick={() => { setOpen(false); onLegend() }}>
              <Info aria-hidden="true" />
              Legend &amp; sources
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
