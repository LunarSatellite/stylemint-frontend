/** Test fixtures for the Creators area. Test-only. */
import { screen } from '@testing-library/react';

export function page<T>(items: T[], extra: Partial<{ nextCursor: string | null; totalCount: number }> = {}) {
  return { body: { items, totalCount: extra.totalCount ?? items.length, nextCursor: extra.nextCursor ?? null, previousCursor: null, pageSize: 25, hasMore: !!extra.nextCursor } };
}

export function partnership(patch: Record<string, unknown> = {}) {
  return {
    id: 'p-1',
    vendorProfileId: 'v-1',
    creatorProfileId: 'c-1',
    state: 3,
    commissionMinPercent: 0.1,
    commissionMaxPercent: 0.15,
    activeTermsVersionId: 't-1',
    invitedUtc: '2026-09-01T05:00:00Z',
    respondedUtc: '2026-09-02T05:00:00Z',
    endedUtc: null,
    endReason: null,
    brandBriefId: null,
    brandBriefVersion: null,
    initiatedByCreator: false,
    requestMessage: null,
    creatorName: 'Sita Creator',
    creatorHandle: 'sita.styles',
    creatorLogoUrl: null,
    creatorAccountId: 'c-1',
    createdUtc: '2026-09-01T05:00:00Z',
    updatedUtc: '2026-09-02T05:00:00Z',
    rowVersion: '1',
    ...patch,
  };
}

export const HASH = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';

export function terms(patch: Record<string, unknown> = {}) {
  return {
    scopeDescription: 'Dashain collection on StyleMint reels',
    productIds: [],
    collectionIds: [],
    commissionRateMin: 0.1,
    commissionRateMax: 0.15,
    fixedFeeAmount: 5000,
    currency: 'NPR',
    deliverables: [{ description: 'Styling reel', quantity: 2, platform: 'StyleMint', dueDate: '2026-11-01' }],
    contentApproval: 1,
    contentApprovalWindowHours: null,
    usageRights: 'Repost on brand channels',
    usageRightsDays: 90,
    paidAdsUsageAllowed: false,
    exclusive: false,
    exclusivityScope: null,
    exclusivityDays: null,
    paymentTermsDays: 15,
    payoutSchedule: 4,
    terminationNoticeDays: 7,
    cancellationTerms: null,
    governingLaw: 'Nepal',
    disputeVenue: 'Kathmandu, Nepal',
    additionalTerms: null,
    effectiveFromUtc: null,
    expiresAtUtc: '2027-03-01T00:00:00Z',
    ...patch,
  };
}

/**
 * `AgreementDetailDto` on the wire: `{ agreement, versions, acceptances, timeline }`. Tests write it flat
 * (summary fields, `versions` with their `acceptances`, `events`, `vendorAccepted`) — this reshapes it.
 */
export function agreement(patch: Record<string, unknown> = {}) {
  const flat = flatAgreement(patch);
  const { versions, events, vendorAccepted, creatorAccepted, ...summary } = flat;
  const vs = versions as { versionNumber: number; termsHash: string; status: number; acceptances?: unknown[] }[];
  const current = vs.find((v) => v.versionNumber === summary.currentVersion) ?? vs[0];
  return {
    agreement: {
      ...summary,
      vendorAccountId: 'v-1',
      creatorProfileId: null,
      currentTermsHash: current?.termsHash ?? '',
      currentVersionStatus: current?.status ?? 1,
      vendorAcceptedCurrent: vendorAccepted,
      creatorAcceptedCurrent: creatorAccepted,
      awaitingParties: [],
    },
    versions: vs.map((v) => {
      const { acceptances: _a, ...rest } = v;
      return { ...rest, id: `ver-${v.versionNumber}`, templateId: null, createdUtc: '2026-10-13T05:00:00Z' };
    }),
    acceptances: vs.flatMap((v) => v.acceptances ?? []),
    timeline: events,
    templateReviewedByLegal: false,
  };
}

/** A list row (`AgreementSummaryDto`). */
export function summary(patch: Record<string, unknown> = {}) {
  return agreement(patch).agreement;
}

function flatAgreement(patch: Record<string, unknown>) {
  return {
    id: 'ag-1',
    agreementNumber: 'SMA-2026-000123',
    kind: 1,
    title: 'Partnership agreement — Sita Creator',
    partnershipId: 'p-1',
    retainerId: null,
    referenceId: null,
    vendorName: 'Kathmandu Threads',
    creatorAccountId: 'c-1',
    creatorName: 'Sita Creator',
    creatorHandle: 'sita.styles',
    status: 1,
    currentVersion: 1,
    activeVersion: null,
    effectiveFromUtc: null,
    expiresAtUtc: '2027-03-01T00:00:00Z',
    sentUtc: null,
    activatedUtc: null,
    endedUtc: null,
    endedByParty: null,
    endReason: null,
    createdUtc: '2026-10-13T05:00:00Z',
    updatedUtc: '2026-10-13T05:00:00Z',
    vendorAccepted: false,
    creatorAccepted: false,
    versions: [
      {
        versionNumber: 1,
        status: 1,
        terms: terms(),
        renderedText: 'CREATOR PARTNERSHIP AGREEMENT\n\nThis agreement is governed by the laws of Nepal.',
        termsHash: HASH,
        templateName: 'Nepal creator agreement',
        templateVersion: 1,
        amendmentReason: null,
        sentUtc: null,
        acceptedUtc: null,
        closedUtc: null,
        acceptances: [],
      },
    ],
    events: [{ type: 1, actorParty: 1, actorAccountId: 'v-1', versionNumber: 1, note: null, occurredUtc: '2026-10-13T05:00:00Z' }],
    ...patch,
  };
}

/** The open dialog whose content contains this text. */
export async function dialogWith(text: string | RegExp): Promise<HTMLElement> {
  const nodes = await screen.findAllByText(text);
  for (const n of nodes) {
    const d = n.closest('[role="dialog"]');
    if (d) return d as HTMLElement;
  }
  throw new Error(`No dialog containing ${String(text)}`);
}
