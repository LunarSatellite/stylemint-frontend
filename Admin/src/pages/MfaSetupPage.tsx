import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { MfaEnrollFlow } from '@/features/mfa-setup/MfaEnrollFlow'

export default function MfaSetupPage() {
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <div className="flex items-center justify-center min-h-screen bg-bg-primary p-6">
        <MfaEnrollFlow />
      </div>
    </ErrorBoundary>
  )
}
