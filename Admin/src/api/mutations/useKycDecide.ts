import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../client';
import { qk, type KycQueueFilter } from '../queryKeys';
import { correlationIdOf, errorCodeOf, getErrorMessage } from '../errors';
import { useMutationWithStepUp } from '@/auth/useMutationWithStepUp';
import type { KycReviewItem, PagedList } from '../queries/useKycQueue';
import type { KycDecision, KycState } from '@/lib/enums';

/**
 * Approve or reject a KYC application.
 *
 * The body is `DecideKycVm`, read from the spec. Worth saying plainly,
 * because the first version of this file was written from the written
 * brief instead and got two things wrong: it sent `reasonCode` and
 * `note`, where the contract wants `decisionReasonCode` and
 * `decisionNote` — so the reviewer's reason would have been dropped
 * without any error — and it sent a `rowVersion` the endpoint does not
 * accept, which made the code look as though it carried concurrency
 * protection when nothing on the wire did.
 *
 * There is no optimistic-concurrency token on this endpoint. Two
 * reviewers deciding the same case is resolved server side or not at
 * all; this client must not imply otherwise.
 */
export interface KycDecideVars {
  kycItemId: string;
  decision: KycDecision;
  decisionReasonCode?: string;
  decisionNote?: string;
}

export function useKycDecide(filter: KycQueueFilter, nextState: KycState) {
  const queryClient = useQueryClient();

  return useMutationWithStepUp<void, KycDecideVars>(
    async (vars) => {
      await api.post(`/v1/admin/kyc/${vars.kycItemId}/decide`, {
        decision: vars.decision,
        decisionReasonCode: vars.decisionReasonCode,
        decisionNote: vars.decisionNote,
      });
    },
    {
      // Optimistic because a reviewer works the queue at speed, and a
      // row that lingers after a decision gets decided twice.
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
