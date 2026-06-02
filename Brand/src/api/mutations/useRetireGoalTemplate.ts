import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { bsQk } from '@/api/queryKeys'
import { extractApiError } from '@/lib/extractApiError'
import { showErrorToast } from '@/lib/showErrorToast'
import type { TemplateId } from '@/lib/brands'
import type { GoalTemplateVersionDto, CampaignGoal } from '@/api/schema'

export function useRetireGoalTemplate() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: ({ id, rowVersion }: { id: TemplateId; goal: CampaignGoal; rowVersion: string }) =>
      api.post<GoalTemplateVersionDto>(
        `/v1/admin/brand-studio/goal-templates/${id}/retire`,
        { rowVersion },
      ).then((r) => r.data),

    onSuccess: (_, { goal }) => {
      qc.invalidateQueries({ queryKey: bsQk.goalTemplates.list(goal) })
      qc.invalidateQueries({ queryKey: bsQk.goalTemplates.active(goal) })
      toast.success('Goal template retired.')
    },

    onError: (error) => {
      const { errorCode, correlationId } = extractApiError(error)
      showErrorToast(errorCode, correlationId)
    },
  })
}
