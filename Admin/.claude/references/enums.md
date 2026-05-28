# Enums — stylemint-admin-fe

Wire format is integers. Never use magic numbers in components.

```ts
// src/lib/enums.ts
export const AdminRole = {
  SuperAdmin:   1,
  KycReviewer:  2,
  ContentMod:   3,
  SupportAgent: 4,
  PayoutsOps:   5,
  Readonly:     6,
} as const

export const KycState = {
  Pending:  1,
  Approved: 2,
  Rejected: 3,
} as const

export const AdminAccountState = {
  Active:   1,
  Disabled: 2,
} as const
```

## Usage rules

- Always import from `@/lib/enums` — never re-declare locally
- Use `Object.values(AdminRole)` when building select options
- Use the constant (`KycState.Pending`) when comparing, not the literal `1`
- If the API adds a new enum value not in this file, add it here and update the schema

## Display labels

```ts
// src/lib/formatters.ts
export const KycStateLabel: Record<number, string> = {
  [KycState.Pending]:  'Pending',
  [KycState.Approved]: 'Approved',
  [KycState.Rejected]: 'Rejected',
}

export const AdminRoleLabel: Record<number, string> = {
  [AdminRole.SuperAdmin]:   'Super Admin',
  [AdminRole.KycReviewer]:  'KYC Reviewer',
  [AdminRole.ContentMod]:   'Content Moderator',
  [AdminRole.SupportAgent]: 'Support Agent',
  [AdminRole.PayoutsOps]:   'Payouts Ops',
  [AdminRole.Readonly]:     'Read Only',
}
```
