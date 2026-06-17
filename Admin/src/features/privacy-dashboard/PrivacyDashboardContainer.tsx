import { usePrivacyDashboard } from '@/api/queries/usePrivacyDashboard'
import { PrivacyDashboardView } from './PrivacyDashboardView'

export function PrivacyDashboardContainer() {
  const { data, isLoading, isError } = usePrivacyDashboard()

  if (isError) return (
    <div className="rounded-lg border border-red-400/20 bg-red-400/[0.08] px-4 py-4 text-red-400">
      Failed to load privacy dashboard.
    </div>
  )

  return <PrivacyDashboardView data={data} isLoading={isLoading} />
}
