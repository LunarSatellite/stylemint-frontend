import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { KycQueueContainer } from '@/features/kyc-review/KycQueueContainer'

export default function KycQueuePage() {
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold text-text-primary">KYC Review</h1>
        <KycQueueContainer />
      </div>
    </ErrorBoundary>
  )
}
