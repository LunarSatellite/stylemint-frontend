// DEV ONLY — Scenario B seed data: KYC Review is a SEPARATE system from application approval
// The applicationState column shows the linked application is independently managed.
// Remove once backend confirms scenario.

import type { KycReviewItemDto } from '@/api/schema'
import { KycReviewState, KycApplicantKind, KycDecision, ApplicationState } from '@/lib/enums'

type KycReviewItem = KycReviewItemDto

// Extended type for Scenario B — adds the linked application's current state so the
// UI can illustrate they are tracked independently.
export type KycReviewItemB = KycReviewItem & { _appState: number }

export const KYC_REVIEW_SEED_B: KycReviewItemB[] = [
  {
    // Review is Pending — but the linked application is ALREADY Approved in the
    // Onboarding system. Shows the two systems are independent.
    id:                 'b1b2c3d4-0001-0000-0000-000000000001',
    applicantKind:      KycApplicantKind.Creator,
    applicationId:      'app-b001-0000-0000-000000000001',
    accountId:          'acc-b001-0000-0000-000000000001',
    state:              KycReviewState.Pending,
    assignedReviewerId: null,
    submittedUtc:       '2026-06-16T08:00:00Z',
    dueByUtc:           '2026-06-22T23:59:00Z',
    decidedUtc:         null,
    decision:           null,
    decisionReasonCode: null,
    decisionNote:       null,
    rowVersion:         null,
    _appState:          ApplicationState.Approved, // application already approved separately
  },
  {
    // Review is Pending + overdue — linked application is still Submitted.
    id:                 'b1b2c3d4-0002-0000-0000-000000000002',
    applicantKind:      KycApplicantKind.Vendor,
    applicationId:      'app-b002-0000-0000-000000000002',
    accountId:          'acc-b002-0000-0000-000000000002',
    state:              KycReviewState.Pending,
    assignedReviewerId: null,
    submittedUtc:       '2026-06-13T10:00:00Z',
    dueByUtc:           '2026-06-18T23:59:00Z', // overdue
    decidedUtc:         null,
    decision:           null,
    decisionReasonCode: null,
    decisionNote:       null,
    rowVersion:         null,
    _appState:          ApplicationState.Submitted,
  },
  {
    // Review is InReview — but application is already Rejected. Shows both can
    // be in completely different states at the same time.
    id:                 'b1b2c3d4-0003-0000-0000-000000000003',
    applicantKind:      KycApplicantKind.Creator,
    applicationId:      'app-b003-0000-0000-000000000003',
    accountId:          'acc-b003-0000-0000-000000000003',
    state:              KycReviewState.InReview,
    assignedReviewerId: 'rev-admin-0000-0000-000000000099',
    submittedUtc:       '2026-06-15T14:00:00Z',
    dueByUtc:           '2026-06-21T23:59:00Z',
    decidedUtc:         null,
    decision:           null,
    decisionReasonCode: null,
    decisionNote:       null,
    rowVersion:         null,
    _appState:          ApplicationState.Rejected, // application rejected but review still ongoing
  },
  {
    // Review Decided (Approved) — application is UnderReview (not yet approved).
    id:                 'b1b2c3d4-0004-0000-0000-000000000004',
    applicantKind:      KycApplicantKind.Vendor,
    applicationId:      'app-b004-0000-0000-000000000004',
    accountId:          'acc-b004-0000-0000-000000000004',
    state:              KycReviewState.Decided,
    assignedReviewerId: 'rev-admin-0000-0000-000000000099',
    submittedUtc:       '2026-06-11T09:00:00Z',
    dueByUtc:           '2026-06-16T23:59:00Z',
    decidedUtc:         '2026-06-15T11:30:00Z',
    decision:           KycDecision.Approved,
    decisionReasonCode: null,
    decisionNote:       'Identity documents verified.',
    rowVersion:         null,
    _appState:          ApplicationState.UnderReview, // still waiting on app approval
  },
  {
    // Review Decided (Rejected Terminal) — application is Submitted (not yet touched).
    id:                 'b1b2c3d4-0005-0000-0000-000000000005',
    applicantKind:      KycApplicantKind.Creator,
    applicationId:      'app-b005-0000-0000-000000000005',
    accountId:          'acc-b005-0000-0000-000000000005',
    state:              KycReviewState.Decided,
    assignedReviewerId: 'rev-admin-0000-0000-000000000099',
    submittedUtc:       '2026-06-10T08:00:00Z',
    dueByUtc:           '2026-06-15T23:59:00Z',
    decidedUtc:         '2026-06-14T10:00:00Z',
    decision:           KycDecision.RejectedTerminal,
    decisionReasonCode: 'SANCTIONS_HIT',
    decisionNote:       'OFAC sanctions match. Permanent block.',
    rowVersion:         null,
    _appState:          ApplicationState.Submitted,
  },
]
