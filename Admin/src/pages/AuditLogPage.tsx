import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { AuditLogContainer } from '@/features/audit-log/AuditLogContainer'

export default function AuditLogPage() {
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <div className="p-6 space-y-6">
        <h1
          className="m-0 inline-block text-[20px] font-bold leading-[1.2]"
          style={{
            background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--primary) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >Audit Log</h1>
        <AuditLogContainer />
      </div>
    </ErrorBoundary>
  )
}
