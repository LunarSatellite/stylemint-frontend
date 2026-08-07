import { Suspense } from 'react'
import { FileText, Loader2 } from 'lucide-react'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { PolicyAlertsContainer } from '@/features/policy-alerts/PolicyAlertsContainer'

export default function PoliciesPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.04] border border-white/[0.07]">
          <FileText className="h-4 w-4 text-text-muted" />
        </div>
        <div>
          <h1
            className="m-0 inline-block text-[20px] font-bold leading-[1.2]"
            style={{
              background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--primary) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >Policy Alerts</h1>
          <p className="text-[13px] text-text-muted">Platform-level policy change alerts from external channels</p>
        </div>
      </div>

      <ErrorBoundary fallback={
        <div className="rounded-lg border border-red-400/20 bg-red-400/[0.08] px-4 py-4 text-red-400">
          Failed to load policy alerts.
        </div>
      }>
        <Suspense fallback={
          <div className="flex items-center justify-center py-16 text-text-muted">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        }>
          <PolicyAlertsContainer />
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
