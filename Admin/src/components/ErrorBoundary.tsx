import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  fallback: ReactNode
  children: ReactNode
}

interface State {
  hasError: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

export function PageErrorFallback() {
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-4 text-text-muted">
      <p className="text-lg">Something went wrong loading this page.</p>
      <button onClick={() => window.location.reload()} className="text-primary underline text-sm">
        Reload
      </button>
    </div>
  )
}

export function WidgetErrorFallback({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-32 rounded-lg bg-bg-card border border-[var(--surface-border)]">
      <p className="text-text-muted text-sm">{label} failed to load.</p>
    </div>
  )
}
