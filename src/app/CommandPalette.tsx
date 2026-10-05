/** Atlas place search and validated Atlas, News and shared settings commands. */
import { AnimatePresence, motion } from 'motion/react'
import { CornerDownLeft, Search } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'
import { haptics } from '@/services/haptics'
import { DUR, EASE_IN, T } from '@/ui/motion'
import { lockScroll } from '@/ui/scrollLock'
import { isTopLayer, pushLayer, trapTab } from '@/ui/Sheet'
import { useIsWide } from '@/ui/useMedia'
import { rememberCommand, useCommands, type Command } from '@/tars/commands'
import { useUi } from './ui-store'

const close = () => useUi.getState().set({ paletteOpen: false })

export function CommandPalette() {
  const open = useUi((s) => s.paletteOpen)
  return createPortal(<AnimatePresence>{open && <Palette key="palette" />}</AnimatePresence>, document.body)
}

function Palette() {
  const wide = useIsWide()
  const id = useId()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const commands = useCommands(query)

  useEffect(() => {
    const unlock = lockScroll()
    const pop = pushLayer(id)
    const prevFocus = document.activeElement as HTMLElement | null
    input.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (!isTopLayer(id)) return
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close()
      } else if (e.key === 'Tab') trapTab(e, panel.current)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      unlock()
      pop()
      window.removeEventListener('keydown', onKey)
      prevFocus?.focus?.({ preventScroll: true })
    }
  }, [id])

  const needsChoice = commands[0]?.requiresChoice ?? false
  useEffect(() => setActive(needsChoice ? -1 : 0), [query, needsChoice])
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const run = async (c: Command | undefined) => {
    if (!c) return
    haptics.tap()
    rememberCommand(c.id)
    close()
    await c.run()
  }

  let lastSection = ''
  return (
    <div className="fixed inset-0 z-[55] flex items-start justify-center px-3 pt-[max(12px,env(safe-area-inset-top))] sm:px-6 sm:pt-[12vh]" role="presentation">
      <motion.div
        className="absolute inset-0 bg-black/40 dark:bg-black/55"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: T.base }}
        exit={{ opacity: 0, transition: { duration: DUR.micro, ease: EASE_IN } }}
        onClick={close}
      />
      <motion.div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Search and commands"
        className="relative flex max-h-[min(72dvh,560px)] w-full max-w-[38rem] flex-col overflow-hidden rounded-[18px] bg-surface shadow-[0_0_0_1px_var(--line-strong),var(--shadow-dialog-value)]"
        initial={{ opacity: 0, scale: 0.97, y: wide ? -8 : -16 }}
        animate={{ opacity: 1, scale: 1, y: 0, transition: T.base }}
        exit={{ opacity: 0, scale: 0.98, y: -6, transition: T.exit }}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-4">
          <Search className="size-[18px] shrink-0 text-ink-3" />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((a) => Math.min(commands.length - 1, a + 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((a) => Math.max(0, a - 1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                void run(commands[active])
              }
            }}
            placeholder="Search places or run a command…"
            className="h-[3.25rem] min-w-0 flex-1 bg-transparent text-[16px] font-medium outline-none placeholder:font-normal placeholder:text-ink-3"
            role="combobox"
            aria-label="Search and commands"
            aria-expanded="true"
            aria-controls={`${id}-list`}
            aria-activedescendant={commands[active] ? `${id}-${active}` : undefined}
            aria-autocomplete="list"
            enterKeyHint="go"
          />
          <kbd className="kbd hidden sm:inline-flex">Esc</kbd>
        </div>
        <div ref={list} id={`${id}-list`} role="listbox" aria-label="Commands" className="scrollbar-thin min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-2">
          {commands.length === 0 && <p className="px-3 py-8 text-center text-sm text-ink-2">Nothing matches “{query}”.</p>}
          {commands.map((c, i) => {
            const header = c.section !== lastSection
            lastSection = c.section
            const Icon = c.icon
            return (
              <div key={c.id}>
                {header && <p className="t-label px-3 pt-3 pb-1 text-[12px] text-ink-3">{c.section}</p>}
                <div
                  id={`${id}-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={i === active}
                  onPointerMove={() => i !== active && setActive(i)}
                  onClick={() => void run(c)}
                  className={cn('flex cursor-pointer items-center gap-3 rounded-[10px] px-3 py-2 transition-colors duration-100', i === active ? 'bg-surface-2' : 'hover:bg-surface-2/60')}
                >
                  <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors duration-100', i === active ? 'text-accent' : 'text-ink-3')}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{c.label}</span>
                    {c.hint && <span className="block truncate text-[12.5px] text-ink-3">{c.hint}</span>}
                  </span>
                  {c.keys && <kbd className="kbd shrink-0">{c.keys}</kbd>}
                  {i === active && !c.keys && <CornerDownLeft className="size-4 shrink-0 text-ink-3" />}
                </div>
              </div>
            )
          })}
        </div>
        <div className="hidden shrink-0 items-center gap-4 border-t border-line px-4 py-2.5 text-[12px] font-semibold text-ink-3 sm:flex">
          <span className="flex items-center gap-1.5">
            <kbd className="kbd">↑</kbd>
            <kbd className="kbd">↓</kbd> to move
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="kbd">↵</kbd> to run
          </span>
          <span className="ml-auto">
            Tip: <b className="text-ink-2">Essay draft fri 5pm @History #exam</b>
          </span>
        </div>
      </motion.div>
    </div>
  )
}
