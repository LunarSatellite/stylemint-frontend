import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useSsoLogin } from '@/api/mutations/useSsoLogin'
import { api } from '@/api/client'
import { qk } from '@/api/queryKeys'
import type { AdminMfaStatusDto } from '@/api/schema'

export function SsoCallback() {
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const login       = useSsoLogin()

  useEffect(() => {
    // OIDC implicit flow (response_type=id_token) returns params in the hash fragment
    const params  = new URLSearchParams(window.location.hash.slice(1))
    const idToken = params.get('id_token')
    const state   = params.get('state')
    const stored  = sessionStorage.getItem('sso_state')

    if (!idToken || state !== stored) {
      navigate('/login?reason=invalid_callback', { replace: true })
      return
    }

    sessionStorage.removeItem('sso_state')

    login.mutate(idToken, {
      onSuccess: async () => {
        try {
          // Fetch MFA status directly — token is now set in Zustand so the
          // request will have the Authorization header
          const mfa = await queryClient.fetchQuery<AdminMfaStatusDto>({
            queryKey: qk.meMfa(),
            queryFn:  async () => {
              const { data } = await api.get<AdminMfaStatusDto>('/v1/admin/me/mfa')
              return data
            },
            staleTime: 30_000,
          })
          navigate(mfa.hasTotp ? '/kyc' : '/settings/mfa', { replace: true })
        } catch {
          // MFA check failed — still logged in, let the app handle it
          navigate('/kyc', { replace: true })
        }
      },
      onError: (err: any) => {
        const code       = err?.response?.data?.errorCode as string | undefined
        const retryAfter = err?.response?.headers?.['retry-after'] as string | undefined
        if (code === 'ratelimit.exceeded') {
          navigate(`/login?reason=rate_limited&retryAfter=${retryAfter ?? '60'}`, { replace: true })
        } else {
          navigate('/login?reason=sso_failed', { replace: true })
        }
      },
    })
  }, [])

  return (
    <div className="flex h-screen items-center justify-center bg-bg-primary">
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-primary" />
        <p className="text-sm text-text-muted">Signing in…</p>
      </div>
    </div>
  )
}
