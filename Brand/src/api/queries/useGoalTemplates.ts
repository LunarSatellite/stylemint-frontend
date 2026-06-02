import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { bsQk } from '@/api/queryKeys'
import type { CampaignGoal } from '@/api/schema'
import type { GoalTemplateVersionDto } from '@/api/schema'

export function useGoalTemplates(goal: CampaignGoal) {
  return useQuery({
    queryKey: bsQk.goalTemplates.list(goal),
    queryFn:  async () => {
      const { data } = await api.get<GoalTemplateVersionDto[]>(
        '/v1/admin/brand-studio/goal-templates',
        { params: { goal } },
      )
      return data
    },
    staleTime: 60_000,
  })
}

export function useActiveGoalTemplate(goal: CampaignGoal) {
  return useQuery({
    queryKey: bsQk.goalTemplates.active(goal),
    queryFn:  async () => {
      const { data } = await api.get<GoalTemplateVersionDto>(
        '/v1/admin/brand-studio/goal-templates/active',
        { params: { goal } },
      )
      return data
    },
    staleTime: 60_000,
  })
}
