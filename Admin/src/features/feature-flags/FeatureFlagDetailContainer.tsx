import { useFeatureFlag } from '@/api/queries/useFeatureFlags'
import { useFeatureFlagUpsert } from '@/api/mutations/useFeatureFlagUpsert'
import { showErrorToast } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function FeatureFlagDetailContainer({ flagKey }: { flagKey: string }) {
  const { data, isLoading } = useFeatureFlag(flagKey)
  const upsert = useFeatureFlagUpsert({ onSuccess: () => toast.success('Flag updated'), onError: showErrorToast })
  if (isLoading) return <div className="text-text-muted">Loading…</div>
  if (!data) return null
  return (
    <div className="bg-bg-card border border-[var(--surface-border)] rounded-lg p-6 space-y-4 max-w-lg">
      <h2 className="text-text-primary font-mono font-medium">{flagKey}</h2>
      <div className="flex gap-3">
        <Button className="bg-primary hover:bg-primary-dark text-bg-primary" onClick={() => upsert.mutate({ key: flagKey, defaultEnabled: true })} disabled={upsert.isPending}>Enable</Button>
        <Button variant="outline" onClick={() => upsert.mutate({ key: flagKey, defaultEnabled: false })} disabled={upsert.isPending}>Disable</Button>
      </div>
    </div>
  )
}
