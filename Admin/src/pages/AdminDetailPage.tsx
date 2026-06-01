import { useParams } from 'react-router-dom'
import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { AdminDetailContainer } from '@/features/admin-accounts/AdminDetailContainer'

export default function AdminDetailPage() {
  const { id } = useParams<{ id: string }>()
  if (!id) return null
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <div className="p-6"><AdminDetailContainer id={id} /></div>
    </ErrorBoundary>
  )
}
