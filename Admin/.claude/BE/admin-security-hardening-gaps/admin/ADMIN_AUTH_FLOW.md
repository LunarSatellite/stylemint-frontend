# Auth Flow — Style Mint Admin Frontend

Companion to `SKILL.md`. End-to-end auth lifecycle: SSO login, JWT
shape, step-up MFA, session control, token revocation, retry
patterns, and edge cases.

## 1. Two layers of auth

The admin user authenticates **twice**:

1. **Corporate IdP** (Okta / EntraID / Auth0 / Keycloak) — owns
   employee identity. Issues an OIDC `id_token`.
2. **Style Mint admin JWT** — issued by `AdminJwtIssuer` after the
   backend verifies the IdP id-token. This is the bearer the
   frontend uses for `/v1/admin/*` calls.

The IdP is configured per environment. The frontend treats it as
opaque — it knows the authority URL, client id, redirect URI, and
nothing else. The id-token is consumed by the backend's
`OidcAssertionVerifier` (provider-agnostic — works against any
OIDC-compliant IdP).

## 2. Login sequence (detailed)

```
┌─────────┐    ┌─────────────┐    ┌──────────────┐    ┌────────────┐
│ User    │    │ Frontend    │    │ IdP          │    │ Style Mint │
│         │    │ (Vite SPA)  │    │              │    │ Backend    │
└────┬────┘    └──────┬──────┘    └──────┬───────┘    └─────┬──────┘
     │                │                  │                  │
     │  click "Sign   │                  │                  │
     │  in with SSO"  │                  │                  │
     ├───────────────►│                  │                  │
     │                │  build IdP auth  │                  │
     │                │  URL: authority  │                  │
     │                │  + client_id +   │                  │
     │                │  redirect_uri +  │                  │
     │                │  state (random)  │                  │
     │                │  + nonce         │                  │
     │                │                  │                  │
     │                │  window.location │                  │
     │                │  .assign(idpUrl) │                  │
     │                ├─────────────────►│                  │
     │                │                  │                  │
     │  IdP login UI  │                  │                  │
     │  + MFA prompt  │                  │                  │
     │◄──────────────────────────────────┤                  │
     │                │                  │                  │
     │  authenticate  │                  │                  │
     ├──────────────────────────────────►│                  │
     │                │                  │                  │
     │                │  redirect to     │                  │
     │                │  /sso/callback   │                  │
     │                │  ?id_token=...   │                  │
     │                │  &state=...      │                  │
     │                │◄─────────────────┤                  │
     │                │                  │                  │
     │                │  verify state    │                  │
     │                │  matches stored  │                  │
     │                │  random          │                  │
     │                │                  │                  │
     │                │  POST /v1/admin  │                  │
     │                │  /auth/sso       │                  │
     │                │  { idToken }     │                  │
     │                │  Idempotency-Key │                  │
     │                ├──────────────────────────────────►│
     │                │                  │                  │
     │                │                  │  OidcAssertion-  │
     │                │                  │  Verifier:       │
     │                │                  │  - fetch JWKS    │
     │                │                  │  - verify sig    │
     │                │                  │  - check iss/aud │
     │                │                  │  - check exp     │
     │                │                  │  - check amr     │
     │                │                  │    matches mfa   │
     │                │                  │    policy        │
     │                │                  │  - lookup admin  │
     │                │                  │    by sso_subject│
     │                │                  │    (hashed)      │
     │                │                  │  - mint admin    │
     │                │                  │    JWT (15 min)  │
     │                │                  │  - create        │
     │                │                  │    AdminSession  │
     │                │                  │    row           │
     │                │                  │                  │
     │                │  200 OK          │                  │
     │                │  AdminSessionDto │                  │
     │                │◄──────────────────────────────────┤
     │                │                  │                  │
     │                │  store {token,   │                  │
     │                │  claims, expUtc} │                  │
     │                │  in Zustand mem  │                  │
     │                │                  │                  │
     │                │  navigate to /   │                  │
     │  ◄─────────────┤                  │                  │
```

### Frontend pieces

```ts
// src/auth/store.ts
import { create } from "zustand";
import { parseJwt } from "./parseClaims";

type AdminClaims = {
  sub: string;              // adm_<guid>
  email: string;
  name: string;
  roles: string[];
  session_id: string;
  jti: string;
  exp: number;              // unix seconds
};

type AuthState = {
  token: string | null;
  claims: AdminClaims | null;
  setToken: (token: string) => void;
  clear: () => void;
};

export const useAuth = create<AuthState>((set) => ({
  token: null,
  claims: null,
  setToken: (token) => set({ token, claims: parseJwt(token) }),
  clear: () => set({ token: null, claims: null }),
}));
```

```ts
// src/auth/parseClaims.ts
export function parseJwt(token: string): AdminClaims | null {
  try {
    const [, payload] = token.split(".");
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
}
```

```ts
// src/auth/SsoCallback.tsx (route component)
export function SsoCallback() {
  const navigate = useNavigate();
  const { setToken } = useAuth();
  const { mutate } = useSsoLogin();

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const idToken = params.get("id_token");
    const state   = params.get("state");
    const stored  = sessionStorage.getItem("sso_state");
    if (!idToken || state !== stored) {
      navigate("/login?error=state_mismatch");
      return;
    }
    sessionStorage.removeItem("sso_state");
    mutate({ idToken }, {
      onSuccess: (data) => {
        setToken(data.accessToken);
        navigate("/");
      },
      onError: () => navigate("/login?error=sso_failed"),
    });
  }, []);

  return <div>Signing you in…</div>;
}
```

### Axios setup

```ts
// src/api/client.ts
import axios from "axios";
import { useAuth } from "@/auth/store";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = useAuth.getState().token;
  if (token && !config.url?.endsWith("/auth/sso")) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const code = err.response.data?.errorCode;
      if (code === "auth.session_revoked" || code === "auth.token_expired") {
        useAuth.getState().clear();
        window.location.assign("/login?reason=expired");
      }
    }
    return Promise.reject(err);
  },
);
```

## 3. Step-up MFA

The backend marks sensitive endpoints with
`[RequireStepUpMfa(MaxAgeMinutes = 5)]`. Calling one without a fresh
verify returns:

```json
{
  "type": "...",
  "title": "MFA step-up required",
  "status": 403,
  "errorCode": "mfa.step_up_required",
  "correlationId": "..."
}
```

The frontend pattern is a **dialog-wrapped mutation**:

```ts
// src/auth/useMutationWithStepUp.ts
import { useMutation } from "@tanstack/react-query";
import { useStepUpDialog } from "./StepUpDialog";

export function useMutationWithStepUp<TData, TVars>(
  fn: (vars: TVars) => Promise<TData>,
  options?: { onSuccess?: (d: TData) => void },
) {
  const openStepUp = useStepUpDialog((s) => s.open);
  return useMutation({
    mutationFn: async (vars: TVars) => {
      try {
        return await fn(vars);
      } catch (err: any) {
        if (err?.response?.data?.errorCode === "mfa.step_up_required") {
          await openStepUp();              // resolves when verify succeeds
          return await fn(vars);            // retry once
        }
        throw err;
      }
    },
    onSuccess: options?.onSuccess,
  });
}
```

```ts
// src/auth/StepUpDialog.tsx
import { create } from "zustand";
import { api } from "@/api/client";
import { newIdempotencyKey } from "@/api/idempotency";

type DialogState = {
  isOpen: boolean;
  resolver: (() => void) | null;
  rejecter: ((e: any) => void) | null;
  open: () => Promise<void>;
  submit: (code: string) => Promise<void>;
  cancel: () => void;
};

export const useStepUpDialog = create<DialogState>((set, get) => ({
  isOpen: false,
  resolver: null,
  rejecter: null,
  open: () => new Promise((resolve, reject) => {
    set({ isOpen: true, resolver: resolve, rejecter: reject });
  }),
  submit: async (code) => {
    await api.post("/v1/admin/auth/mfa/totp/verify",
      { code },
      { headers: { "Idempotency-Key": newIdempotencyKey() } },
    );
    const { resolver } = get();
    set({ isOpen: false, resolver: null, rejecter: null });
    resolver?.();
  },
  cancel: () => {
    const { rejecter } = get();
    set({ isOpen: false, resolver: null, rejecter: null });
    rejecter?.(new Error("step-up cancelled"));
  },
}));
```

The dialog is rendered once at the AppShell level — when its
`isOpen` flips true, it intercepts focus and prompts for the 6-digit
code.

### Endpoints that require step-up (8 in v1.1)

| Method | Path |
|--------|------|
| DELETE | `/v1/admin/auth/mfa/totp` |
| POST   | `/v1/admin/admins/{id}/roles/{role}` |
| DELETE | `/v1/admin/admins/{id}/roles/{role}` |
| POST   | `/v1/admin/admins/{id}/disable` |
| POST   | `/v1/admin/admins/{id}/enable` |
| POST   | `/v1/admin/admins/{id}/sessions/revoke-all` |
| DELETE | `/v1/admin/admins/{id}/mfa` |
| POST   | `/v1/admin/payouts/{id}/force-paid` |
| POST   | `/v1/admin/payouts/{id}/force-failed` |

All other writes (KYC decide, moderation decide, refund, payout
hold/release, feature flags, platform config) are gated by role
only.

## 4. Token lifecycle

| Event | What happens |
|-------|--------------|
| Login | Backend mints JWT (exp = now + 15 min), creates AdminSession row. Frontend stores token in memory. |
| Each request | `Authorization: Bearer <token>` sent. Backend validates signature + checks revocation middleware + touches `LastSeenUtc` (debounced 60s). |
| Token approaching exp | **No refresh in v1.** Frontend silently re-runs the SSO flow if the IdP session is still valid (silent redirect — usually invisible). Plan for a real refresh path in v2. |
| Logout | POST `/auth/logout` → row revoked → frontend clears Zustand → navigate `/login`. |
| Logout all | POST `/auth/logout-all` → all rows for this admin revoked. |
| Force-revoke | SuperAdmin hits POST `/admins/{id}/sessions/revoke-all`. The target sees a `401 auth.session_revoked` on next request. |
| Account disabled | Same as force-revoke + all future SSO exchanges fail with `admin.account.disabled`. |
| Role change | The session row stays valid, but the JWT's `roles` claim is stale. Backend revokes on role grant/revoke to force re-login with fresh claims. |

## 5. Silent re-login (token expiry without forcing visible redirect)

When the token is within 60 seconds of `exp`, try a silent SSO
prompt before the user submits their next mutation:

```ts
// src/auth/silentRefresh.ts
export async function trySilentRefresh(): Promise<boolean> {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.src = buildIdpAuthUrl({ prompt: "none" });   // OIDC silent prompt
    iframe.onload = async () => {
      // ... message channel to receive id_token from iframe
      // POST /v1/admin/auth/sso, setToken, resolve(true)
    };
    setTimeout(() => resolve(false), 5000);
    document.body.appendChild(iframe);
  });
}
```

If the IdP responds with `login_required`, the iframe fails — fall
back to a visible redirect.

This is **optional polish for v1.1**; ship without it first.

## 6. CSRF / XSS posture

- **No CSRF risk on `/v1/admin/*`** because the bearer token is in
  an `Authorization` header (cross-origin browsers won't send custom
  headers automatically). No cookies → no CSRF token needed.
- **XSS risk**: the token in memory is wiped on page reload, so an
  XSS payload that lands a cross-origin call has a narrow window.
  **Mitigations:**
  - CSP header: `Content-Security-Policy: default-src 'self'; ...`
    set via the SPA's hosting layer (Vercel/nginx).
  - Never `dangerouslySetInnerHTML` on user-supplied strings.
  - Audit-log `payloadJson` is server-redacted but render as text,
    not HTML.

## 7. Session inspector UX

The "My sessions" page shows every active session for the current
admin. Use `jti` to highlight which row corresponds to the current
browser:

```tsx
const { claims } = useAuth();
const currentJti = claims?.jti;

<DataTable
  data={sessions}
  columns={[
    {
      header: "",
      cell: (row) => row.jti === currentJti
        ? <Badge>This browser</Badge>
        : null,
    },
    { header: "IP",          accessor: "sourceIp" },
    { header: "User agent",  accessor: "userAgent" },
    { header: "Issued",      accessor: (r) => formatDateTime(r.issuedUtc) },
    { header: "Last seen",   accessor: (r) => formatDateTime(r.lastSeenUtc) },
    { header: "MFA",         accessor: (r) => r.mfaAssertedUtc ? "Yes" : "No" },
  ]}
/>
```

## 8. Edge cases

- **User clicks "Sign in" but is already authenticated** — the SSO
  flow still works; backend revokes the old session implicitly when
  the new one is created (one active session per browser is the
  norm).
- **TOTP code rejected 5 times** — backend locks the credential for
  15 minutes. `totpLocked` flips true on `/me/mfa`. Show the
  countdown; the SuperAdmin recovery path (`DELETE
  /admins/{id}/mfa`) is the unblock.
- **IdP MFA satisfied but Style Mint MFA absent** — admin can log
  in but every step-up gated action fails until they enroll. Force
  them to `/settings/mfa/setup` on first login if `hasTotp = false`.
- **Multi-tab logout** — clearing Zustand only clears this tab.
  Other tabs notice on their next API call (401). Use a
  `BroadcastChannel` to broadcast logout across tabs:

  ```ts
  const bc = new BroadcastChannel("auth");
  useAuth.subscribe((state, prev) => {
    if (prev.token && !state.token) bc.postMessage({ type: "logout" });
  });
  bc.onmessage = (e) => { if (e.data.type === "logout") useAuth.getState().clear(); };
  ```
