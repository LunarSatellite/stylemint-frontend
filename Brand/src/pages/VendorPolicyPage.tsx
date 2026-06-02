import { useParams } from 'react-router-dom'
import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { VendorPolicyEditor } from '@/features/admin/VendorPolicyEditor'
import { asVendorId } from '@/lib/brands'

export default function VendorPolicyPage() {
  const { vendorId } = useParams<{ vendorId: string }>()
  if (!vendorId) return null

  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <VendorPolicyEditor vendorProfileId={asVendorId(vendorId)} />
    </ErrorBoundary>
  )
}
