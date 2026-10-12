/**
 * Every cache key in the app, in one factory.
 *
 * Nothing constructs a key array inline. The reason is invalidation: a
 * mutation that writes `['kyc','queue',filter]` by hand and a query
 * that reads `['kyc', 'queue', filter]` look identical in review and
 * are the same key only by luck. When they drift, the write succeeds,
 * the list does not move, and the operator decides the same case twice.
 */

export interface KycQueueFilter {
  status?: string;
  assignedToMe?: boolean;
  page?: number;
  pageSize?: number;
}

export interface ModerationFilter {
  status?: string;
  kind?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditFilter {
  actorId?: string;
  action?: string;
  fromUtc?: string;
  toUtc?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminFilter {
  search?: string;
  role?: string;
  enabled?: boolean;
  page?: number;
  pageSize?: number;
}

export interface PayoutFilter {
  status?: string;
  vendorId?: string;
  page?: number;
  pageSize?: number;
}

export const qk = {
  me: () => ['me'] as const,
  meSessions: () => ['me', 'sessions'] as const,
  meMfa: () => ['me', 'mfa'] as const,
  kyc: {
    /** Prefix for invalidating every filtered view of the queue at once. */
    all: () => ['kyc'] as const,
    queue: (f: KycQueueFilter) => ['kyc', 'queue', f] as const,
    detail: (id: string) => ['kyc', 'detail', id] as const,
  },
  moderation: {
    all: () => ['mod'] as const,
    queue: (f: ModerationFilter) => ['mod', 'queue', f] as const,
    detail: (id: string) => ['mod', 'detail', id] as const,
  },
  audit: (f: AuditFilter) => ['audit', f] as const,
  flags: () => ['flags'] as const,
  flag: (key: string) => ['flags', key] as const,
  config: () => ['config'] as const,
  admins: (f: AdminFilter) => ['admins', f] as const,
  admin: (id: string) => ['admins', id] as const,
  payouts: (f: PayoutFilter) => ['payouts', f] as const,
} as const;

/**
 * How long each query may be served from cache without a refetch.
 *
 * The two review queues are the short ones on purpose: several
 * operators work them at the same time, and a stale row is a case two
 * people both pick up.
 */
export const staleTime = {
  kycQueue: 10_000,
  moderationQueue: 10_000,
  admins: 30_000,
  me: 30_000,
  payouts: 30_000,
  audit: 60_000,
  flags: 60_000,
  config: 60_000,
} as const;
