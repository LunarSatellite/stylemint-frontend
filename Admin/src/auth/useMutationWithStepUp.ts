import { useMutation, type UseMutationOptions } from '@tanstack/react-query';
import { create } from 'zustand';
import { errorCodeOf } from '@/api/errors';

/**
 * Re-run a mutation once the operator has proved who they are.
 *
 * Eight endpoints can demand step-up: removing someone's MFA, granting
 * a role, forcing a payout. The server decides — the client does not
 * guess which call will need it — so the pattern is to attempt, catch
 * `mfa.step_up_required`, collect a TOTP code, and attempt again.
 *
 * Retrying is safe because the interceptor puts an `Idempotency-Key` on
 * every write: if the first attempt actually reached the server before
 * being rejected, the second carries a different key only when it is a
 * genuinely new request.
 */
interface StepUpState {
  isOpen: boolean;
  /** Resolved when the operator completes the challenge. */
  resolve: ((verified: boolean) => void) | null;
  open: () => Promise<boolean>;
  succeed: () => void;
  cancel: () => void;
}

export const useStepUpDialog = create<StepUpState>((set, get) => ({
  isOpen: false,
  resolve: null,
  open: () =>
    new Promise<boolean>((resolve) => {
      set({ isOpen: true, resolve });
    }),
  succeed: () => {
    get().resolve?.(true);
    set({ isOpen: false, resolve: null });
  },
  cancel: () => {
    get().resolve?.(false);
    set({ isOpen: false, resolve: null });
  },
}));

export function useMutationWithStepUp<TData, TVars>(
  fn: (vars: TVars) => Promise<TData>,
  options?: Omit<UseMutationOptions<TData, unknown, TVars>, 'mutationFn'>,
) {
  const openStepUp = useStepUpDialog((s) => s.open);

  return useMutation<TData, unknown, TVars>({
    ...options,
    mutationFn: async (vars: TVars) => {
      try {
        return await fn(vars);
      } catch (err) {
        if (errorCodeOf(err) !== 'mfa.step_up_required') throw err;

        const verified = await openStepUp();
        // Cancelling must surface the original refusal, not a success.
        // An earlier shape here resolved quietly and the caller's
        // onSuccess ran for an action that never happened.
        if (!verified) throw err;
        return await fn(vars);
      }
    },
  });
}
