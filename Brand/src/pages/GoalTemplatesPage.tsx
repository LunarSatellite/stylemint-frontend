import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { GoalTemplateManager } from '@/features/admin/GoalTemplateManager'

export default function GoalTemplatesPage() {
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <GoalTemplateManager />
    </ErrorBoundary>
  )
}
