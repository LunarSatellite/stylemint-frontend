import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { paths, components } from '@/api/schema'

type CreatorApproveResponse = paths['/v1/admin/kyc/creator/{applicationId}/approve']['post']['responses']['200']['content']['application/json']
type VendorApproveResponse  = paths['/v1/admin/kyc/vendor/{applicationId}/approve']['post']['responses']['200']['content']['application/json']
type CreatorRejectResponse  = paths['/v1/admin/kyc/creator/{applicationId}/reject']['post']['responses']['200']['content']['application/json']
type VendorRejectResponse   = paths['/v1/admin/kyc/vendor/{applicationId}/reject']['post']['responses']['200']['content']['application/json']
type RejectKycVm            = components['schemas']['StyleMint.Modules.Onboarding.Api.Controllers.V1.ViewModels.AdminKyc.RejectKycVm']

type ApproveVars = { applicationId: string; kind: 'creator' | 'vendor' }
type RejectVars  = { applicationId: string; kind: 'creator' | 'vendor' } & RejectKycVm

type ApproveResponse = CreatorApproveResponse | VendorApproveResponse
type RejectResponse  = CreatorRejectResponse  | VendorRejectResponse

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
