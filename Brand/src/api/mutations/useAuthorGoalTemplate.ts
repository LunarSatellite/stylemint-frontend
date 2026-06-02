import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { bsQk } from '@/api/queryKeys'
import { extractApiError } from '@/lib/extractApiError'
import { showErrorToast } from '@/lib/showErrorToast'
import type { GoalTemplateVersionDto, CampaignGoal } from '@/api/schema'

interface AuthorGoalTemplateBody {
  goal:       CampaignGoal
  promptText: string
  notes?:     string
}

export function useAuthorGoalTemplate() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (body: AuthorGoalTemplateBody) =>
      api.post<GoalTemplateVersionDto>('/v1/admin/brand-studio/goal-templates', body)
        .then((r) => r.data),

    onSuccess: (template) => {
      qc.invalidateQueries({ queryKey: bsQk.goalTemplates.list(template.goal) })
      qc.invalidateQueries({ queryKey: bsQk.goalTemplates.active(template.goal) })
      toast.success('Goal template created.')
    },

    onError: (error) => {
      const { errorCode, correlationId } = extractApiError(error)
      showErrorToast(errorCode, correlationId)
    },
  })
}
