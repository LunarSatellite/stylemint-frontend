import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { csQk } from '@/api/queryKeys'
import { StoryArcState } from '@/lib/enums'
import { showErrorToast } from '@/api/errors'
import type { StoryArcDto, DropStoryArcRequest } from '@/api/schema'

export function useDropStoryArc() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body?: DropStoryArcRequest }) =>
      api.post<StoryArcDto>(`/v1/creator/story-arcs/${id}/drop`, body ?? {}).then((r) => r.data),

    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: csQk.storyArcs.detail(id) })
      const previous = queryClient.getQueryData(csQk.storyArcs.detail(id))
      queryClient.setQueryData(csQk.storyArcs.detail(id), (old: StoryArcDto) =>
        old ? { ...old, state: StoryArcState.Dropped } : old
      )
      return { previous, id }
    },

    onError: (_err, { id }, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(csQk.storyArcs.detail(id), ctx.previous)
      showErrorToast(_err)
    },

    onSettled: (_data, _err, { id }) => {
      queryClient.invalidateQueries({ queryKey: csQk.storyArcs.detail(id) })
      queryClient.invalidateQueries({ queryKey: ['cs', 'arcs', 'list'] })
    },
  })
}
