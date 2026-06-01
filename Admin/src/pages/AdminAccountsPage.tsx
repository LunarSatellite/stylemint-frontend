import { ErrorBoundary, PageErrorFallback } from '@/components/ErrorBoundary'
import { AdminAccountsContainer } from '@/features/admin-accounts/AdminAccountsContainer'

export default function AdminAccountsPage() {
  return (
    <ErrorBoundary fallback={<PageErrorFallback />}>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold text-text-primary">Admin Accounts</h1>
        <AdminAccountsContainer />
      </div>
    </ErrorBoundary>
  )
}
