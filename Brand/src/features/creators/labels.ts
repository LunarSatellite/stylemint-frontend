/** Integer enums from the wire → words and badge colours. Unknown values never crash: they show "Unknown". */

export interface Look {
  label: string;
  color: string;
}

export function lookOf(map: Record<number, Look>, value: number | null | undefined): Look {
  return (value !== null && value !== undefined && map[value]) || { label: 'Unknown', color: 'gray' };
}

export const partnershipStateLook: Record<number, Look> = {
  1: { label: 'Invited', color: 'blue' },
  2: { label: 'Declined', color: 'gray' },
  3: { label: 'Active', color: 'forest' },
  4: { label: 'Paused', color: 'amber' },
  5: { label: 'Ended', color: 'slate' },
};

export const briefStateLook: Record<number, Look> = {
  1: { label: 'Draft', color: 'gray' },
  2: { label: 'Locked', color: 'forest' },
  3: { label: 'Retired', color: 'slate' },
};

export const applicationStateLook: Record<number, Look> = {
  1: { label: 'Waiting for you', color: 'amber' },
  2: { label: 'Withdrawn', color: 'gray' },
  3: { label: 'Accepted', color: 'forest' },
  4: { label: 'Declined', color: 'slate' },
};

export const retainerStateLook: Record<number, Look> = {
  1: { label: 'Waiting for creator', color: 'blue' },
  2: { label: 'Active', color: 'forest' },
  3: { label: 'Paused', color: 'amber' },
  4: { label: 'Ending', color: 'signal' },
  5: { label: 'Ended', color: 'slate' },
};

export const squadStateLook: Record<number, Look> = {
  1: { label: 'Drafting', color: 'gray' },
  2: { label: 'Recruiting', color: 'blue' },
  3: { label: 'Active', color: 'forest' },
  4: { label: 'Completed', color: 'slate' },
  5: { label: 'Cancelled', color: 'gray' },
};

export const reelApprovalStateLook: Record<number, Look> = {
  1: { label: 'Waiting for you', color: 'amber' },
  2: { label: 'Approved', color: 'forest' },
  3: { label: 'Changes asked', color: 'signal' },
  4: { label: 'Expired', color: 'gray' },
};

export const workspaceStateLook: Record<number, Look> = {
  1: { label: 'Draft', color: 'gray' },
  2: { label: 'Ready for approval', color: 'amber' },
  3: { label: 'Approved', color: 'blue' },
  4: { label: 'Live', color: 'forest' },
  5: { label: 'Paused', color: 'amber' },
  6: { label: 'Completed', color: 'slate' },
  7: { label: 'Cancelled', color: 'gray' },
};

export const insuranceStateLook: Record<number, Look> = {
  1: { label: 'Covered', color: 'forest' },
  2: { label: 'Claim filed', color: 'amber' },
  3: { label: 'Settled', color: 'slate' },
  4: { label: 'Expired', color: 'gray' },
  5: { label: 'Cancelled', color: 'gray' },
};

export const claimStateLook: Record<number, Look> = {
  1: { label: 'Filed', color: 'blue' },
  2: { label: 'Under review', color: 'amber' },
  3: { label: 'Approved', color: 'forest' },
  4: { label: 'Denied', color: 'signal' },
  5: { label: 'Paid', color: 'forest' },
};

export const campaignGoalLabel: Record<number, string> = {
  1: 'Win first purchases',
  2: 'Bring back past buyers',
  3: 'Launch a new variant',
  4: 'Clear slow stock',
  5: 'Seasonal awareness',
  6: 'Teach how to use it',
  7: 'Test a new audience',
};

/** 0.15 → "15%", 0.125 → "12.5%". Partnership commissions are fractions on the wire. */
export function pct(fraction: number | null | undefined): string {
  if (fraction === null || fraction === undefined || Number.isNaN(Number(fraction))) return '—';
  const v = Math.round(Number(fraction) * 1000) / 10;
  return `${v}%`;
}

/** "10–15%" or "12%" when min = max. */
export function commissionRange(min: number | null | undefined, max: number | null | undefined): string {
  if (min === null || min === undefined) return pct(max);
  if (max === null || max === undefined || Math.abs(min - max) < 0.0001) return pct(min);
  return `${pct(min).replace('%', '')}–${pct(max)}`;
}

/** Percent typed by a seller (15) → fraction for the API (0.15). */
export const toFraction = (percent: number) => Math.round(percent * 100) / 10000;

/** A short, stable fallback for a creator with no public profile: "Creator 3f2a". */
export function shortCreator(id: string | null | undefined): string {
  return id ? `Creator ${id.replace(/-/g, '').slice(0, 4)}` : 'Creator';
}

export function compactCount(n: number | null | undefined): string {
  if (n === null || n === undefined) return '—';
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0).replace(/\.0$/, '')}K`;
  return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
}

// ── Agreements ─────────────────────────────────────────────────────────────

export const agreementStatusLook: Record<number, Look> = {
  1: { label: 'Draft', color: 'gray' },
  2: { label: 'Sent for signature', color: 'blue' },
  3: { label: 'Partly signed', color: 'amber' },
  4: { label: 'Active', color: 'forest' },
  5: { label: 'Amendment pending', color: 'amber' },
  6: { label: 'Terminated', color: 'signal' },
  7: { label: 'Expired', color: 'slate' },
  8: { label: 'Declined', color: 'slate' },
  9: { label: 'Cancelled', color: 'gray' },
};

export const agreementVersionStatusLook: Record<number, Look> = {
  1: { label: 'Draft', color: 'gray' },
  2: { label: 'Waiting for signatures', color: 'blue' },
  3: { label: 'Signed', color: 'forest' },
  4: { label: 'Replaced', color: 'slate' },
  5: { label: 'Rejected', color: 'signal' },
  6: { label: 'Withdrawn', color: 'gray' },
};

export const agreementKindLabel: Record<number, string> = { 1: 'Partnership', 2: 'Retainer', 3: 'Campaign', 4: 'Brief' };

export const partyLabel: Record<number, string> = { 1: 'Your shop', 2: 'Creator', 3: 'StyleMint' };

export const agreementEventLabel: Record<number, string> = {
  1: 'Draft created',
  2: 'Draft edited',
  3: 'Sent for signature',
  4: 'Signed',
  5: 'Agreement in force',
  6: 'Declined',
  7: 'Withdrawn',
  8: 'Amendment proposed',
  9: 'Amendment rejected',
  10: 'Amendment withdrawn',
  11: 'Terminated',
  12: 'Expired',
  13: 'Expiry reminder sent',
  14: 'PDF downloaded',
};

export const contentApprovalLabel: Record<number, string> = {
  1: 'You approve every piece before it goes live',
  2: 'Creator posts at their discretion within the brief',
  3: 'You approve; silence for the review window counts as approval',
};

export const payoutScheduleLabel: Record<number, string> = {
  1: 'On completion',
  2: 'Weekly',
  3: 'Every two weeks',
  4: 'Monthly',
  5: 'By milestone',
};
