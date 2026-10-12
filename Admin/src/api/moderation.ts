/** Moderation queue - Admin ModerationController. Enums are numbers. */
import { http } from './client';
import { toPage, type Page } from './paging';

/** Product = 6 arrives with feat/admin-api-gaps: hide/remove on a product unpublishes it. */
export const TARGET_KIND: Record<number, string> = { 1: 'Reel', 2: 'Review', 3: 'Reel comment', 4: 'Profile', 5: 'Recommendation reply', 6: 'Product' };
export const MOD_STATE: Record<number, string> = { 1: 'Open', 2: 'In review', 3: 'Decided' };
export const MOD_STATE_TONE: Record<number, string> = { 1: 'amber', 2: 'blue', 3: 'gray' };
export const MOD_SOURCE: Record<number, string> = { 1: 'User report', 2: 'Automated scanner', 3: 'Admin spotted' };
export const MOD_ACTION: Record<number, string> = {
  1: 'No action',
  2: 'Hide content',
  3: 'Remove content',
  4: 'Warn author',
  5: 'Suspend author (7 days)',
  6: 'Ban author',
};
export const MOD_ACTION_TONE: Record<number, string> = { 1: 'gray', 2: 'amber', 3: 'signal', 4: 'amber', 5: 'signal', 6: 'signal' };
export const REPORT_REASON: Record<string, string> = {
  SPAM: 'Spam',
  NUDITY_OR_SEXUAL: 'Nudity or sexual content',
  HATE_OR_HARASSMENT: 'Hate or harassment',
  VIOLENCE: 'Violence',
  MISLEADING: 'Misleading',
  COUNTERFEIT_PRODUCT: 'Counterfeit product',
  OTHER: 'Other',
};

/**
 * Warn / suspend / ban act on an ACCOUNT id; on any target but a Profile they would be handed a content id and fail
 * silently on the server. Only offer them where they can work.
 */
export function actionsFor(targetKind: number): number[] {
  return targetKind === 4 ? [1, 2, 3, 4, 5, 6] : [1, 2, 3];
}

export interface ModerationItem {
  id: string;
  targetKind: number;
  targetId: string;
  source: number;
  reporterAccountId: string | null;
  reportReasonCode: string | null;
  state: number;
  assignedReviewerId: string | null;
  submittedUtc: string;
  decidedUtc: string | null;
  action: number | null;
  decisionNote: string | null;
}

export interface FraudSummary {
  summary: string;
  totalRiskScore: number;
  redFlags: string[];
  recommendedAction: string;
}

const enc = encodeURIComponent;

export const moderationApi = {
  queue: async (f: { targetKind?: string; state?: string; source?: string; page: number; pageSize: number }, signal?: AbortSignal): Promise<Page<ModerationItem>> =>
    toPage<ModerationItem>(
      await http.get(
        '/v1/admin/moderation/queue',
        { targetKind: f.targetKind || undefined, state: f.state || undefined, source: f.source || undefined, pageNumber: f.page, pageSize: f.pageSize },
        signal,
      ),
      f.page,
      f.pageSize,
    ),
  get: (id: string, signal?: AbortSignal) => http.get<ModerationItem>(`/v1/admin/moderation/${enc(id)}`, undefined, signal),
  assign: (id: string, reviewerAdminId: string) => http.post<ModerationItem>(`/v1/admin/moderation/${enc(id)}/assign`, { reviewerAdminId }),
  decide: (id: string, action: number, decisionNote: string | null) => http.post<ModerationItem>(`/v1/admin/moderation/${enc(id)}/decide`, { action, decisionNote }),
  fraudSummary: (accountId: string) => http.post<FraudSummary>(`/v1/admin/moderation/cases/${enc(accountId)}/fraud-summary`),
};

/** Decide, assigning to the caller first when the item is still Open (the server only decides InReview items). */
export async function decideModeration(item: Pick<ModerationItem, 'id' | 'state'>, me: string, action: number, note: string | null) {
  if (item.state === 1) await moderationApi.assign(item.id, me);
  return moderationApi.decide(item.id, action, note);
}
