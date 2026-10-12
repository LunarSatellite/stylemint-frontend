/**
 * The wire format is integers. Nothing in a component may compare
 * against a bare `1`.
 *
 * `KycApplicantKind` and `KycDecision` are not in the written brief but
 * are in the API: the queue returns both, and a review screen that
 * cannot tell a creator application from a vendor one is showing the
 * reviewer the wrong evidence. Values confirmed against
 * `swagger-spec.json` rather than assumed.
 */

export const AdminRole = {
  SuperAdmin: 1,
  KycReviewer: 2,
  ContentMod: 3,
  SupportAgent: 4,
  PayoutsOps: 5,
  Readonly: 6,
} as const;
export type AdminRole = (typeof AdminRole)[keyof typeof AdminRole];

/** `KycReviewState` on the wire. */
export const KycState = {
  Pending: 1,
  Approved: 2,
  Rejected: 3,
} as const;
export type KycState = (typeof KycState)[keyof typeof KycState];

export const KycApplicantKind = {
  Creator: 1,
  Vendor: 2,
} as const;
export type KycApplicantKind = (typeof KycApplicantKind)[keyof typeof KycApplicantKind];

export const AdminAccountState = {
  Active: 1,
  Disabled: 2,
} as const;
export type AdminAccountState = (typeof AdminAccountState)[keyof typeof AdminAccountState];

/**
 * Moderation, read from the backend's own enum files rather than from
 * swagger: the generated spec lists `ModerationTargetKind` as 1-4 and
 * the source has a fifth, `RecommendationReply`. A spec can lag; the
 * enum the server switches on cannot.
 */
export const ModerationItemState = {
  Open: 1,
  InReview: 2,
  Decided: 3,
} as const;
export type ModerationItemState =
  (typeof ModerationItemState)[keyof typeof ModerationItemState];

export const ModerationTargetKind = {
  Reel: 1,
  Review: 2,
  ReelComment: 3,
  Profile: 4,
  RecommendationReply: 5,
} as const;
export type ModerationTargetKind =
  (typeof ModerationTargetKind)[keyof typeof ModerationTargetKind];

export const ModerationSource = {
  UserReport: 1,
  AutomatedScanner: 2,
  AdminSpot: 3,
} as const;
export type ModerationSource = (typeof ModerationSource)[keyof typeof ModerationSource];

export const ModerationAction = {
  NoAction: 1,
  HideContent: 2,
  RemoveContent: 3,
  WarnAuthor: 4,
  SuspendAuthor: 5,
  BanAuthor: 6,
} as const;
export type ModerationAction = (typeof ModerationAction)[keyof typeof ModerationAction];

/** A rejection has two flavours, and they mean different things to the applicant. */
export const KycDecision = {
  Approved: 1,
  RejectedRetryable: 2,
  RejectedTerminal: 3,
} as const;
export type KycDecision = (typeof KycDecision)[keyof typeof KycDecision];

/**
 * Audio track state, from `Modules.Audio/Enums/MusicTrackRefState.cs`.
 *
 * `LinksBroken` is set by a daily health check when every source link
 * for a track has gone: the track stops surfacing until someone fixes
 * or retires it. It is not the same as `Hidden`, which is a deliberate
 * decision, usually a rights-holder complaint. A queue that conflates
 * them mixes "this broke" with "we took this down", and only one of
 * those is anybody's to fix.
 */
export const MusicTrackState = {
  Active: 1,
  Hidden: 2,
  LinksBroken: 3,
} as const;
export type MusicTrackState = (typeof MusicTrackState)[keyof typeof MusicTrackState];

/** Courier lifecycle, from `CourierProfileState.cs`. */
export const CourierProfileState = {
  Applied: 1,
  KycInReview: 2,
  Rejected: 3,
  Onboarded: 4,
  Active: 5,
  Suspended: 6,
  Banned: 7,
} as const;
export type CourierProfileState =
  (typeof CourierProfileState)[keyof typeof CourierProfileState];

/** `DeliveryTier.cs`. Pro is the highest, Neighbor the entry level. */
export const DeliveryTier = {
  Pro: 1,
  Traveler: 2,
  Neighbor: 3,
} as const;
export type DeliveryTier = (typeof DeliveryTier)[keyof typeof DeliveryTier];

export const VehicleKind = {
  Foot: 1,
  Bicycle: 2,
  Motorcycle: 3,
  Car: 4,
  Van: 5,
} as const;
export type VehicleKind = (typeof VehicleKind)[keyof typeof VehicleKind];
