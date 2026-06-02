import axios from 'axios'
import { env } from '@/env'
import { useAuth } from '@/auth/store'
import { newIdempotencyKey } from './idempotency'

export const api = axios.create({
  baseURL: env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useAuth.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (['post', 'patch', 'put', 'delete'].includes(config.method ?? ''))
    config.headers['Idempotency-Key'] ??= newIdempotencyKey()
  config.headers['Accept-Language'] = navigator.language || 'en'
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err: unknown) => {
    if (axios.isAxiosError(err)) {
      const code = (err.response?.data as Record<string, string>)?.errorCode
      if (code === 'auth.token_expired' || code === 'auth.token_reuse_detected') {
        useAuth.getState().clear()
        window.location.replace('/login')
      }
    }
    return Promise.reject(err)
  }
)
