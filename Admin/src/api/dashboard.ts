/**
 * `GET /v1/admin/dashboard/summary` (wt/admin-api-contract.md §3, feat/admin-api-gaps). Any admin role; cached 60 s
 * on the server. A source that fails comes back as null - render "—". Until the endpoint is deployed the request is
 * a bare 404 and the dashboard counts the queues itself from the list endpoints.
 */
import { http } from './client';
import { ApiError } from './errors';

export interface Money {
  amount: number;
  currency: string;
}

export interface SummaryWindow {
  fromUtc: string;
  orders: number | null;
  gmv: Money | null;
  newCustomers: number | null;
  newVendors: number | null;
}

export interface DashboardSummary {
  generatedUtc: string;
  cacheSeconds: number;
  timeZone: string;
  windows: { today: SummaryWindow | null; last7d: SummaryWindow | null; last30d: SummaryWindow | null } | null;
  queues: {
    kycPending: { vendor: number; creator: number; customer: number; courier: number; total: number; overdue: number } | null;
    couriersAwaitingReview: number | null;
    moderationOpen: number | null;
    openReturns: number | null;
    openTickets: number | null;
    stuckDeliveries: { awaitingCourier: number; noProgress24h: number; failed: number; total: number } | null;
    payoutsPending: { requested: number; processing: number; held: number; amount: Money } | null;
  } | null;
}

export const dashboardApi = {
  /** null = the endpoint is not on this server yet. */
  summary: async (signal?: AbortSignal): Promise<DashboardSummary | null> => {
    try {
      return await http.get<DashboardSummary>('/v1/admin/dashboard/summary', undefined, signal);
    } catch (error) {
      if (error instanceof ApiError && error.isMissingEndpoint) return null;
      throw error;
    }
  },
};
