import { api } from '../../api/client';
import type { PagedResult } from '../../api/paging';

// ---------------------------------------------------------------- returns (Orders VendorReturnsController)

export const ReturnState = { Submitted: 1, Approved: 2, Rejected: 3, Completed: 4 } as const;
export const returnStateLabel: Record<number, string> = { 1: 'New request', 2: 'Approved — awaiting item', 3: 'Rejected', 4: 'Completed' };
export const returnStateColor: Record<number, string> = { 1: 'amber', 2: 'blue', 3: 'gray', 4: 'forest' };

export interface ReturnItem {
  id: string;
  orderId: string;
  subOrderId: string;
  orderNumber: string;
  productTitleSnapshot: string;
  variantLabelSnapshot: string | null;
  thumbnailUrlSnapshot: string | null;
  quantity: number;
  reason: string;
  state: number;
  submittedUtc: string;
  resolvedUtc: string | null;
  rejectionNote: string | null;
  /** 1 Refund, 2 Replacement */
  resolution: number;
  evidence: { hasDiscrepancy: boolean; findings: { code: string; kind: string; statement: string }[] } | null;
}

// ---------------------------------------------------------------- warranties (VendorWarrantiesController, Vendor role)

export const ClaimState = {
  Submitted: 1,
  Approved: 2,
  Rejected: 3,
  RepairInProgress: 4,
  ReplacementInProgress: 5,
  Resolved: 6,
  Cancelled: 7,
} as const;
export const claimStateLabel: Record<number, string> = {
  1: 'New claim',
  2: 'Approved',
  3: 'Rejected',
  4: 'Repair in progress',
  5: 'Replacement in progress',
  6: 'Resolved',
  7: 'Cancelled',
};
export const claimStateColor: Record<number, string> = { 1: 'amber', 2: 'blue', 3: 'gray', 4: 'cyan', 5: 'cyan', 6: 'forest', 7: 'gray' };
export const issueKindLabel: Record<number, string> = {
  1: 'Manufacturing defect',
  2: 'Stopped working',
  3: 'Material failure',
  4: 'Missing part',
  5: 'Other',
};
export const resolutionKinds = [
  { value: '1', label: 'Repair' },
  { value: '2', label: 'Replace' },
  { value: '3', label: 'Refund' },
  { value: '4', label: 'Advice only' },
];

export interface WarrantyClaim {
  id: string;
  claimNumber: string;
  orderId: string;
  state: number;
  issueKind: number;
  description: string;
  evidenceUrls: string[];
  resolutionKind: number | null;
  decisionNote: string | null;
  submittedUtc: string;
  decidedUtc: string | null;
  resolvedUtc: string | null;
}

// ---------------------------------------------------------------- questions (Support ProductInquiriesController)

export const InquiryState = { Open: 1, Replied: 2, Expired: 3 } as const;

export interface Inquiry {
  id: string;
  productId: string | null;
  orderId: string | null;
  question: string;
  state: number;
  openedUtc: string;
  responseDeadlineUtc: string;
  reply: string | null;
  repliedUtc: string | null;
}

export const careApi = {
  returns: (state: number | null, cursor: string | null) =>
    api.get<PagedResult<ReturnItem>>('/v1/vendor/returns', { state: state ?? undefined, cursor: cursor ?? undefined, pageSize: 25 }),
  acceptReturn: (id: string) => api.post<unknown>(`/v1/vendor/returns/${id}/accept`),
  rejectReturn: (id: string, reason: string) => api.post<unknown>(`/v1/vendor/returns/${id}/reject`, { reason }),
  completeReturn: (id: string) => api.post<unknown>(`/v1/vendor/returns/${id}/complete`),

  claims: (state: number | null) => api.get<WarrantyClaim[]>('/v1/vendor/warranties/claims', { state: state ?? undefined }),
  decideClaim: (id: string, approve: boolean, resolutionKind: number | null, note: string | null) =>
    api.post<WarrantyClaim>(`/v1/vendor/warranties/claims/${id}/decision`, { approve, resolutionKind, note }),
  startClaim: (id: string) => api.post<WarrantyClaim>(`/v1/vendor/warranties/claims/${id}/start`),
  resolveClaim: (id: string, note: string | null) => api.post<WarrantyClaim>(`/v1/vendor/warranties/claims/${id}/resolve`, { note }),

  inquiries: (state: number | null, cursor: string | null) =>
    api.get<PagedResult<Inquiry>>('/v1/product-inquiries/vendor', { state: state ?? undefined, cursor: cursor ?? undefined, pageSize: 25 }),
  reply: (id: string, reply: string) => api.post<Inquiry>(`/v1/product-inquiries/${id}/reply`, { reply }),
};
