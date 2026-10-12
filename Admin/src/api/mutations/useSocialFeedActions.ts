import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../client';
import { correlationIdOf, errorCodeOf, getErrorMessage } from '../errors';
import { socialFeedKeys } from '../queries/usePostReports';

/**
 * Resolving a report and acting on the post are separate calls.
 *
 * That separation is in the API and worth keeping visible in the UI:
 * a moderator can dismiss a report without touching the post, or take
 * the post down and still have to say how the report was resolved.
 * Collapsing them into one button would hide a decision.
 */
function useFeedWrite<TVars>(
  request: (vars: TVars) => Promise<unknown>,
  success: (vars: TVars) => string,
) {
  const queryClient = useQueryClient();
  return useMutation<unknown, unknown, TVars>({
    mutationFn: request,
    onSuccess: (_d, vars) => toast.success(success(vars)),
    onError: (err) => {
      const correlationId = correlationIdOf(err);
      toast.error(getErrorMessage(errorCodeOf(err)), {
        description: correlationId ? `Ref: ${correlationId}` : undefined,
        duration: 8000,
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: socialFeedKeys.all() });
    },
  });
}

export interface ResolveReportVars {
  reportId: string;
  reason: string;
}

export function useResolveReport() {
  return useFeedWrite<ResolveReportVars>(
    (v) => api.post(`/v1/admin/social-feed/reports/${v.reportId}/resolve`, { reason: v.reason }),
    () => 'Report closed.',
  );
}

export interface PostActionVars {
  postId: string;
  reason: string;
}

export function useHidePost() {
  return useFeedWrite<PostActionVars>(
    (v) => api.post(`/v1/admin/social-feed/posts/${v.postId}/hide`, { reason: v.reason }),
    () => 'Post hidden. The author keeps it.',
  );
}

export function useRemovePost() {
  return useFeedWrite<PostActionVars>(
    (v) => api.post(`/v1/admin/social-feed/posts/${v.postId}/remove`, { reason: v.reason }),
    () => 'Post removed.',
  );
}

export function useRestorePost() {
  return useFeedWrite<{ postId: string }>(
    (v) => api.post(`/v1/admin/social-feed/posts/${v.postId}/restore`),
    () => 'Post restored.',
  );
}
