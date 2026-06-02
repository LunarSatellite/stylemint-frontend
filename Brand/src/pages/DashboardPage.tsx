import { ErrorBoundary, WidgetErrorFallback } from '@/components/ErrorBoundary'
import { DashboardRoot } from '@/features/dashboard/DashboardRoot'

export default function DashboardPage() {
  return (
    <ErrorBoundary fallback={<WidgetErrorFallback label="Dashboard" />}>
      <DashboardRoot />
    </ErrorBoundary>
  )
}
