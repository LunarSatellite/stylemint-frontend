export const permissions = {
  canReviewKyc:       (r: string[]) => r.some((x) => ['SuperAdmin', 'KycReviewer'].includes(x)),
  canModerateContent: (r: string[]) => r.some((x) => ['SuperAdmin', 'ContentMod'].includes(x)),
  canManagePayouts:   (r: string[]) => r.some((x) => ['SuperAdmin', 'PayoutsOps'].includes(x)),
  canManageAdmins:    (r: string[]) => r.includes('SuperAdmin'),
  canManageFlags:     (r: string[]) => r.some((x) => ['SuperAdmin', 'SupportAgent'].includes(x)),
  canManageConfig:        (r: string[]) => r.includes('SuperAdmin'),
  canIssueRefunds:        (r: string[]) => r.some((x) => ['SuperAdmin', 'PayoutsOps'].includes(x)),
  canViewPrivacyDashboard:(r: string[]) => r.includes('SuperAdmin'),
}
