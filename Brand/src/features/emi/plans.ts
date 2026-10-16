import type { CreditAgreement, EmiApplication, Instalment } from './api';

/**
 * The seller's view of an EMI plan after approval (emi-after-contract v1). Every figure prefers the
 * server's at-a-glance fields (`paidToDate`, `nextInstalment`…) and, while the backend that adds
 * them is not deployed, falls back to adding up `instalments` the same way the server does.
 */

export const PlanState = {
  PendingApproval: 1,
  Approved: 2,
  Active: 3,
  Completed: 4,
  Defaulted: 5,
  Declined: 6,
  Cancelled: 7,
  Expired: 8,
  Reversed: 9,
} as const;

export const InstalmentState = { Scheduled: 1, PartiallyPaid: 2, Paid: 3, Overdue: 4, Waived: 5 } as const;

const PLAN_STATE_NAMES: Record<string, number> = {
  pendingapproval: 1,
  approved: 2,
  active: 3,
  completed: 4,
  defaulted: 5,
  declined: 6,
  cancelled: 7,
  expired: 8,
  reversed: 9,
};
const INSTALMENT_STATE_NAMES: Record<string, number> = {
  scheduled: 1,
  partiallypaid: 2,
  paid: 3,
  overdue: 4,
  waived: 5,
};

/** Enums are numbers on the wire; accept the name string too (contract v1). */
function wire(value: number | string | undefined | null, names: Record<string, number>): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    if (Number.isFinite(n) && value.trim() !== '') return n;
    return names[value.toLowerCase().replace(/[^a-z]/g, '')] ?? 0;
  }
  return 0;
}

export const planStateOf = (a: Pick<CreditAgreement, 'state'>) => wire(a.state, PLAN_STATE_NAMES);
export const instalmentStateOf = (i: Pick<Instalment, 'state'>) => wire(i.state, INSTALMENT_STATE_NAMES);

export const isSettled = (i: Instalment) => {
  const s = instalmentStateOf(i);
  return s === InstalmentState.Paid || s === InstalmentState.Waived;
};

/** Today's calendar date in Kathmandu, "yyyy-MM-dd" — due dates are Kathmandu days, never device-zone days. */
export function kathmanduToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kathmandu',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Whole days from `from` to `to`, both "yyyy-MM-dd". */
export function daysBetween(from: string, to: string): number {
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "14 Nov 2026" from a calendar date, without any time-zone shift. */
export function formatDueDate(date: string | null | undefined): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return '—';
  return `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]} ${date.slice(0, 4)}`;
}

export type ScheduleStatus = 'paid' | 'overdue' | 'due_today' | 'due_soon' | 'upcoming' | 'not_started' | 'part_paid';

/** Contract display rule: Paid/Waived → paid; Overdue → overdue; else compare the due date with today in Kathmandu. */
export function scheduleStatus(i: Instalment, today: string = kathmanduToday()): ScheduleStatus {
  const s = instalmentStateOf(i);
  if (s === InstalmentState.Paid || s === InstalmentState.Waived) return 'paid';
  if (s === InstalmentState.Overdue) return 'overdue';
  if (!i.dueDate) return 'not_started';
  const days = daysBetween(today, i.dueDate.slice(0, 10));
  if (days < 0) return 'overdue';
  if (days === 0) return 'due_today';
  if (days <= 3) return 'due_soon';
  return s === InstalmentState.PartiallyPaid ? 'part_paid' : 'upcoming';
}

export const scheduleStatusLabel: Record<ScheduleStatus, { label: string; color: string }> = {
  paid: { label: 'Paid', color: 'green' },
  overdue: { label: 'Overdue', color: 'red' },
  due_today: { label: 'Due today', color: 'orange' },
  due_soon: { label: 'Due soon', color: 'yellow' },
  upcoming: { label: 'Due', color: 'gray' },
  part_paid: { label: 'Part paid', color: 'blue' },
  not_started: { label: 'Starts with the plan', color: 'gray' },
};

export const planStateLabel: Record<number, { label: string; color: string }> = {
  [PlanState.Approved]: { label: 'Waiting for down payment', color: 'yellow' },
  [PlanState.Active]: { label: 'Active', color: 'forest' },
  [PlanState.Completed]: { label: 'Completed', color: 'green' },
  [PlanState.Defaulted]: { label: 'Defaulted', color: 'red' },
  [PlanState.Reversed]: { label: 'Reversed', color: 'gray' },
  [PlanState.Cancelled]: { label: 'Cancelled', color: 'gray' },
  [PlanState.Expired]: { label: 'Expired', color: 'gray' },
};

export const downPaymentStatusLabel: Record<string, string> = {
  none: 'No down payment',
  due: 'To be paid online',
  collect_on_delivery: 'Collect in cash on delivery',
  paid_online: 'Paid online',
  received_in_cash: 'Received in cash',
};

/** Same rule as the server's `DownPaymentStatusOf`, for payloads from before contract v1. */
export function downPaymentStatusOf(app: EmiApplication): string {
  if (app.downPaymentStatus) return app.downPaymentStatus;
  const a = app.agreement;
  if (a.downPayment <= 0) return 'none';
  const started = !!a.activatedUtc;
  if (a.downPaymentOnDelivery) return started ? 'received_in_cash' : 'collect_on_delivery';
  return started ? 'paid_online' : 'due';
}

export interface PlanView {
  app: EmiApplication;
  id: string;
  state: number;
  currency: string;
  collected: number;
  remaining: number;
  next: Instalment | null;
  nextStatus: ScheduleStatus | null;
  overdue: boolean;
  dueSoon: boolean;
  instalments: Instalment[];
  instalmentsPaid: number;
  instalmentsRemaining: number;
  lateFeesOutstanding: number;
  downPaymentStatus: string;
}

export function planView(app: EmiApplication, today: string = kathmanduToday()): PlanView {
  const a = app.agreement;
  const instalments = [...(a.instalments ?? [])].sort((x, y) => x.number - y.number);
  const state = planStateOf(a);
  const downReceived = !!a.activatedUtc && a.downPayment > 0;
  const collected =
    a.paidToDate ?? (downReceived ? a.downPayment : 0) + instalments.reduce((sum, i) => sum + (i.paid ?? 0), 0);
  const remaining = a.outstanding ?? instalments.filter((i) => !isSettled(i)).reduce((s, i) => s + (i.outstanding ?? 0), 0);
  const next =
    a.nextInstalment !== undefined ? a.nextInstalment : (instalments.find((i) => !isSettled(i)) ?? null);
  const running = state === PlanState.Active;
  const nextStatus = next ? scheduleStatus(next, today) : null;
  const overdue =
    running && ((a.daysPastDue ?? 0) > 0 || instalments.some((i) => scheduleStatus(i, today) === 'overdue') || nextStatus === 'overdue');
  const dueSoon = running && !overdue && (nextStatus === 'due_today' || nextStatus === 'due_soon');
  const paidCount = a.instalmentsPaid ?? instalments.filter(isSettled).length;
  return {
    app,
    id: a.id,
    state,
    currency: a.currency || 'NPR',
    collected,
    remaining: state === PlanState.Completed ? 0 : remaining,
    next: state === PlanState.Completed ? null : next,
    nextStatus: state === PlanState.Completed ? null : nextStatus,
    overdue,
    dueSoon,
    instalments,
    instalmentsPaid: paidCount,
    instalmentsRemaining: a.instalmentsRemaining ?? instalments.length - paidCount,
    lateFeesOutstanding:
      a.lateFeesOutstanding ??
      instalments.filter((i) => !isSettled(i)).reduce((s, i) => s + Math.max(0, (i.lateFeeDue ?? 0) - (i.lateFeeWaived ?? 0)), 0),
    downPaymentStatus: downPaymentStatusOf(app),
  };
}

export type PlanFilter = 'all' | 'active' | 'overdue' | 'due_soon' | 'completed';

export const PLAN_FILTERS: { value: PlanFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'due_soon', label: 'Due soon' },
  { value: 'completed', label: 'Completed' },
];

export function matchesFilter(p: PlanView, filter: PlanFilter): boolean {
  switch (filter) {
    case 'active':
      return p.state === PlanState.Active || p.state === PlanState.Approved;
    case 'overdue':
      return p.overdue;
    case 'due_soon':
      return p.dueSoon;
    case 'completed':
      return p.state === PlanState.Completed;
    default:
      return true;
  }
}

export const isPlanFilter = (v: string | null): v is PlanFilter =>
  v === 'all' || v === 'active' || v === 'overdue' || v === 'due_soon' || v === 'completed';

/** Where a seller plan notification opens (contract: deep link `/vendor/payment-plans/{agreementId}`). */
export function planPath(agreementId: string): string {
  return `/emi-plans/${encodeURIComponent(agreementId)}`;
}

/**
 * Seller Center route for an in-app notification: `plan.vendor.*` types (or their deep link) open
 * the plan, even without a deep link. Null for anything this helper does not know.
 */
export function sellerNotificationRoute(n: { type?: string | null; deepLink?: string | null; agreementId?: string | null }): string | null {
  const fromLink = n.deepLink?.match(/^\/vendor\/payment-plans\/([^/?#]+)/)?.[1];
  if (fromLink) return planPath(decodeURIComponent(fromLink));
  if (n.type?.startsWith('plan.vendor.') && n.agreementId) return planPath(n.agreementId);
  return null;
}
