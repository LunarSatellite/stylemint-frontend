import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { PlatformConfigContainer } from '@/features/platform-config/PlatformConfigContainer'

export default function PlatformConfigPage() {
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold text-text-primary">Platform Config</h1>
        <PlatformConfigContainer />
      </div>
    </ErrorBoundary>
  )
}
