import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { MfaStatusContainer } from '@/features/mfa-setup/MfaStatusContainer'

export default function MfaSetupPage() {
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <div className="flex items-center justify-center min-h-screen bg-bg-primary p-6">
        <MfaStatusContainer />
      </div>
    </ErrorBoundary>
  )
}
