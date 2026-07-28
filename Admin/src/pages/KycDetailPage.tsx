import { useParams } from 'react-router-dom'
import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { KycDetailContainer } from '@/features/kyc-review/KycDetailContainer'

export default function KycDetailPage() {
  const { id } = useParams<{ id: string }>()
  if (!id) return null
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <div className="kyc-detail-scroll flex-1 overflow-y-auto p-6"><KycDetailContainer id={id} /></div>
    </ErrorBoundary>
  )
}
