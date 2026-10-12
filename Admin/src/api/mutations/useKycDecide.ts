import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../client';
import { qk, type KycQueueFilter } from '../queryKeys';
import { correlationIdOf, errorCodeOf, getErrorMessage } from '../errors';
import { useMutationWithStepUp } from '@/auth/useMutationWithStepUp';
import type { KycReviewItem, PagedList } from '../queries/useKycQueue';
import type { KycState } from '@/lib/enums';

export interface KycDecideVars {
  kycItemId: string;
  decision: number;
  reasonCode?: string;
  note?: string;
  /** Sent back so the server can reject a decision made on a stale view. */
  rowVersion: string;
}

/**
 * Approve or reject a KYC application.
 *
 * Optimistic, because a reviewer works the queue at speed and a row
 * that lingers after a decision gets decided twice. The snapshot is
 * restored on any failure, including a cancelled step-up challenge.
 */
export function useKycDecide(filter: KycQueueFilter, nextState: KycState) {
  const queryClient = useQueryClient();

  return useMutationWithStepUp<void, KycDecideVars>(
    async (vars) => {
      await api.post(`/v1/admin/kyc/${vars.kycItemId}/decide`, {
        decision: vars.decision,
        reasonCode: vars.reasonCode,
        note: vars.note,
        rowVersion: vars.rowVersion,
      });
    },
    {
      onMutate: async (vars) => {
        await queryClient.cancelQueries({ queryKey: qk.kyc.queue(filter) });
        const previous = queryClient.getQueryData<PagedList<KycReviewItem>>(qk.kyc.queue(filter));

        queryClient.setQueryData<PagedList<KycReviewItem>>(qk.kyc.queue(filter), (old) =>
          old
            ? {
                ...old,
                items: old.items.map((item) =>
                  item.id === vars.kycItemId ? { ...item, state: nextState } : item,
                ),
              }
            : old,
        );
        return { previous };
      },

      onError: (err, _vars, context) => {
        const snapshot = (context as { previous?: PagedList<KycReviewItem> } | undefined)?.previous;
        if (snapshot) queryClient.setQueryData(qk.kyc.queue(filter), snapshot);

        const code = errorCodeOf(err);
        // A conflict is not a failure to report as one: somebody else
        // decided this case first, and the right response is to show
        // the reviewer what is actually there now.
        if (code === 'state.concurrency_conflict') {
          void queryClient.invalidateQueries({ queryKey: qk.kyc.all() });
          toast.message(getErrorMessage(code));
          return;
        }
        const correlationId = correlationIdOf(err);
        toast.error(getErrorMessage(code), {
          description: correlationId ? `Ref: ${correlationId}` : undefined,
          duration: 8000,
        });
      },

      onSettled: (_data, _err, vars) => {
        void queryClient.invalidateQueries({ queryKey: qk.kyc.all() });
        void queryClient.invalidateQueries({ queryKey: qk.kyc.detail(vars.kycItemId) });
      },
    },
  );
}
