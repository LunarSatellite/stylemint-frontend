import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { MySessionsContainer } from '@/features/admin-accounts/MySessionsContainer'

export default function MySessionsPage() {
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold text-text-primary">My Sessions</h1>
        <MySessionsContainer />
      </div>
    </ErrorBoundary>
  )
}
