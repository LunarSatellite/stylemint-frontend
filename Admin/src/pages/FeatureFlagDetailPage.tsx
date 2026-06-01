import { useParams } from 'react-router-dom'
import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { FeatureFlagDetailContainer } from '@/features/feature-flags/FeatureFlagDetailContainer'

export default function FeatureFlagDetailPage() {
  const { key } = useParams<{ key: string }>()
  if (!key) return null
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <div className="p-6"><FeatureFlagDetailContainer flagKey={key} /></div>
    </ErrorBoundary>
  )
}
