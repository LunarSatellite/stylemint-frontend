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
