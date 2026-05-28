---
name: stylemint-admin-fe
description: |
  Use this skill whenever working in the stylemint-admin-frontend repo or
  building any part of the StyleMint operator console. Trigger on: adding
  pages, query hooks, mutation hooks, routing, auth, role guards, step-up MFA,
  TOTP flows, KYC or moderation queue features, audit log, feature flags,
  platform config, payout overrides, admin account management, session control,
  error handling, enums, formatters, or any component in this SPA. Also trigger
  when the user asks how to wire an admin endpoint, debug a 401/403, implement
  a permission check, scaffold anything new, or review code in this repo.
  Always load this skill before writing any code in stylemint-admin-frontend.
---

# stylemint-admin-fe

Internal desktop SPA for StyleMint operators. Consumes `/v1/admin/*`.
Desktop only — 1280px minimum viewport. No mobile support.

---

## Knowledge base

Read the relevant reference before writing any code:

| Reference | When to read |
|---|---|
| `references/architecture.md` | Starting any feature — design before code |
| `references/performance.md` | Bundle config, lazy loading, memoization, virtualization |
| `references/folder-structure.md` | Adding any file — placement and naming |
| `references/auth-flow.md` | Auth, SSO, MFA, session, 401 handling |
| `references/query-keys.md` | Any `useQuery` or `useMutation`, cache invalidation |
| `references/error-codes.md` | Error handling, toasts, rate limits |
| `references/enums.md` | Any enum value or status check |
| `references/design-tokens.md` | Any color, background, border, shadow |

---

## Commands

| Command | Purpose |
|---|---|
| `/component` | Scaffold container + presentation + form triple |
| `/query` | Scaffold a TanStack Query `useQuery` hook |
| `/mutation` | Scaffold a mutation hook (with step-up MFA if needed) |
| `/page` | Scaffold a page + register route |
| `/form` | Scaffold React Hook Form + Zod form |
| `/table` | Scaffold DataTable or VirtualTable |
| `/test` | Write Vitest + RTL tests |
| `/guard` | Scaffold RequireAuth / RequireRole guard |

---

## Stack

Vite 5 · React 18 · TypeScript 5 strict · React Router v6 ·
TanStack Query v5 · Zustand · axios · React Hook Form + Zod ·
shadcn/ui (Radix + Tailwind) · TanStack Table v8 · TanStack Virtual ·
date-fns · sonner · lucide-react · qrcode.react · Vitest · Playwright

---

## Hard invariants — never violate

- JWT in memory only — never `localStorage`, never cookies
- Switch on `errorCode` string — never on HTTP status number
- Step-up endpoints use `useMutationWithStepUp` — never plain `useMutation`
- `auth.token_reuse_detected` → security redirect, not expired message
- After login: check `hasTotp` — if false, force `/settings/mfa/setup`
- Never import Radix primitives in features — only via `src/components/ui/`
- Permissions via `permissions.*()` — never inline role string checks
- KYC and moderation `staleTime` is 10 000 ms — do not increase
- `<StepUpDialog/>` renders once in `AppShell` only
- `initBroadcastLogout()` called once in `main.tsx` only
- Never `dangerouslySetInnerHTML` anywhere
- Audit log `payloadJson` → plain text, never HTML
- Never hardcode hex colors — use CSS variables from design tokens
- `schema.ts` committed to git — never regenerate in CI
- No barrel `index.ts` files inside `features/`
