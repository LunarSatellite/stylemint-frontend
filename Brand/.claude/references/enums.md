# Enums — stylemint-brand-fe

Wire format is integers. Never use magic numbers.

```ts
// src/lib/enums.ts
export const CampaignGoal = {
  DriveFirstPurchase:     1,
  ReintroduceDormant:     2,
  LaunchNewVariant:       3,
  ClearSlowInventory:     4,
  BuildSeasonalAwareness: 5,
  EducateOnUse:           6,
  TestNewAudience:        7,
} as const

export const BrandBriefState = {
  Draft:   1,
  Locked:  2,
  Retired: 3,
} as const

export const GoalTemplateState = {
  Active:     1,
  Superseded: 2,
  Retired:    3,
} as const

export const VendorActivityKind = {
  OrderReceived:     1,
  OrderShipped:      2,
  OrderDelivered:    3,
  OrderCancelled:    4,
  ProductAdded:      5,
  ProductUpdated:    6,
  ProductOutOfStock: 7,
  InventoryLowAlert: 8,
  PayoutReceived:    9,
  PayoutFailed:      10,
  CustomerInquiry:   11,
  PartnershipRequest:12,
  PartnershipEnded:  13,
} as const
```

Commission and rate fields from the API are fractions `[0,1]`. Multiply by 100 for display. Never send `30` when the API expects `0.30`.
