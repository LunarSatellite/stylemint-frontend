import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { QrCreateRequest, QrCreateResponse } from '@/api/schema'

export function useQrCreate() {
  return useMutation({
    mutationFn: (body: QrCreateRequest) =>
      api.post<QrCreateResponse>('/v1/auth/qr/create', body).then((r) => r.data),
  })
}
