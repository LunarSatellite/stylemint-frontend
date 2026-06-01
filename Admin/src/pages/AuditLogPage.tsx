import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { AuditLogContainer } from '@/features/audit-log/AuditLogContainer'

export default function AuditLogPage() {
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold text-text-primary">Audit Log</h1>
        <AuditLogContainer />
      </div>
    </ErrorBoundary>
  )
}
