import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'

export function useFeatureFlags() {
  return useQuery({
    queryKey: qk.flags(),
    queryFn: async () => {
      const { data } = await api.get('/v1/admin/feature-flags')
      return data
    },
    staleTime: 60_000,
  })
}

export function useFeatureFlag(key: string) {
  return useQuery({
    queryKey: qk.flag(key),
    queryFn: async () => {
      const { data } = await api.get(`/v1/admin/feature-flags/${key}`)
      return data
    },
    staleTime: 60_000,
    enabled: Boolean(key),
  })
}
