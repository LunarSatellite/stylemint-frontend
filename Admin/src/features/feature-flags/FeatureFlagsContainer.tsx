import { useFeatureFlags } from '@/api/queries/useFeatureFlags'
import { FeatureFlagsView } from './FeatureFlagsView'

export function FeatureFlagsContainer() {
  const { data, isLoading, isError } = useFeatureFlags()
  if (isError) return <div className="text-red-400">Failed to load feature flags.</div>
  return <FeatureFlagsView flags={data ?? []} isLoading={isLoading} />
}
