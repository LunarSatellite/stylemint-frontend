import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { PayoutsContainer } from '@/features/payouts/PayoutsContainer'

export default function PayoutOverridesPage() {
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold text-text-primary">Payout Overrides</h1>
        <PayoutsContainer />
      </div>
    </ErrorBoundary>
  )
}
