/**
 * Admin roles (StyleMint.Modules.Admin/Enums/AdminRole.cs) and what each screen and action needs.
 *
 * These decide what the console OFFERS - which menu entries, which buttons. They do not secure anything: every
 * endpoint authorises again on the server from its own `[RequireAdminRole]`, and these lists are copied from those
 * attributes so the console never offers what the server will refuse. Never check a role string inline; add a
 * capability here.
 */
export const ADMIN_ROLES = ['SuperAdmin', 'KycReviewer', 'ContentMod', 'SupportAgent', 'PayoutsOps', 'Readonly'] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ROLE_LABELS: Record<AdminRole, string> = {
  SuperAdmin: 'Super admin',
  KycReviewer: 'KYC reviewer',
  ContentMod: 'Content moderator',
  SupportAgent: 'Support agent',
  PayoutsOps: 'Payouts operations',
  Readonly: 'Read-only',
};

const ALL: readonly AdminRole[] = ADMIN_ROLES;
const SA = ['SuperAdmin'] as const;

/** capability -> roles that hold it */
export const CAPABILITIES = {
  // dashboard
  viewDashboard: ALL,

  // KYC
  viewKyc: ['SuperAdmin', 'KycReviewer', 'Readonly'],
  decideKyc: ['SuperAdmin', 'KycReviewer'],

  // riders (couriers)
  viewRiders: ['SuperAdmin', 'KycReviewer', 'Readonly'],
  manageRiders: ['SuperAdmin', 'KycReviewer'],
  suspendRiders: SA,
  promoteRiders: SA,
  recomputeReliability: ['SuperAdmin', 'SupportAgent'],
  riderEscrow: ['SuperAdmin', 'PayoutsOps'],

  // vendors
  viewVendors: ALL,
  suspendVendors: ['SuperAdmin', 'SupportAgent'],
  /** The onboarding application list (Onboarding AdminKycController) is KycReviewer-only. */
  viewVendorApplications: ['SuperAdmin', 'KycReviewer'],
  verifyVendors: ['SuperAdmin', 'KycReviewer'],

  // orders & payments
  viewOrders: ['SuperAdmin', 'SupportAgent', 'PayoutsOps', 'Readonly'],
  archiveOrders: ['SuperAdmin', 'PayoutsOps'],
  refund: ['SuperAdmin', 'PayoutsOps'],
  orderCare: ['SuperAdmin', 'SupportAgent'],

  // products
  viewProducts: ['SuperAdmin', 'ContentMod', 'SupportAgent', 'KycReviewer', 'Readonly'],
  moderateProducts: ['SuperAdmin', 'ContentMod'],

  // customers
  viewCustomers: ['SuperAdmin', 'SupportAgent', 'Readonly'],
  suspendCustomers: ['SuperAdmin', 'SupportAgent'],

  // support
  viewSupport: ['SuperAdmin', 'SupportAgent'],
  workSupport: ['SuperAdmin', 'SupportAgent'],

  // payouts
  viewPayouts: ['SuperAdmin', 'PayoutsOps', 'Readonly'],
  holdPayouts: ['SuperAdmin', 'PayoutsOps'],
  forcePayouts: SA,

  // delivery ops
  /** Packages awaiting a courier, package lookup. */
  viewDelivery: ['SuperAdmin', 'SupportAgent', 'Readonly'],
  /** Guardian, routing, fulfilment: SuperAdmin-only on the server, reads included. */
  manageDelivery: SA,

  // content & moderation
  viewModeration: ['SuperAdmin', 'ContentMod', 'Readonly'],
  decideModeration: ['SuperAdmin', 'ContentMod'],
  /** Reels link health, post reports, recipe drafts. */
  viewContent: ['SuperAdmin', 'ContentMod'],

  // catalog & growth
  viewCatalogOps: ['SuperAdmin', 'ContentMod'],
  manageCatalogOps: ['SuperAdmin', 'ContentMod'],

  // platform
  viewFlags: ALL,
  manageFlags: SA,
  viewConfig: ALL,
  manageConfig: SA,
  manageAdmins: SA,
  viewAudit: ['SuperAdmin', 'Readonly'],
  viewPrivacyDashboard: ['SuperAdmin', 'Readonly'],
  viewDataRights: ['SuperAdmin', 'SupportAgent', 'Readonly'],
  workDataRights: ['SuperAdmin', 'SupportAgent'],
} as const satisfies Record<string, readonly AdminRole[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(roles: readonly string[] | undefined | null, capability: Capability): boolean {
  if (!roles || roles.length === 0) return false;
  // The server lets SuperAdmin through every role list.
  if (roles.includes('SuperAdmin')) return true;
  const allowed = CAPABILITIES[capability] as readonly string[];
  return roles.some((r) => allowed.includes(r));
}

export function roleLabel(role: string): string {
  return (ROLE_LABELS as Record<string, string>)[role] ?? role;
}

/** One line per role, for the role pickers on the Admins page. */
export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  SuperAdmin: 'Everything, including roles, payouts overrides and platform settings.',
  KycReviewer: 'KYC and applications, rider identity checks, vendor badges.',
  ContentMod: 'Moderation, content queues, campaigns, collections, discovery.',
  SupportAgent: 'Tickets, returns, order care, customers, privacy requests.',
  PayoutsOps: 'Payouts, refunds, hiding test orders, rider escrow.',
  Readonly: 'Look at queues, orders and logs without changing anything.',
};
