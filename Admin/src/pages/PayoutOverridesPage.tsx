import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { PayoutsContainer } from '@/features/payouts/PayoutsContainer'

export default function PayoutOverridesPage() {
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <div className="p-6 space-y-6">
        <h1
          className="m-0 inline-block text-[20px] font-bold leading-[1.2]"
          style={{
            background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--primary) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >Payout Overrides</h1>
        <PayoutsContainer />
      </div>
    </ErrorBoundary>
  )
}
