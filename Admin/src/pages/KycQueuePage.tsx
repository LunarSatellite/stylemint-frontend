import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { KycQueueContainer } from '@/features/kyc-review/KycQueueContainer'

export default function KycQueuePage() {
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center gap-3">
          <div>
            <h1
              className="m-0 inline-block text-[20px] font-bold leading-[1.2]"
              style={{
                background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--primary) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >KYC Review</h1>
            <p className="mt-[3px] text-[13px] text-text-muted">
              Review and decide on creator and vendor identity applications.
            </p>
          </div>
        </div>
        <KycQueueContainer />
      </div>
    </ErrorBoundary>
  )
}
