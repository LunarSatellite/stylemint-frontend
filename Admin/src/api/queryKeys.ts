import type {
  KycCreatorQueueFilter,
  KycVendorQueueFilter,
  KycReviewQueueFilter,
  AudioTracksFilter,
  ModerationQueueFilter,
} from '@/api/schema'

type AuditFilter  = {
  adminAccountId?: string
  action?:         string
  targetKind?:     string
  targetId?:       string
  fromUtc?:        string
  toUtc?:          string
}
type AdminFilter  = Record<string, unknown>
type PayoutFilter = Record<string, unknown>

export const qk = {
  me:         () => ['me'] as const,
  meSessions: () => ['me', 'sessions'] as const,
  meMfa:      () => ['me', 'mfa'] as const,
  kyc: {
    creatorQueue: (f: KycCreatorQueueFilter) => ['kyc', 'creator', 'queue', f] as const,
    vendorQueue:  (f: KycVendorQueueFilter)  => ['kyc', 'vendor', 'queue', f] as const,
    queue:        (f: KycReviewQueueFilter)  => ['kyc', 'queue', f] as const,
    detail:       (id: string)               => ['kyc', 'detail', id] as const,
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
  audio:             (f: AudioTracksFilter) => ['audio', 'tracks', f] as const,
  audioTrack:        (id: string)           => ['audio', 'tracks', id] as const,
  socialFeedReports: (take?: number)        => ['social-feed', 'reports', take] as const,
  policyAlerts:      ()                     => ['policy-alerts'] as const,
}
