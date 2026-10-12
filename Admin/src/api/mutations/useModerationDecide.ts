import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../client';
import { qk, type ModerationFilter } from '../queryKeys';
import { correlationIdOf, errorCodeOf, getErrorMessage } from '../errors';
import { useMutationWithStepUp } from '@/auth/useMutationWithStepUp';
import type { PagedList } from '../types';
import type { ModerationItem } from '../queries/useModerationQueue';
import { ModerationItemState, type ModerationAction } from '@/lib/enums';

/** Body is `DecideModerationVm`: action and an optional note, nothing else. */
export interface ModerationDecideVars {
  moderationItemId: string;
  action: ModerationAction;
  decisionNote?: string;
}

/**
 * Decide a moderation case.
 *
 * The outcomes here reach as far as banning an author, so the note is
 * carried through under the name the contract uses and the optimistic
 * row shows `Decided` rather than guessing at the final action.
 */
export function useModerationDecide(filter: ModerationFilter) {
  const queryClient = useQueryClient();

  return useMutationWithStepUp<void, ModerationDecideVars>(
    async (vars) => {
      await api.post(`/v1/admin/moderation/${vars.moderationItemId}/decide`, {
        action: vars.action,
        decisionNote: vars.decisionNote,
      });
    },
    {
      onMutate: async (vars) => {
        await queryClient.cancelQueries({ queryKey: qk.moderation.queue(filter) });
        const previous = queryClient.getQueryData<PagedList<ModerationItem>>(
          qk.moderation.queue(filter),
        );

        queryClient.setQueryData<PagedList<ModerationItem>>(qk.moderation.queue(filter), (old) =>
          old
            ? {
                ...old,
                items: old.items.map((item) =>
                  item.id === vars.moderationItemId
                    ? { ...item, state: ModerationItemState.Decided, action: vars.action }
                    : item,
                ),
              }
            : old,
        );
        return { previous };
      },

      onError: (err, _vars, context) => {
        const snapshot = (context as { previous?: PagedList<ModerationItem> } | undefined)
          ?.previous;
        if (snapshot) queryClient.setQueryData(qk.moderation.queue(filter), snapshot);

        const code = errorCodeOf(err);
        if (code === 'state.concurrency_conflict') {
          void queryClient.invalidateQueries({ queryKey: qk.moderation.all() });
          toast.message(getErrorMessage(code));
          return;
        }
        const correlationId = correlationIdOf(err);
        toast.error(getErrorMessage(code), {
          description: correlationId ? `Ref: ${correlationId}` : undefined,
          duration: 8000,
        });
      },

      onSettled: (_d, _e, vars) => {
        void queryClient.invalidateQueries({ queryKey: qk.moderation.all() });
        void queryClient.invalidateQueries({
          queryKey: qk.moderation.detail(vars.moderationItemId),
        });
      },
    },
  );
}
