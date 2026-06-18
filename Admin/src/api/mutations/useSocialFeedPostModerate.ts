import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { components } from '@/api/schema'

type PostDto = components['schemas']['StyleMint.Modules.SocialFeed.Entity.Post.Dtos.PostDto']
type Action  = 'hide' | 'remove' | 'restore'

interface Vars { postId: string; action: Action; reason?: string | null }

export function useSocialFeedPostModerate(options?: { onSuccess?: () => void; onError?: (e: unknown) => void }) {
  const qc = useQueryClient()
  return useMutation<PostDto, unknown, Vars>({
    mutationFn: async ({ postId, action, reason }) => {
      const { data } = await api.post<PostDto>(
        `/v1/admin/social-feed/posts/${postId}/${action}`,
        { reason: reason ?? null },
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
