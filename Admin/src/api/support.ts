/** Returns queue (Admin SupportReturnsController) and support tickets (Support AdminSupportTicketsController). */
import { buildUrl, http } from './client';
import { toPage, type Page } from './paging';

export const RETURN_STATE: Record<number, string> = { 1: 'Submitted', 2: 'Approved', 3: 'Rejected', 4: 'Completed', 5: 'Cancelled' };
export const RETURN_TONE: Record<number, string> = { 1: 'amber', 2: 'blue', 3: 'signal', 4: 'forest', 5: 'gray' };
export const RETURN_RESOLUTION: Record<number, string> = { 1: 'Refund', 2: 'Replacement' };

export interface ReturnItem {
  id: string;
  orderId: string;
  orderNumber: string;
  subOrderId: string;
  vendorAccountId: string;
  customerAccountId: string;
  productTitleSnapshot: string;
  variantLabelSnapshot: string | null;
  thumbnailUrlSnapshot: string | null;
  quantity: number;
  reason: string;
  state: number;
  resolution: number;
  submittedUtc: string;
  resolvedUtc: string | null;
  rejectionNote: string | null;
  /** Return pickup by rider (return-pickup contract §4): strings, absent on older servers. */
  reasonCategory?: string | null;
  pickupFarePayer?: string | null;
  pickupStage?: string | null;
}

export interface ReturnEvidence {
  collectedUtc: string;
  hasEvidence: boolean;
  hasDiscrepancy: boolean;
  sources: { source: string; available: boolean; detail: string | null }[];
  facts: { source: string; key: string; label: string; value: string; observedUtc: string | null }[];
  findings: { code: string; kind: string; statement: string; sources: string[]; citedFactKeys: string[] }[];
}

export const TICKET_CATEGORY: Record<number, string> = {
  1: 'Orders & shipping',
  2: 'Returns & refunds',
  3: 'Account & settings',
  4: 'Payment & billing',
  5: 'Safety & privacy',
  6: 'For creators',
  7: 'For vendors',
  8: 'Delivery & couriers',
};
/** What DTOs carry. */
export const TICKET_VISIBLE_STATE: Record<number, string> = { 1: 'Submitted', 2: 'In progress', 3: 'Resolved' };
export const TICKET_VISIBLE_TONE: Record<number, string> = { 1: 'amber', 2: 'blue', 3: 'forest' };
/** What the filter accepts. */
export const TICKET_FILTER_STATE: Record<number, string> = { 1: 'Submitted', 2: 'In progress', 3: 'Waiting on user', 4: 'Resolved', 5: 'Closed' };
export const AUTHOR_KIND: Record<number, string> = { 1: 'Customer', 2: 'Agent', 3: 'System' };
export const COURIER_OUTCOME: Record<number, string> = { 1: 'Courier at fault', 2: 'No fault', 3: 'Buyer at fault', 4: 'Inconclusive' };
export const COURIER_FAULT: Record<number, string> = {
  1: 'Package not picked up',
  2: 'Package damaged in transit',
  3: 'Seal broken on arrival',
  4: 'Courier no-show',
  5: 'Courier misconduct',
  6: 'Tracking stuck',
  7: 'Delivered to the wrong address',
};
export const COURIER_REPORT: Record<number, string> = { 1: 'Buyer unreachable', 2: 'Address incorrect', 3: 'Package condition unclear', 4: 'Route unsafe' };

export interface TicketSummary {
  id: string;
  ticketNumber: string;
  category: number;
  subject: string;
  state: number;
  openedUtc: string;
  lastAgentReplyUtc: string | null;
}

export interface Ticket extends TicketSummary {
  resolvedUtc: string | null;
  orderId: string | null;
  subOrderId: string | null;
  returnRequestId: string | null;
  messages: { id: string; authorKind: number; authorDisplay: string; body: string; attachmentUrls: string[]; postedUtc: string }[];
  courierContext: {
    hopId: string;
    reporterKind: number;
    customerFaultReason: number | null;
    courierReportReason: number | null;
    resolutionOutcome: number;
    resolvedUtc: string | null;
  } | null;
}

const enc = encodeURIComponent;

export const returnsApi = {
  queue: async (state: string, page: number, pageSize: number, signal?: AbortSignal): Promise<Page<ReturnItem>> =>
    toPage<ReturnItem>(await http.get('/v1/admin/support/returns', { state: state || undefined, skip: (page - 1) * pageSize, take: pageSize }, signal), page, pageSize),
  evidence: (id: string, signal?: AbortSignal) => http.get<ReturnEvidence>(`/v1/admin/support/returns/${enc(id)}/evidence`, undefined, signal),
};

export const ticketsApi = {
  /** `state` repeats; the server defaults to Submitted + InProgress. take is at most 50. Oldest first. */
  list: async (states: number[], page: number, pageSize: number, signal?: AbortSignal): Promise<Page<TicketSummary>> => {
    const take = Math.min(50, pageSize);
    const url = buildUrl('/v1/admin/support/tickets', { state: states.length ? states : undefined, skip: (page - 1) * take, take });
    return toPage<TicketSummary>(await http.get(url, undefined, signal), page, take);
  },
  get: (ticketNumber: string, signal?: AbortSignal) => http.get<Ticket>(`/v1/admin/support/tickets/${enc(ticketNumber)}`, undefined, signal),
  reply: (ticketNumber: string, body: string) => http.post<Ticket>(`/v1/admin/support/tickets/${enc(ticketNumber)}/replies`, { body }),
  waitingOnUser: (ticketNumber: string) => http.post<Ticket>(`/v1/admin/support/tickets/${enc(ticketNumber)}/waiting-on-user`),
  resolve: (ticketNumber: string, body: { resolutionSummary?: string | null; courierResolutionOutcome?: number | null; courierResolutionNotes?: string | null }) =>
    http.post<Ticket>(`/v1/admin/support/tickets/${enc(ticketNumber)}/resolve`, body),
};
