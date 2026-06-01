import { format, formatDistanceToNow } from 'date-fns'
import { KycState, AdminRole, PayoutState } from './enums'

export function formatDate(iso: string): string {
  return format(new Date(iso), 'dd MMM yyyy, HH:mm')
}

export function formatRelative(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true })
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100)
}

export const KycStateLabel: Record<number, string> = {
  [KycState.Pending]:  'Pending',
  [KycState.Approved]: 'Approved',
  [KycState.Rejected]: 'Rejected',
}

export const AdminRoleLabel: Record<number, string> = {
  [AdminRole.SuperAdmin]:   'Super Admin',
  [AdminRole.KycReviewer]:  'KYC Reviewer',
  [AdminRole.ContentMod]:   'Content Moderator',
  [AdminRole.SupportAgent]: 'Support Agent',
  [AdminRole.PayoutsOps]:   'Payouts Ops',
  [AdminRole.Readonly]:     'Read Only',
}

export const PayoutStateLabel: Record<number, string> = {
  [PayoutState.Pending]: 'Pending',
  [PayoutState.OnHold]:  'On Hold',
  [PayoutState.Paid]:    'Paid',
  [PayoutState.Failed]:  'Failed',
}
