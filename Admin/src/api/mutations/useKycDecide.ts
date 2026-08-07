import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type {
  CreatorApplicationDto,
  VendorApplicationDto,
  KycReviewItemDto,
  AssignKycVm,
  DecideKycVm,
} from '@/api/schema'

// ── Legacy approve/reject (kept for backward-compat) ───────────────────────────

export function useKycApprove(options?: {
  onSuccess?: (data: CreatorApplicationDto | VendorApplicationDto) => void
  onError?:   (e: unknown) => void
}) {
  const qc = useQueryClient()
  return useMutation<CreatorApplicationDto | VendorApplicationDto, unknown, { applicationId: string; kind: 'creator' | 'vendor' }>({
    mutationFn: async ({ applicationId, kind }) => {
      const { data } = await api.post<CreatorApplicationDto | VendorApplicationDto>(`/v1/admin/kyc/${kind}/${applicationId}/approve`)
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
  onSuccess?: (data: CreatorApplicationDto | VendorApplicationDto) => void
  onError?:   (e: unknown) => void
}) {
  const qc = useQueryClient()
  return useMutation<CreatorApplicationDto | VendorApplicationDto, unknown, { applicationId: string; kind: 'creator' | 'vendor'; reason?: string | null }>({
    mutationFn: async ({ applicationId, kind, reason }) => {
      const body = { reason: reason ?? null }
      const { data } = await api.post<CreatorApplicationDto | VendorApplicationDto>(`/v1/admin/kyc/${kind}/${applicationId}/reject`, body)
      return data
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ['kyc', vars.kind, 'queue'], exact: false })
      options?.onSuccess?.(data)
    },
    onError: options?.onError,
  })
}

// ── New unified KYC review mutations ─────────────────────────────────────────

/** POST /v1/admin/kyc/{kycItemId}/assign — claim item → InReview */
export function useKycAssign(options?: {
  onSuccess?: (data: KycReviewItemDto) => void
  onError?:   (e: unknown) => void
}) {
  const qc = useQueryClient()
  return useMutation<KycReviewItemDto, unknown, { kycItemId: string; reviewerAdminId: string }>({
    mutationFn: async ({ kycItemId, reviewerAdminId }) => {
      const body: AssignKycVm = { reviewerAdminId }
      const { data } = await api.post<KycReviewItemDto>(`/v1/admin/kyc/${kycItemId}/assign`, body)
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.kyc.queue({}) })
      options?.onSuccess?.(data)
    },
    onError: options?.onError,
  })
}

/** POST /v1/admin/kyc/{kycItemId}/decide — terminal decision */
export function useKycDecide(options?: {
  onSuccess?: (data: KycReviewItemDto) => void
  onError?:   (e: unknown) => void
}) {
  const qc = useQueryClient()
  return useMutation<KycReviewItemDto, unknown, { kycItemId: string; body: DecideKycVm }>({
    mutationFn: async ({ kycItemId, body }) => {
      const { data } = await api.post<KycReviewItemDto>(`/v1/admin/kyc/${kycItemId}/decide`, body)
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: qk.kyc.queue({}) })
      options?.onSuccess?.(data)
    },
    onError: options?.onError,
  })
}
