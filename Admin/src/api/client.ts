import axios from 'axios'
import { env } from '@/env'
import { useAuth } from '@/auth/store'
import { newIdempotencyKey } from './idempotency'
import { trySilentRefresh } from '@/auth/silentRefresh'

export const api = axios.create({
  baseURL: env.apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useAuth.getState().token
  if (token && !config.url?.endsWith('/auth/sso'))
    config.headers.Authorization = `Bearer ${token}`
  if (['post', 'patch', 'put', 'delete'].includes(config.method ?? ''))
    config.headers['Idempotency-Key'] ??= newIdempotencyKey()
  config.headers['Accept-Language'] = navigator.language || 'en'
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const code = err.response?.data?.errorCode
    if (err.response?.status === 401) {
      if (code === 'auth.token_reuse_detected') {
        useAuth.getState().clear()
        window.location.assign('/login?reason=security')
        return Promise.reject(err)
      }
      if (code === 'auth.session_revoked') {
        useAuth.getState().clear()
        window.location.assign('/login?reason=revoked')
        return Promise.reject(err)
      }
      const ok = await trySilentRefresh()
      if (!ok) {
        useAuth.getState().clear()
        window.location.assign('/login?reason=expired')
      }
    }
    return Promise.reject(err)
  },
)
