import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { CreatorApplicationDto, VendorApplicationDto, RejectKycVm } from '@/api/schema'

type ApproveVars = { applicationId: string; kind: 'creator' | 'vendor' }
type RejectVars  = { applicationId: string; kind: 'creator' | 'vendor' } & RejectKycVm

type ApproveResponse = CreatorApplicationDto | VendorApplicationDto
type RejectResponse  = CreatorApplicationDto | VendorApplicationDto

export function useKycApprove(options?: {
  onSuccess?: (data: ApproveResponse) => void
  onError?:   (e: unknown) => void
}) {
  const qc = useQueryClient()
  return useMutation<ApproveResponse, unknown, ApproveVars>({
    mutationFn: async ({ applicationId, kind }) => {
      const { data } = await api.post<ApproveResponse>(`/v1/admin/kyc/${kind}/${applicationId}/approve`)
      return data
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ['kyc', vars.kind, 'queue'], exact: false })
      options?.onSuccess?.(data)
    },
    onError: options?.onError,
  })
}

export function useKycReject(options?: {
  onSuccess?: (data: RejectResponse) => void
  onError?:   (e: unknown) => void
}) {
  const qc = useQueryClient()
  return useMutation<RejectResponse, unknown, RejectVars>({
    mutationFn: async ({ applicationId, kind, reason }) => {
      const body: RejectKycVm = { reason: reason ?? null }
      const { data } = await api.post<RejectResponse>(`/v1/admin/kyc/${kind}/${applicationId}/reject`, body)
      return data
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ['kyc', vars.kind, 'queue'], exact: false })
      options?.onSuccess?.(data)
    },
    onError: options?.onError,
  })
}
