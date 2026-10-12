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
