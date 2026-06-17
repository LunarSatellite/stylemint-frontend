import type { paths } from '@/api/schema'

type KycQueueFilter        = NonNullable<paths['/v1/admin/kyc/queue']['get']['parameters']['query']>
type ModerationQueueFilter = NonNullable<paths['/v1/admin/moderation/queue']['get']['parameters']['query']>

type AuditFilter  = Record<string, unknown>
type AdminFilter  = Record<string, unknown>
type PayoutFilter = Record<string, unknown>

export const qk = {
  me:         () => ['me'] as const,
  meSessions: () => ['me', 'sessions'] as const,
  meMfa:      () => ['me', 'mfa'] as const,
  kyc: {
    queue:  (f: KycQueueFilter)  => ['kyc', 'queue', f] as const,
    detail: (id: string)         => ['kyc', 'detail', id] as const,
  },
  moderation: {
    queue:  (f: ModerationQueueFilter) => ['mod', 'queue', f] as const,
    detail: (id: string)               => ['mod', 'detail', id] as const,
  },
  audit:   (f: AuditFilter)  => ['audit', f] as const,
  flags:   ()                => ['flags'] as const,
  flag:    (key: string)     => ['flags', key] as const,
  config:  ()                => ['config'] as const,
  admins:          (f: AdminFilter)  => ['admins', f] as const,
  admin:           (id: string)      => ['admins', id] as const,
  adminSessions:   (id: string)      => ['admins', id, 'sessions'] as const,
  payouts:         (f: PayoutFilter) => ['payouts', f] as const,
  payout:          (id: string)      => ['payouts', id] as const,
  privacyDashboard: ()               => ['privacy-dashboard'] as const,
}
