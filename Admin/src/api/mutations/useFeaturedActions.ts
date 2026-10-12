import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../client';
import { correlationIdOf, errorCodeOf, getErrorMessage } from '../errors';
import { matchmakingKeys } from '../queries/useFeaturedMatches';

/**
 * Approve or reject a proposed featured match.
 *
 * Both take `{ note }` — not `reason`, which is what every other
 * endpoint in this API calls the same idea. Read from the spec rather
 * than written from habit; `reason` would have been accepted, ignored
 * and dropped.
 */
export interface FeaturedVars {
  id: string;
  note: string;
}

function useFeaturedWrite(
  request: (vars: FeaturedVars) => Promise<unknown>,
  success: string,
) {
  const queryClient = useQueryClient();
  return useMutation<unknown, unknown, FeaturedVars>({
    mutationFn: request,
    onSuccess: () => toast.success(success),
    onError: (err) => {
      const correlationId = correlationIdOf(err);
      toast.error(getErrorMessage(errorCodeOf(err)), {
        description: correlationId ? `Ref: ${correlationId}` : undefined,
        duration: 8000,
      });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: matchmakingKeys.all() });
    },
  });
}

export function useApproveFeatured() {
  return useFeaturedWrite(
    (v) => api.post(`/v1/admin/matchmaking/featured/${v.id}/approve`, { note: v.note }),
    'Approved. It is queued to be pushed, not pushed yet.',
  );
}

export function useRejectFeatured() {
  return useFeaturedWrite(
    (v) => api.post(`/v1/admin/matchmaking/featured/${v.id}/reject`, { note: v.note }),
    'Rejected.',
  );
}

export function useRunFairnessAudit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/v1/admin/matchmaking/fairness-audit/run'),
    onSuccess: () => {
      toast.success('Fairness audit started. The report updates when it finishes.');
      void queryClient.invalidateQueries({ queryKey: matchmakingKeys.fairness() });
    },
    onError: (err) => toast.error(getErrorMessage(errorCodeOf(err))),
  });
}
