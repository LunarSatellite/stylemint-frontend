import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSsoLogin } from '@/api/mutations/useSsoLogin'
import { useMeMfa } from '@/api/queries/useMeMfa'
import { showErrorToast } from '@/api/errors'

export function SsoCallback() {
  const navigate = useNavigate()
  const login = useSsoLogin()
  const mfa = useMeMfa()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const idToken = params.get('id_token')
    const state = params.get('state')

    if (!idToken || state !== sessionStorage.getItem('sso_state')) {
      navigate('/login?reason=invalid_callback', { replace: true })
      return
    }

    login.mutate(idToken, {
      onError: showErrorToast,
    })
  }, [])

  useEffect(() => {
    if (mfa.data) {
      if (!mfa.data.hasTotp) {
        navigate('/settings/mfa', { replace: true })
      } else {
        navigate('/kyc', { replace: true })
      }
    }
  }, [mfa.data])

  return (
    <div className="flex items-center justify-center h-screen bg-bg-primary">
      <p className="text-text-muted">Signing in…</p>
    </div>
  )
}
