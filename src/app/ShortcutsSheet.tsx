import { Sheet } from '@/ui/Sheet'
import { SHORTCUTS } from './shortcuts'
import { useUi } from './ui-store'

/** The keyboard shortcuts reference (press ?). */
export function ShortcutsSheet() {
  const open = useUi((s) => s.shortcutsOpen)
  const close = () => useUi.getState().set({ shortcutsOpen: false })
  return (
    <Sheet open={open} onClose={close} title="Keyboard shortcuts" subtitle="Single keys work whenever you aren’t typing." size="lg">
      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
        {SHORTCUTS.map((group) => (
          <section key={group.title}>
            <h3 className="mb-2 t-label">{group.title}</h3>
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {group.items.map((item) => (
                <li key={item.label} className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-[14px]">
                  <span className="min-w-0 text-ink">{item.label}</span>
                  <span className="flex shrink-0 items-center gap-1" aria-label={item.keys.join(item.join === 'or' ? ' or ' : ' then ')}>
                    {item.keys.map((k) => (
                      <kbd key={k} className="kbd">
                        {k.trim()}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Sheet>
  )
}
