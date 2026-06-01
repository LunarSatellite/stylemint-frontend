import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { FeatureFlagsContainer } from '@/features/feature-flags/FeatureFlagsContainer'

export default function FeatureFlagsPage() {
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold text-text-primary">Feature Flags</h1>
        <FeatureFlagsContainer />
      </div>
    </ErrorBoundary>
  )
}
