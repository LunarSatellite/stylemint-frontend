import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { QrExchangeRequest, QrExchangeResponse } from '@/api/schema'

export function useQrExchange() {
  return useMutation({
    mutationFn: (body: QrExchangeRequest) =>
      api.post<QrExchangeResponse>('/v1/auth/qr/exchange', body).then((r) => r.data),
  })
}
