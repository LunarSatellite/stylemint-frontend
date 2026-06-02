import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { BriefCreateRoot } from '@/features/brief-authoring/BriefCreateRoot'

export default function BriefCreatePage() {
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <BriefCreateRoot />
    </ErrorBoundary>
  )
}
