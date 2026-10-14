/** Virtual try-on: premium access the admins control - settings, plans (the price), subscribers, usage. */
import { http } from './client';
import { toPage, type Page } from './paging';

const enc = encodeURIComponent;

export interface TryOnSettings {
  enabled: boolean;
  freeForEveryone: boolean;
  /** 0..30 */
  freeTrialDays: number;
  /** ≤ 500 */
  disclaimer: string;
  updatedUtc: string;
}
export type TryOnSettingsBody = Omit<TryOnSettings, 'updatedUtc'>;

export interface TryOnPlanBody {
  name: string;
  description: string | null;
  priceAmount: number;
  currency: string;
  durationDays: number;
  isActive: boolean;
  sortOrder: number;
}
export interface TryOnPlan extends TryOnPlanBody {
  id: string;
  isArchived: boolean;
  createdUtc: string;
}

export interface TryOnSubscription {
  id: string;
  accountId: string;
  accountDisplayName: string | null;
  planId: string | null;
  planName: string | null;
  source: number;
  state: number;
  startsUtc: string | null;
  expiresUtc: string | null;
  priceAmount: number;
  currency: string;
  paymentIntentId: string | null;
  note: string | null;
  createdUtc: string;
}

export interface TryOnUsage {
  fromUtc: string;
  toUtc: string;
  sessions: number;
  uniqueUsers: number;
  activeSubscribers: number;
  revenueAmount: number;
  currency: string;
  byDay: { date: string; sessions: number; newSubscriptions: number }[];
  topProducts: { productId: string; name: string; sessions: number }[];
}

export const SUBSCRIPTION_STATE: Record<number, string> = { 1: 'Pending payment', 2: 'Active', 3: 'Expired', 4: 'Cancelled', 5: 'Revoked' };
export const SUBSCRIPTION_TONE: Record<number, string> = { 1: 'amber', 2: 'forest', 3: 'gray', 4: 'gray', 5: 'signal' };
export const ACCESS_SOURCE: Record<number, string> = { 1: 'Free for everyone', 2: 'Trial', 3: 'Subscription', 4: 'Admin grant' };

export const tryOnApi = {
  settings: (signal?: AbortSignal) => http.get<TryOnSettings>('/v1/admin/try-on/settings', undefined, signal),
  saveSettings: (body: TryOnSettingsBody) => http.put<TryOnSettings>('/v1/admin/try-on/settings', body),

  plans: (signal?: AbortSignal) => http.get<TryOnPlan[]>('/v1/admin/try-on/plans', undefined, signal),
  createPlan: (body: TryOnPlanBody) => http.post<TryOnPlan>('/v1/admin/try-on/plans', body),
  updatePlan: (id: string, body: TryOnPlanBody) => http.put<TryOnPlan>(`/v1/admin/try-on/plans/${enc(id)}`, body),
  archivePlan: (id: string) => http.post<TryOnPlan>(`/v1/admin/try-on/plans/${enc(id)}/archive`),

  subscriptions: async (f: { state?: string; cursor: string | null; page: number; pageSize: number }, signal?: AbortSignal): Promise<Page<TryOnSubscription>> => {
    const size = Math.min(100, f.pageSize);
    return toPage<TryOnSubscription>(await http.get('/v1/admin/try-on/subscriptions', { state: f.state || undefined, cursor: f.cursor || undefined, pageSize: size }, signal), f.page, size);
  },
  grant: (body: { accountId: string; days: number; note: string | null }) => http.post<TryOnSubscription>('/v1/admin/try-on/grants', body),
  revoke: (id: string, reason: string) => http.post<TryOnSubscription>(`/v1/admin/try-on/subscriptions/${enc(id)}/revoke`, { reason }),

  usage: (range: { fromUtc?: string; toUtc?: string }, signal?: AbortSignal) =>
    http.get<TryOnUsage>('/v1/admin/try-on/usage', { fromUtc: range.fromUtc || undefined, toUtc: range.toUtc || undefined }, signal),
};
