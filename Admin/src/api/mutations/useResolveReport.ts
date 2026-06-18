import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { components } from '@/api/schema'

type PostReportDto = components['schemas']['StyleMint.Modules.SocialFeed.Entity.PostReport.Dtos.PostReportDto']

interface Vars {
  reportId: string
  terminal: number
  reason?:  string | null
}

export function useResolveReport(options?: { onSuccess?: () => void; onError?: (e: unknown) => void }) {
  const qc = useQueryClient()
  return useMutation<PostReportDto, unknown, Vars>({
    mutationFn: async ({ reportId, terminal, reason }) => {
      const { data } = await api.post<PostReportDto>(
        `/v1/admin/social-feed/reports/${reportId}/resolve`,
        { reason: reason ?? null },
        { params: { terminal } },
      )
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['social-feed', 'reports'] })
      options?.onSuccess?.()
    },
    onError: options?.onError,
  })
}
