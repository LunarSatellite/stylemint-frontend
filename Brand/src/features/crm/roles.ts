/**
 * Who may see and do what in the seller CRM.
 *
 * The CRM session carries the seller's CRM role: vendor Owner → Owner, Admin → Admin, team
 * Member → Agent (see `D:\Stylemint\wt\seller-crm-plan.md`). The backend enforces the seller
 * allowlist and the role on every call; this file only keeps the UI from offering what would be
 * refused. Unknown roles get the least privilege (Agent).
 */

export type CrmRole = 'Owner' | 'Admin' | 'Manager' | 'Agent';

const BY_NUMBER: Record<number, CrmRole> = { 1: 'Owner', 2: 'Admin', 3: 'Agent', 4: 'Manager' };

export function normalizeRole(raw: unknown): CrmRole {
  if (typeof raw === 'number') return BY_NUMBER[raw] ?? 'Agent';
  if (typeof raw === 'string') {
    const n = Number(raw);
    if (raw.trim() !== '' && Number.isInteger(n)) return BY_NUMBER[n] ?? 'Agent';
    const lower = raw.trim().toLowerCase();
    if (lower === 'owner') return 'Owner';
    if (lower === 'admin' || lower === 'administrator') return 'Admin';
    if (lower === 'manager') return 'Manager';
  }
  return 'Agent';
}

export type CrmCapability =
  | 'customers.view'
  | 'customers.edit'
  | 'tasks.manage'
  | 'meetings.manage'
  | 'segments.view'
  | 'segments.manage'
  | 'campaigns.view'
  | 'campaigns.manage'
  | 'automations.manage'
  | 'feedback.view'
  | 'feedback.send'
  | 'deals.view'
  | 'deals.manage'
  | 'quotes.manage'
  | 'reports.view'
  /** Deleting anything (notes, deals, campaigns, segments). */
  | 'records.delete';

/**
 * Agent = vendor team Member. The backend seeds a "Seller member" CRM role for it: view everything,
 * create/edit contacts, deals, quotes, proposals, support and campaigns — no delete, no settings.
 * The UI also keeps segment discovery, automations and survey sends with Owner/Admin.
 */
const AGENT: CrmCapability[] = [
  'customers.view',
  'customers.edit',
  'tasks.manage',
  'meetings.manage',
  'segments.view',
  'campaigns.view',
  'campaigns.manage',
  'feedback.view',
  'deals.view',
  'deals.manage',
  'quotes.manage',
  'reports.view',
];

const EVERYTHING: CrmCapability[] = [...AGENT, 'segments.manage', 'automations.manage', 'feedback.send', 'records.delete'];

const CAPABILITIES: Record<CrmRole, ReadonlySet<CrmCapability>> = {
  Owner: new Set(EVERYTHING),
  Admin: new Set(EVERYTHING),
  Manager: new Set(EVERYTHING),
  Agent: new Set(AGENT),
};

export function can(role: CrmRole | null | undefined, capability: CrmCapability): boolean {
  if (!role) return false;
  return CAPABILITIES[role].has(capability);
}

export type CrmAreaKey = 'customers' | 'tasks' | 'segments' | 'campaigns' | 'feedback' | 'deals' | 'reports';

export interface CrmArea {
  key: CrmAreaKey;
  to: string;
  label: string;
  short: string;
  capability: CrmCapability;
}

/** The CRM pages, in sidebar order. */
export const CRM_AREAS: CrmArea[] = [
  { key: 'customers', to: '/crm/customers', label: 'Customers', short: 'Customers', capability: 'customers.view' },
  { key: 'tasks', to: '/crm/tasks', label: 'Tasks & calendar', short: 'Tasks', capability: 'tasks.manage' },
  { key: 'segments', to: '/crm/segments', label: 'Segments', short: 'Segments', capability: 'segments.view' },
  { key: 'campaigns', to: '/crm/campaigns', label: 'Campaigns & automations', short: 'Campaigns', capability: 'campaigns.view' },
  { key: 'feedback', to: '/crm/feedback', label: 'Feedback', short: 'Feedback', capability: 'feedback.view' },
  { key: 'deals', to: '/crm/deals', label: 'Deals & quotes', short: 'Deals', capability: 'deals.view' },
  { key: 'reports', to: '/crm/reports', label: 'Reports', short: 'Reports', capability: 'reports.view' },
];

/**
 * Areas the seller allowlist (`crm_scope=seller`, plan "Backend notes" §3) lets through — all of
 * them; the session may narrow it further with an explicit `areas` list.
 */
const ALLOWLISTED: ReadonlySet<CrmAreaKey> = new Set(CRM_AREAS.map((a) => a.key));

/**
 * The areas to show. Before the CRM session is known (`role` null) every allowlisted area is
 * shown so the menu does not jump; each page gates itself once the role is known.
 */
export function visibleAreas(role: CrmRole | null, sessionAreas?: readonly string[] | null): CrmArea[] {
  return CRM_AREAS.filter((a) => {
    if (!ALLOWLISTED.has(a.key)) return false;
    if (sessionAreas && sessionAreas.length > 0 && !sessionAreas.includes(a.key)) return false;
    return role ? can(role, a.capability) : true;
  });
}
