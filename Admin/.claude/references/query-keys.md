# Query Keys + staleTime — stylemint-admin-fe

## Query key factory

```ts
// src/api/queryKeys.ts — always import qk, never construct arrays inline
export const qk = {
  me:         () => ['me'] as const,
  meSessions: () => ['me','sessions'] as const,
  meMfa:      () => ['me','mfa'] as const,
  kyc: {
    queue:  (f: KycQueueFilter) => ['kyc','queue',f] as const,
    detail: (id: string)        => ['kyc','detail',id] as const,
  },
  moderation: {
    queue:  (f: ModFilter) => ['mod','queue',f] as const,
    detail: (id: string)   => ['mod','detail',id] as const,
  },
  audit:   (f: AuditFilter)   => ['audit',f] as const,
  flags:   ()                 => ['flags'] as const,
  flag:    (key: string)      => ['flags',key] as const,
  config:  ()                 => ['config'] as const,
  admins:  (f: AdminFilter)   => ['admins',f] as const,
  admin:   (id: string)       => ['admins',id] as const,
  payouts: (f: PayoutFilter)  => ['payouts',f] as const,
}
```

## staleTime per query — do not deviate

| Query              | staleTime    | Reason                          |
|--------------------|--------------|---------------------------------|
| KYC queue          | **10 000 ms**| Multiple concurrent reviewers   |
| Moderation queue   | **10 000 ms**| Multiple concurrent reviewers   |
| Admin accounts     | 30 000 ms    |                                 |
| me / meSessions / meMfa | 30 000 ms |                            |
| Audit log          | 60 000 ms    |                                 |
| Feature flags      | 60 000 ms    |                                 |
| Platform config    | 60 000 ms    |                                 |
| Payouts            | 30 000 ms    |                                 |

## Global QueryClient defaults

```ts
// src/main.tsx
new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, err: any) => {
        const s = err?.response?.status
        if ([401, 403, 404].includes(s)) return false
        return count < 2
      },
      staleTime: 30_000,
    },
  },
})
```

## Mutation → invalidation map

| Mutation                      | Invalidate                                           |
|-------------------------------|------------------------------------------------------|
| KYC assign                    | `qk.kyc.queue(*)` + `qk.kyc.detail(id)`             |
| KYC decide                    | `qk.kyc.queue(*)` + `qk.kyc.detail(id)`             |
| Moderation assign/decide      | `qk.moderation.queue(*)` + `qk.moderation.detail(id)` |
| Feature flag upsert/override  | `qk.flags()` + `qk.flag(key)`                       |
| Platform config set           | `qk.config()`                                        |
| Grant/revoke role             | `qk.admin(id)` + `qk.admins(*)`                     |
| Disable/enable admin          | `qk.admin(id)` + `qk.admins(*)`                     |
| Force revoke sessions         | `qk.meSessions()` (if own) or `qk.admin(id)`        |
| MFA enroll/confirm/remove     | `qk.meMfa()`                                         |
| Payout hold/release/force     | `qk.payouts(*)`                                      |
