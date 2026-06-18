import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { components } from '@/api/schema'

type PolicyChangeAlertDto = components['schemas']['StyleMint.Modules.Reach.Entity.UnifiedReachSnapshot.Dtos.PolicyChangeAlertDto']

export function usePolicyAlerts() {
  return useQuery<PolicyChangeAlertDto[]>({
    queryKey: qk.policyAlerts(),
    queryFn:  async () => {
      const { data } = await api.get('/v1/admin/reach/policy-alerts')
      return data
    },
    staleTime: 30_000,
  })
}
