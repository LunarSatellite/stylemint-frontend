import { useParams } from 'react-router-dom'
import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { ProductDeepDive } from '@/features/analytics/ProductDeepDive'
import { asProductId } from '@/lib/brands'

export default function ProductAnalyticsPage() {
  const { productId } = useParams<{ productId: string }>()
  if (!productId) return null

  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <ProductDeepDive productId={asProductId(productId)} />
    </ErrorBoundary>
  )
}
