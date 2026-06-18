import { usePolicyAlerts } from '@/api/queries/usePolicyAlerts'
import { PolicyAlertsView } from './PolicyAlertsView'

export function PolicyAlertsContainer() {
  const alertsQ = usePolicyAlerts()

  if (alertsQ.isError) return (
    <div className="rounded-lg border border-red-400/20 bg-red-400/[0.08] px-4 py-4 text-red-400">
      Failed to load policy alerts.
    </div>
  )

  return (
    <PolicyAlertsView
      alerts={alertsQ.data ?? []}
      isLoading={alertsQ.isLoading}
    />
  )
}
