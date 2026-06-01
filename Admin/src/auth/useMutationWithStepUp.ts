import { useMutation } from '@tanstack/react-query'
import { useStepUpDialog } from './StepUpDialog'

export function useMutationWithStepUp<TData, TVars>(
  fn: (vars: TVars) => Promise<TData>,
  options?: {
    onSuccess?: (data: TData, vars: TVars) => void
    onError?: (err: unknown) => void
  },
) {
  const openStepUp = useStepUpDialog((s) => s.open)
  return useMutation({
    mutationFn: async (vars: TVars) => {
      try {
        return await fn(vars)
      } catch (err: unknown) {
        if ((err as any)?.response?.data?.errorCode === 'mfa.step_up_required') {
          await openStepUp()
          return await fn(vars)
        }
        throw err
      }
    },
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  })
}
