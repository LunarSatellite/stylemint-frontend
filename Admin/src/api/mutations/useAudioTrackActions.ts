import { useQueryClient } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../client';
import { correlationIdOf, errorCodeOf, getErrorMessage } from '../errors';
import { audioKeys } from '../queries/useAudioTracks';

/**
 * Hide a track, or put it back.
 *
 * Neither is on the step-up list, so these use a plain mutation --
 * deliberately, and the guard in `step-up-is-not-optional.test.ts`
 * agrees because `/audio/tracks/{id}/hide` is not one of the eight.
 *
 * `hide` takes `{ reason }` as a body; `restore` takes nothing. Read
 * from the spec, not guessed: the reason is what a rights-holder
 * dispute is answered with later.
 */
function useAudioWrite<TVars>(
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
      void queryClient.invalidateQueries({ queryKey: audioKeys.all() });
    },
  });
}

export interface HideTrackVars {
  trackId: string;
  title: string;
  reason: string;
}

export function useHideTrack() {
  return useAudioWrite<HideTrackVars>(
    (v) => api.post(`/v1/admin/audio/tracks/${v.trackId}/hide`, { reason: v.reason }),
    (v) => `"${v.title}" no longer appears in recommendations.`,
  );
}

export interface RestoreTrackVars {
  trackId: string;
  title: string;
}

export function useRestoreTrack() {
  return useAudioWrite<RestoreTrackVars>(
    (v) => api.post(`/v1/admin/audio/tracks/${v.trackId}/restore`),
    (v) => `"${v.title}" is back in recommendations.`,
  );
}
