# Enums — stylemint-creator-fe

Wire format is integers. Never use magic numbers anywhere in the codebase — always reference these constants.

## Definitions

```ts
// src/lib/enums.ts

export const StoryArcState = {
  Suggested: 1,
  Active:    2,
  Completed: 3,
  Dropped:   4,
} as const
export type StoryArcState = typeof StoryArcState[keyof typeof StoryArcState]

export const BoostOfferState = {
  Pending:  1,
  Accepted: 2,
  Expired:  3,
} as const
export type BoostOfferState = typeof BoostOfferState[keyof typeof BoostOfferState]

export const StitchedReelSuggestionState = {
  Issued:       1,
  Acknowledged: 2,
  Dismissed:    3,
} as const
export type StitchedReelSuggestionState = typeof StitchedReelSuggestionState[keyof typeof StitchedReelSuggestionState]

export const CreatorActivityKind = {
  Earnings:            1,
  ReelPublished:       2,
  PartnershipRequest:  3,
  PartnershipAccepted: 4,
  MilestoneAchieved:   5,
  PayoutCompleted:     6,
  PayoutFailed:        7,
  AccountSecurity:     8,
} as const
export type CreatorActivityKind = typeof CreatorActivityKind[keyof typeof CreatorActivityKind]

export const TopReelsSort = {
  HighestEarnings:   1,
  MostViewed:        2,
  HighestConversion: 3,
  MostEngagement:    4,
} as const
export type TopReelsSort = typeof TopReelsSort[keyof typeof TopReelsSort]
```

## Usage Rules

```ts
// CORRECT
if (offer.state === BoostOfferState.Accepted) { ... }

// WRONG — magic number
if (offer.state === 2) { ... }

// CORRECT — exhaustive switch with discriminated union
function getArcLabel(state: StoryArcState): string {
  switch (state) {
    case StoryArcState.Suggested:  return 'New'
    case StoryArcState.Active:     return 'In Progress'
    case StoryArcState.Completed:  return 'Done'
    case StoryArcState.Dropped:    return 'Dropped'
    default: {
      const _exhaustive: never = state
      return ''
    }
  }
}
```

## Score / Rate / Fraction Fields

All score, rate, and fraction fields from the API are in the `[0, 1]` range. Always multiply by 100 before display.

```ts
// API returns: { hookScore: 0.87, conversionRate: 0.042 }
formatPercent(data.hookScore)       // → "87.0%"
formatPercent(data.conversionRate)  // → "4.2%"
```

Do not store pre-multiplied values — always keep raw values from the API and multiply at render time.
