# Auth Flow — stylemint-admin-fe

## Two-layer SSO login

1. Build IdP URL (authority + client_id + redirect_uri + random state + nonce)
2. `window.location.assign(idpUrl)`
3. IdP redirects to `/sso/callback?id_token=...&state=...`
4. Verify `state === sessionStorage.sso_state`
5. `POST /v1/admin/auth/sso { idToken }` with `Idempotency-Key`
6. Store `accessToken` via `useAuth.getState().setToken()`
7. Check `useMeMfa()` — if `hasTotp === false` → redirect `/settings/mfa/setup`
8. Navigate to intended page or `/kyc`

## Silent re-login

JWT expires in 15 minutes. No refresh token. When `exp - now < 60s`:

```ts
// src/auth/silentRefresh.ts
export async function trySilentRefresh(): Promise<boolean> {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.src = buildIdpAuthUrl({ prompt: 'none' })
    const timeout = setTimeout(() => resolve(false), 5000)
    window.addEventListener('message', function handler(e) {
      if (e.data?.type === 'sso_token') {
        clearTimeout(timeout); window.removeEventListener('message', handler)
        document.body.removeChild(iframe); resolve(true)
      }
    })
    document.body.appendChild(iframe)
  })
}
```

## Multi-tab logout

```ts
// src/auth/broadcastLogout.ts — call initBroadcastLogout() once in main.tsx
const bc = new BroadcastChannel('auth')
export function initBroadcastLogout() {
  useAuth.subscribe((s, p) => { if (p.token && !s.token) bc.postMessage({ type: 'logout' }) })
  bc.onmessage = (e) => { if (e.data.type === 'logout') useAuth.getState().clear() }
}
```

## TOTP lockout

- 5 failed codes → 15-minute lock
- `useMeMfa()` returns `totpLocked` and `lockedUntilUtc`
- Show countdown timer during lock
- SuperAdmin unblocks via `DELETE /admins/{id}/mfa` (step-up required)

## Session inspector

Use `claims.jti` to highlight "This browser" row in sessions list:

```tsx
{session.jti === claims?.jti && <Badge>This browser</Badge>}
```

## 401 errorCode routing

| errorCode                    | Action                                            |
|------------------------------|---------------------------------------------------|
| `auth.token_reuse_detected`  | clear + `/login?reason=security`                  |
| `auth.session_revoked`       | clear + `/login?reason=revoked`                   |
| `auth.token_expired`         | try silent refresh → if fail, clear + `/login?reason=expired` |

## SSO rate limits

Login endpoint is rate limited: 5/min/IP, 20/hour/IP, 10/min/email.
On 429 from `/auth/sso` — show message, disable button for `Retry-After` seconds.
