/**
 * Catches a render error in its children so one broken screen or dialog never
 * blanks the app. The shell sits outside the
 * route boundary; dialogs carry their own, so the screen beneath stays intact.
 *
 * A boundary clears itself when `resetKey` changes (a new route), or when the
 * fallback calls `retry`.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'
import { LogoMark } from './Logo'
import { Button } from './controls'
import { isChunkError } from '@/lib/lazy'

export interface ErrorBoundaryProps {
  /** Shown in place of the children. `retry` mounts them again. */
  fallback: (error: Error, retry: () => void) => ReactNode
  onError?: (error: Error, info: ErrorInfo) => void
  /** A caught error is forgotten when this changes. */
  resetKey?: unknown
  children: ReactNode
}

interface State {
  error: Error | null
  resetKey: unknown
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, State> {
  state: State = { error: null, resetKey: this.props.resetKey }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }

  static getDerivedStateFromProps(props: ErrorBoundaryProps, state: State): Partial<State> | null {
    return props.resetKey === state.resetKey ? null : { error: null, resetKey: props.resetKey }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[error boundary]', error, info.componentStack)
    this.props.onError?.(error, info)
  }

  retry = () => this.setState({ error: null })

  render() {
    return this.state.error ? this.props.fallback(this.state.error, this.retry) : this.props.children
  }
}

const reload = () => location.reload()

/** Inside the stage: the screen failed, everything around it still works. */
export function ScreenError({ error, retry }: { error: Error; retry: () => void }) {
  const chunk = isChunkError(error)
  return (
    <div className="pt-safe mx-auto flex min-h-[60dvh] w-full max-w-md flex-col items-center justify-center px-6 py-12 text-center" role="alert">
      <p className="t-title">{chunk ? 'This screen couldn’t load' : 'This screen ran into a problem'}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">
        {chunk ? 'Tars may have been updated, or the connection dropped. Your data is safe on this device.' : 'Your data is safe on this device.'}
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {!chunk && <Button onClick={retry}>Try again</Button>}
        <Button variant="primary" onClick={reload}>
          Reload Tars
        </Button>
      </div>
    </div>
  )
}

/** The last resort, around the whole app. */
export function AppError() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-8 text-center" role="alert">
      <LogoMark className="size-10 text-accent" />
      <p className="font-display text-xl">Tars ran into a problem.</p>
      <p className="max-w-sm text-sm text-ink-2">Your Atlas progress and reading state are saved on this device. Reload to carry on.</p>
      <Button variant="primary" className="mt-2" onClick={reload}>
        Reload Tars
      </Button>
    </div>
  )
}
