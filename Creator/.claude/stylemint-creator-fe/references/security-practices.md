# Security Practices — stylemint-creator-fe

---

## XSS Prevention

### Never use dangerouslySetInnerHTML

This is an absolute invariant — no exceptions, no "trusted source" rationale.

```tsx
// WRONG — never
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// CORRECT — render as text
<p>{userContent}</p>
```

If the server returns HTML that must be rendered (e.g. rich text), sanitize it with DOMPurify first:

```ts
import DOMPurify from 'dompurify'

const clean = DOMPurify.sanitize(rawHtml, {
  ALLOWED_TAGS: ['p', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li'],
  ALLOWED_ATTR: ['href', 'target', 'rel'],
})

// Then and only then:
<div dangerouslySetInnerHTML={{ __html: clean }} />
```

### User-generated content

Always render user-generated strings as text nodes, never as HTML. React does this by default — it only becomes dangerous when you explicitly opt into `dangerouslySetInnerHTML`.

---

## Open Redirect Prevention

Never pass unvalidated user input as a navigation target.

```ts
// WRONG — open redirect via query param
const { next } = useSearchParams()
navigate(next)  // attacker can craft ?next=https://evil.com

// CORRECT — validate against known internal paths
const SAFE_PATHS = ['/analytics', '/studio', '/story-arcs', '/activity']

function safePath(next: string | null): string {
  if (!next) return '/analytics'
  try {
    const url = new URL(next, window.location.origin)
    if (url.origin !== window.location.origin) return '/analytics'
    if (!SAFE_PATHS.some((p) => url.pathname.startsWith(p))) return '/analytics'
    return url.pathname + url.search
  } catch {
    return '/analytics'
  }
}
```

---

## Token Security

- JWT is stored in memory only (`useAuth` Zustand store). Never `localStorage`, `sessionStorage`, or cookies.
- The token is cleared on `auth.token_expired` and `auth.token_reuse_detected` responses.
- On logout, call `useAuth.getState().clear()` and broadcast via `BroadcastChannel` so all tabs log out simultaneously.

```ts
// src/auth/broadcastLogout.ts
const channel = new BroadcastChannel('auth')

export function broadcastLogout() {
  channel.postMessage({ type: 'LOGOUT' })
}

export function listenForLogout(onLogout: () => void) {
  channel.addEventListener('message', (e) => {
    if (e.data?.type === 'LOGOUT') onLogout()
  })
}
```

---

## External Links

All external links must use `rel="noopener noreferrer"` and open in `_blank`. This prevents the target page from accessing `window.opener`.

```tsx
// CORRECT
<a href={url} target="_blank" rel="noopener noreferrer">View on TikTok</a>

// CORRECT — programmatic
window.open(url, '_blank', 'noopener,noreferrer')

// WRONG
<a href={url} target="_blank">View</a>
```

---

## URL Validation

Before using any URL from API data in an `<img src>`, `<a href>`, or `window.open`, validate the scheme:

```ts
function isSafeUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

// Usage
const src = isSafeUrl(card.externalListenUrl ?? '') ? card.externalListenUrl : null
```

---

## Idempotency Keys

Every mutating request (POST, PATCH, PUT, DELETE) includes an idempotency key via the axios interceptor. This prevents duplicate operations when the user retries. The key generation must use a cryptographically random value.

```ts
// src/api/idempotency.ts
export function newIdempotencyKey(): string {
  return crypto.randomUUID()
}
```

Never use `Math.random()` for idempotency keys.

---

## Content Security Policy

The app must be served with a CSP header. Recommended values:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' https: data:;
  connect-src 'self' https://api.stylemint.io;
  font-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
```

`'unsafe-inline'` for styles is acceptable because Tailwind injects critical CSS. `'unsafe-eval'` is never acceptable.

---

## Dependency Hygiene

```bash
npm audit               # check for known vulnerabilities
npm audit --audit-level high   # CI gate — fail on high/critical
```

Run `npm audit` before every release. Do not dismiss high or critical vulnerabilities without a written rationale.

---

## Environment Variables

Sensitive values (API base URL, feature flags) must come from `import.meta.env`. Validate at startup with Zod — crash fast if required variables are missing.

```ts
// src/env.ts
import { z } from 'zod'

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().url(),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']),
})

export const env = envSchema.parse({
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
  VITE_APP_ENV:      import.meta.env.VITE_APP_ENV,
})
```

Never access `import.meta.env.VITE_*` directly in components — always import from `src/env.ts`. Never expose secrets in env variables — only public configuration belongs in `VITE_*` vars.
