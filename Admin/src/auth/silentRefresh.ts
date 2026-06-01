import { env } from '@/env'
import { useAuth } from './store'

function buildIdpAuthUrl(extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({
    client_id: env.ssoClientId,
    redirect_uri: env.ssoRedirectUri,
    response_type: 'id_token',
    scope: 'openid email profile',
    nonce: crypto.randomUUID(),
    ...extra,
  })
  return `${env.ssoAuthority}/authorize?${params}`
}

export async function trySilentRefresh(): Promise<boolean> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.src = buildIdpAuthUrl({ prompt: 'none' })
    const timeout = setTimeout(() => resolve(false), 5000)
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'sso_token') {
        clearTimeout(timeout)
        window.removeEventListener('message', handler)
        document.body.removeChild(iframe)
        useAuth.getState().setToken(e.data.token)
        resolve(true)
      }
    }
    window.addEventListener('message', handler)
    document.body.appendChild(iframe)
  })
}
