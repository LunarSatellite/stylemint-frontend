import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { ModerationQueueContainer } from '@/features/content-moderation/ModerationQueueContainer'

export default function ModerationQueuePage() {
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold text-text-primary">Content Moderation</h1>
        <ModerationQueueContainer />
      </div>
    </ErrorBoundary>
  )
}
