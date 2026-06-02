import { api } from '@/api/client'
import { useAuth } from './store'
import { parseClaims } from './parseClaims'
import { broadcastLogout } from './broadcastLogout'

let refreshTimer: ReturnType<typeof setTimeout> | null = null

export function scheduleSilentRefresh(expiresAt: number) {
  if (refreshTimer) clearTimeout(refreshTimer)

  const msRemaining = expiresAt - Date.now()
  const delay = msRemaining * 0.8

  refreshTimer = setTimeout(async () => {
    try {
      const { data } = await api.post<{ token: string }>('/v1/auth/refresh')
      useAuth.getState().setToken(data.token)
      const claims = parseClaims(data.token)
      scheduleSilentRefresh(claims.exp * 1000)
    } catch {
      useAuth.getState().clear()
      broadcastLogout()
      window.location.replace('/login')
    }
  }, delay)
}

export function cancelSilentRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer)
  refreshTimer = null
}
