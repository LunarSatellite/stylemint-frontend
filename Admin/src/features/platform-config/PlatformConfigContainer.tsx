import { usePlatformConfig } from '@/api/queries/usePlatformConfig'
import { PlatformConfigView } from './PlatformConfigView'

export function PlatformConfigContainer() {
  const { data, isLoading, isError } = usePlatformConfig()
  if (isError) return <div className="text-red-400">Failed to load config.</div>
  return <PlatformConfigView config={data} isLoading={isLoading} />
}
