import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { BriefListRoot } from '@/features/brief-authoring/BriefListRoot'

export default function BriefListPage() {
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <BriefListRoot />
    </ErrorBoundary>
  )
}
