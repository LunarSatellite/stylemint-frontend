import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import type { QRExchangeResponse, QRSessionStatus } from '@/api/mutations/useQRCreate'

const TERMINAL: QRSessionStatus[] = ['Consumed', 'Rejected', 'Expired']

export function useQRExchange(publicToken: string | null, clientSecret: string | null) {
  return useQuery({
    queryKey: ['qr', 'exchange', publicToken],
    queryFn: (): Promise<QRExchangeResponse> =>
      api
        .post<QRExchangeResponse>('/v1/auth/qr/exchange', { publicToken, clientSecret })
        .then((r) => r.data),
    enabled: !!publicToken && !!clientSecret,
    staleTime: 0,
    gcTime: 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status && TERMINAL.includes(status)) return false
      return 2_000
    },
    retry: false,
  })
}
