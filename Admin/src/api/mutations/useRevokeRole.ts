import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import { useMutationWithStepUp } from '@/auth/useMutationWithStepUp'

export function useRevokeRole(options?: { onSuccess?: () => void; onError?: (e: unknown) => void }) {
  const qc = useQueryClient()
  return useMutationWithStepUp(
    async (vars: { id: string; role: string }) => {
      const { data } = await api.delete(`/v1/admin/admins/${vars.id}/roles/${vars.role}`)
      return data
    },
    {
      onSuccess: (_d: unknown, vars: { id: string; role: string }) => {
        qc.invalidateQueries({ queryKey: qk.admin(vars.id) })
        qc.invalidateQueries({ queryKey: ['admins'], exact: false })
        options?.onSuccess?.()
      },
    },
  )
}
