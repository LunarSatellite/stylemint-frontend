import { useParams } from 'react-router-dom'
import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { ModerationDetailContainer } from '@/features/content-moderation/ModerationDetailContainer'

export default function ModerationDetailPage() {
  const { id } = useParams<{ id: string }>()
  if (!id) return null
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <div className="p-6"><ModerationDetailContainer id={id} /></div>
    </ErrorBoundary>
  )
}
