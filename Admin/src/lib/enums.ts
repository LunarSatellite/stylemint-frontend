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

export const PayoutState = {
  Pending:  1,
  OnHold:   2,
  Paid:     3,
  Failed:   4,
} as const
