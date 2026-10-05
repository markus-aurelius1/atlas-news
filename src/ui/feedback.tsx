import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, Sparkles, TriangleAlert, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import { cn } from '@/lib/cn'
import { Button, IconButton } from './controls'
import { T } from './motion'
import { Sheet, SheetActions } from './Sheet'
import { holdToast, releaseToast, useToasts, type Toast } from './toast'
import { useMediaQuery } from './useMedia'

/**
 * Above mobile navigation with the zoom controls left clear, below the product
 * bar on wider screens. A toast waits while the pointer or focus is on it,
 * and can be swept away sideways.
 */
export function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  const compact = !useMediaQuery('(min-width: 768px)')
  // In a portal on <body>: a modal surface makes the app root inert, and an Undo must stay pressable above it.
  return createPortal(
    <div
      className={cn(
        'layer-toast pointer-events-none fixed inset-x-0 flex items-center gap-2 px-4',
        compact ? 'bottom-[calc(var(--nav-bottom)+12px)] flex-col-reverse pl-16' : 'top-[calc(var(--shell-top)+12px)] flex-col',
      )}
      aria-live="polite"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} from={compact ? 1 : -1} />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  )
}

function ToastCard({ toast: t, from }: { toast: Toast; from: 1 | -1 }) {
  const dismiss = () => useToasts.getState().dismiss(t.id)
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16 * from, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10 * from, scale: 0.97, transition: T.exit }}
      transition={T.item}
      // Swept far or fast enough sideways, it goes; otherwise it springs back.
      drag="x"
      dragSnapToOrigin
      dragElastic={0.6}
      dragConstraints={{ left: 0, right: 0 }}
      onDragStart={() => holdToast(t.id)}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 600) dismiss()
        else releaseToast(t.id)
      }}
      onPointerEnter={() => holdToast(t.id)}
      onPointerLeave={() => releaseToast(t.id)}
      onFocus={() => holdToast(t.id)}
      onBlur={() => releaseToast(t.id)}
      className="elev-3 pointer-events-auto flex w-full max-w-sm touch-pan-y items-center gap-3 rounded-card bg-surface py-2.5 pr-2 pl-4"
      role="status"
    >
      <span className={cn('shrink-0', t.tone === 'success' && 'text-success', t.tone === 'warning' && 'text-danger', t.tone === 'celebrate' && 'text-accent', t.tone === 'default' && 'text-ink-2')}>
        {t.tone === 'warning' ? <TriangleAlert className="size-5" /> : t.tone === 'celebrate' ? <Sparkles className="size-5" /> : <CheckCircle2 className="size-5" />}
      </span>
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-sm font-bold">{t.title}</p>
        {t.body && <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{t.body}</p>}
      </div>
      {t.action && (
        <Button
          size="sm"
          variant="ghost"
          className="shrink-0 text-accent"
          onClick={() => {
            t.action!.run()
            dismiss()
          }}
        >
          {t.action.label}
        </Button>
      )}
      <IconButton size="sm" tip="none" label="Dismiss" className="shrink-0" onClick={dismiss}>
        <X />
      </IconButton>
    </motion.div>
  )
}

// ───────────────────────── confirm ─────────────────────────

interface ConfirmRequest {
  title: string
  body?: ReactNode
  confirmLabel?: string
  danger?: boolean
  resolve: (ok: boolean) => void
}

const useConfirmStore = create<{ req: ConfirmRequest | null }>(() => ({ req: null }))

export function confirmDialog(opts: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
  return new Promise((resolve) => useConfirmStore.setState({ req: { ...opts, resolve } }))
}

export function ConfirmHost() {
  const req = useConfirmStore((s) => s.req)
  const close = (ok: boolean) => {
    req?.resolve(ok)
    useConfirmStore.setState({ req: null })
  }
  return (
    <Sheet
      open={!!req}
      onClose={() => close(false)}
      title={req?.title}
      size="sm"
      footer={
        <SheetActions>
          <Button onClick={() => close(false)}>Cancel</Button>
          <Button variant={req?.danger ? 'danger' : 'primary'} onClick={() => close(true)} data-autofocus>
            {req?.confirmLabel ?? 'Confirm'}
          </Button>
        </SheetActions>
      }
    >
      {req?.body && <div className="text-[15px] leading-relaxed text-ink-2">{req.body}</div>}
    </Sheet>
  )
}

export function EmptyState({ icon, title, body, action, className }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      {icon && <div className="mb-3.5 flex size-11 items-center justify-center rounded-xl bg-surface-2 text-ink-3 [&>svg]:size-5">{icon}</div>}
      <p className="t-heading">{title}</p>
      {body && <p className="mt-1 max-w-xs text-[13.5px] leading-relaxed text-ink-2">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
