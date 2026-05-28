# Folder Structure — stylemint-admin-fe

```
src/
├── api/
│   ├── client.ts            # axios instance + interceptors (only place)
│   ├── schema.ts            # GENERATED — never edit manually
│   ├── idempotency.ts       # export const newIdempotencyKey = () => crypto.randomUUID()
│   ├── errors.ts            # errorCode → message registry + showErrorToast
│   ├── queryKeys.ts         # qk factory — all cache keys live here
│   ├── queries/             # one file per resource
│   │   ├── useMe.ts
│   │   ├── useMeSessions.ts
│   │   ├── useMeMfa.ts
│   │   ├── useKycQueue.ts
│   │   ├── useModerationQueue.ts
│   │   ├── useAuditLog.ts
│   │   ├── useFeatureFlags.ts
│   │   ├── usePlatformConfig.ts
│   │   ├── useAdminAccounts.ts
│   │   └── usePayouts.ts
│   └── mutations/           # one file per write endpoint
│       ├── useSsoLogin.ts
│       ├── useLogout.ts
│       ├── useKycAssign.ts
│       ├── useKycDecide.ts
│       ├── useModerationAssign.ts
│       ├── useModerationDecide.ts
│       ├── useFeatureFlagUpsert.ts
│       ├── useFeatureFlagOverride.ts
│       ├── usePlatformConfigSet.ts
│       ├── usePayoutHold.ts
│       ├── usePayoutRelease.ts
│       ├── usePayoutForceMark.ts
│       ├── useRefund.ts
│       ├── useGrantRole.ts
│       ├── useRevokeRole.ts
│       ├── useDisableAdmin.ts
│       ├── useEnableAdmin.ts
│       ├── useForceRevokeSessions.ts
│       ├── useForceRemoveMfa.ts
│       ├── useMfaEnroll.ts
│       ├── useMfaConfirm.ts
│       ├── useMfaVerify.ts
│       └── useMfaRemove.ts
│
├── auth/
│   ├── store.ts             # Zustand — token + claims only
│   ├── SsoCallback.tsx      # /sso/callback page component
│   ├── StepUpDialog.tsx     # TOTP modal — AppShell level only
│   ├── useMutationWithStepUp.ts
│   ├── silentRefresh.ts     # iframe silent SSO re-auth
│   ├── broadcastLogout.ts   # BroadcastChannel multi-tab sync
│   ├── guards.tsx           # RequireAuth, RequireRole
│   └── parseClaims.ts       # JWT decode, no signature verify
│
├── components/
│   ├── ui/                  # shadcn/ui — owned in-repo
│   ├── DataTable.tsx        # TanStack Table + offset pagination
│   ├── VirtualTable.tsx     # TanStack Table + TanStack Virtual (48px rows)
│   ├── ErrorBoundary.tsx    # page AND widget level
│   ├── CorrelationToast.tsx
│   └── ConfirmDialog.tsx    # destructive action confirm
│
├── features/
│   ├── kyc-review/          # KycQueue (container), KycQueueTable (presentation), KycDecisionForm
│   ├── content-moderation/
│   ├── audit-log/           # uses VirtualTable
│   ├── feature-flags/
│   ├── platform-config/
│   ├── payouts/
│   ├── admin-accounts/
│   └── mfa-setup/           # MfaEnrollFlow, MfaQrCode (qrcode.react)
│
├── layouts/
│   └── AppShell.tsx         # sidebar + topbar + <Outlet/> + <StepUpDialog/>
│
├── pages/                   # thin — compose features only, no data fetching
│   ├── LoginPage.tsx
│   ├── KycQueuePage.tsx
│   ├── KycDetailPage.tsx
│   ├── ModerationQueuePage.tsx
│   ├── ModerationDetailPage.tsx
│   ├── AuditLogPage.tsx
│   ├── FeatureFlagsPage.tsx
│   ├── FeatureFlagDetailPage.tsx
│   ├── PlatformConfigPage.tsx
│   ├── PayoutOverridesPage.tsx
│   ├── IssueRefundPage.tsx
│   ├── AdminAccountsPage.tsx
│   ├── AdminDetailPage.tsx
│   ├── MySessionsPage.tsx
│   ├── MfaSetupPage.tsx
│   └── NotFoundPage.tsx
│
├── lib/
│   ├── enums.ts             # integer enum maps — see enums.md
│   ├── errorMessages.ts     # errorCode → user message — see error-codes.md
│   ├── permissions.ts       # role → allowed actions matrix
│   └── formatters.ts        # date/time/currency
│
├── env.ts                   # validates all env vars at startup
├── router.tsx               # full route tree
└── main.tsx                 # QueryClientProvider + RouterProvider + initBroadcastLogout()
```

## Route tree shape

```ts
createBrowserRouter([
  { path: '/login',        element: <LoginPage /> },
  { path: '/sso/callback', element: <SsoCallback /> },
  {
    element: <RequireAuth><AppShell /></RequireAuth>,
    children: [
      { index: true, element: <Navigate to="/kyc" replace /> },
      { path: '/kyc',             element: <RequireRole roles={['KycReviewer','SuperAdmin','Readonly']}><KycQueuePage /></RequireRole> },
      { path: '/kyc/:id',         element: <KycDetailPage /> },
      { path: '/moderation',      element: <ModerationQueuePage /> },
      { path: '/moderation/:id',  element: <ModerationDetailPage /> },
      { path: '/audit',           element: <AuditLogPage /> },
      { path: '/feature-flags',   element: <FeatureFlagsPage /> },
      { path: '/feature-flags/:key', element: <FeatureFlagDetailPage /> },
      { path: '/platform-config', element: <PlatformConfigPage /> },
      { path: '/payouts',         element: <PayoutOverridesPage /> },
      { path: '/refunds',         element: <IssueRefundPage /> },
      { path: '/admins',          element: <RequireRole roles={['SuperAdmin']}><AdminAccountsPage /></RequireRole> },
      { path: '/admins/:id',      element: <AdminDetailPage /> },
      { path: '/me/sessions',     element: <MySessionsPage /> },
      { path: '/settings/mfa',    element: <MfaSetupPage /> },
      { path: '*',                element: <NotFoundPage /> },
    ],
  },
])
```

## Naming conventions

| Artifact          | Convention             | Example                      |
|-------------------|------------------------|------------------------------|
| Component file    | PascalCase.tsx         | `KycQueueTable.tsx`          |
| Page file         | PascalCase + Page.tsx  | `KycQueuePage.tsx`           |
| Query hook        | usePascalCase.ts       | `useKycQueue.ts`             |
| Mutation hook     | usePascalCase.ts       | `useKycDecide.ts`            |
| Zustand store     | store.ts (per feature) | `auth/store.ts`              |
| Zod schema        | inline in Form file    |                              |
| Utility           | camelCase.ts           | `formatters.ts`              |

## Import alias

All internal imports use `@/` pointing to `src/`. No barrel `index.ts` in `features/`.
