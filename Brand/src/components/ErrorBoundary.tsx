import { Component, type ErrorInfo, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface Props {
  fallback?: ReactNode
  label?:    string
  children:  ReactNode
}

interface State {
  hasError: boolean
  error:    Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', this.props.label ?? 'unnamed', error, info)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-lg border p-6',
          'border-[var(--border-subtle)] bg-[var(--surface-1)]',
        )}>
          <p className="text-sm text-[var(--text-muted)]">
            {this.props.label ? `${this.props.label} failed to load.` : 'Something went wrong.'}
          </p>
          <button
            className="text-xs text-[var(--primary)] underline"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export function PageErrorFallback({ error }: { error?: Error | null }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <p className="text-lg font-medium text-[var(--text-primary)]">Page failed to load</p>
      {error && (
        <p className="text-sm text-[var(--text-muted)]">{error.message}</p>
      )}
      <button
        className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--bg-primary)]"
        onClick={() => window.location.reload()}
      >
        Reload
      </button>
    </div>
  )
}

export function WidgetErrorFallback({ label }: { label: string }) {
  return (
    <div className={cn(
      'flex items-center justify-center rounded-lg border p-4',
      'border-[var(--border-subtle)] bg-[var(--surface-1)]',
    )}>
      <p className="text-xs text-[var(--text-muted)]">{label} unavailable</p>
    </div>
  )
}
