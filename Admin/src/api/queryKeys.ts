import type { KycQueueFilter } from '@/types/kyc'
import type { ModerationQueueFilter } from '@/types/moderation'

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
  admins:  (f: AdminFilter)  => ['admins', f] as const,
  admin:   (id: string)      => ['admins', id] as const,
  payouts: (f: PayoutFilter) => ['payouts', f] as const,
}
