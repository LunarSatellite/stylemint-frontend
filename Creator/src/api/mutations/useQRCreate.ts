import { useMutation } from '@tanstack/react-query'
import { api } from '@/api/client'

export interface QRCreateResponse {
  publicToken: string
  clientSecret: string
  qrPayload: string
  expiresUtc: string
}

export type QRSessionStatus = 'Pending' | 'Scanned' | 'Approved' | 'Consumed' | 'Rejected' | 'Expired'

export interface QRAuthBundle {
  accountId: string
  sessionId: string
  accessToken: string
  accessExpiresUtc: string
  refreshToken: string
  refreshExpiresUtc: string
  tokenType: string
}

export interface QRExchangeResponse {
  status: QRSessionStatus
  auth: QRAuthBundle | null
}

function getOrCreateFingerprint(): string {
  let fp = localStorage.getItem('sm_device_fp')
  if (!fp) {
    fp = crypto.randomUUID()
    localStorage.setItem('sm_device_fp', fp)
  }
  return fp
}

export function useQRCreate() {
  return useMutation({
    mutationFn: (): Promise<QRCreateResponse> =>
      api
        .post<QRCreateResponse>('/v1/auth/qr/create', {
          targetApp: 2,
          deviceFingerprint: getOrCreateFingerprint(),
          devicePlatform: 3,
          deviceModel: 'Browser',
          deviceOsVersion: navigator.platform,
        })
        .then((r) => r.data),
  })
}
