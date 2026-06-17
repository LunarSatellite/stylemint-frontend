import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import { useMutationWithStepUp } from '@/auth/useMutationWithStepUp'

export function useMfaRemove(options?: { onSuccess?: () => void; onError?: (e: unknown) => void }) {
  const qc = useQueryClient()
  return useMutationWithStepUp(
    async () => { await api.delete('/v1/admin/auth/mfa/totp') },
    {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: qk.meMfa() })
        options?.onSuccess?.()
      },
      onError: options?.onError,
    },
  )
}
