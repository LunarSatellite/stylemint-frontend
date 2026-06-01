import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { IssueRefundContainer } from '@/features/payouts/IssueRefundContainer'

export default function IssueRefundPage() {
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold text-text-primary">Issue Refund</h1>
        <IssueRefundContainer />
      </div>
    </ErrorBoundary>
  )
}
