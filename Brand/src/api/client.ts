import axios from 'axios'
import { useAuth } from '@/auth/store'
import { cancelSilentRefresh } from '@/auth/silentRefresh'
import { broadcastLogout } from '@/auth/broadcastLogout'
import { newIdempotencyKey } from './idempotency'
import { env } from '@/env'

export const api = axios.create({ baseURL: env.apiBaseUrl })

const MUTATING_METHODS = new Set(['post', 'patch', 'put', 'delete'])

api.interceptors.request.use((config) => {
  const { token, vendorAccountId } = useAuth.getState()

  if (token)
    config.headers['Authorization'] = `Bearer ${token}`

  if (MUTATING_METHODS.has(config.method ?? ''))
    config.headers['Idempotency-Key'] ??= newIdempotencyKey()

  if (vendorAccountId !== null)
    config.headers['X-Vendor-Account-Id'] = vendorAccountId

  config.headers['Accept-Language'] = navigator.language || 'en'

  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      useAuth.getState().clear()
      cancelSilentRefresh()
      broadcastLogout()
      window.location.replace('/login')
    }
    return Promise.reject(error)
  },
)
