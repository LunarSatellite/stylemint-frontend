import { api } from '../../../api/client';
import type { PagedResult } from '../../../api/paging';

/**
 * Bank vendor endpoints — D:\Stylemint\wt\service-banks-contract.md v1 (§2–§6). Numeric enums, camelCase.
 * Every route 404s with no errorCode until the combined deploy ("being set up").
 *
 * PII: a lead's `contact` is the buyer's name/phone/email, shown ONLY because the buyer ticked consent on THAT
 * lead for this bank. Nothing else about the buyer ever reaches the bank. After a withdrawal `contact` is null.
 */

export const BankProductType = { Savings: 1, Current: 2, FixedDeposit: 3, Loan: 4, CreditCard: 5, Remittance: 6, Other: 99 } as const;
export const bankProductTypeLabel: Record<number, string> = {
  1: 'Savings account',
  2: 'Current account',
  3: 'Fixed deposit',
  4: 'Loan',
  5: 'Credit card',
  6: 'Remittance',
  99: 'Other',
};
export const PRODUCT_TYPES = [1, 2, 3, 4, 5, 6, 99] as const;

export const BankProductStatus = { Draft: 1, Published: 2, Archived: 3 } as const;
export const bankProductStatusLabel: Record<number, { label: string; color: string }> = {
  1: { label: 'Draft', color: 'gray' },
  2: { label: 'Published', color: 'forest' },
  3: { label: 'Archived', color: 'slate' },
};

export const LeadKind = { Enquiry: 1, Appointment: 2 } as const;
export const LeadStatus = { New: 1, Contacted: 2, Qualified: 3, Converted: 4, Closed: 5 } as const;
export const leadStatusLabel: Record<number, { label: string; color: string }> = {
  1: { label: 'New', color: 'blue' },
  2: { label: 'Contacted', color: 'amber' },
  3: { label: 'Qualified', color: 'grape' },
  4: { label: 'Converted', color: 'forest' },
  5: { label: 'Closed', color: 'gray' },
};

export const AppointmentStatus = { Booked: 1, Cancelled: 2, Completed: 3, NoShow: 4 } as const;
export const appointmentStatusLabel: Record<number, { label: string; color: string }> = {
  1: { label: 'Booked', color: 'blue' },
  2: { label: 'Cancelled', color: 'gray' },
  3: { label: 'Completed', color: 'forest' },
  4: { label: 'No-show', color: 'signal' },
};

export const preferredContactLabel: Record<number, string> = { 1: 'Phone', 2: 'Email', 3: 'Phone or email' };

/**
 * Forward only (New → Contacted → Qualified → Converted, skipping forward allowed); Closed from any non-terminal
 * state (reason required). Converted and Closed are terminal.
 */
export function nextLeadStatuses(status: number): number[] {
  if (status === LeadStatus.Converted || status === LeadStatus.Closed) return [];
  const forward = [LeadStatus.Contacted, LeadStatus.Qualified, LeadStatus.Converted].filter((s) => s > status);
  return [...forward, LeadStatus.Closed];
}

export interface BankProduct {
  id: string;
  bankId: string;
  bankName: string;
  type: number;
  name: string;
  summary: string | null;
  description: string | null;
  interestRateMinPercent: number | null;
  interestRateMaxPercent: number | null;
  rateNote: string | null;
  feesText: string | null;
  eligibilityText: string | null;
  documentsRequired: string[];
  photoUrls: string[];
  minAmount: number | null;
  maxAmount: number | null;
  minTenureMonths: number | null;
  maxTenureMonths: number | null;
  currency: string;
  status: number;
  publishedUtc: string | null;
  createdUtc: string;
  updatedUtc: string;
}

export type BankProductWrite = Omit<BankProduct, 'id' | 'bankId' | 'bankName' | 'status' | 'publishedUtc' | 'createdUtc' | 'updatedUtc'>;

export interface OpeningHours {
  dayOfWeek: number;
  opens: string | null;
  closes: string | null;
  closed: boolean;
}

export interface Branch {
  id: string;
  bankId: string;
  name: string;
  addressLine: string;
  city: string;
  district: string | null;
  province: string | null;
  latitude: number | null;
  longitude: number | null;
  /** The branch's public number — never a buyer's. */
  phone: string | null;
  openingHours: OpeningHours[];
  appointmentsEnabled: boolean;
  isActive: boolean;
  createdUtc: string;
  updatedUtc: string;
}

export type BranchWrite = Omit<Branch, 'id' | 'bankId' | 'createdUtc' | 'updatedUtc'>;

export interface Slot {
  id: string;
  branchId: string;
  dayOfWeek: number;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  isActive: boolean;
}

export interface SlotWrite {
  dayOfWeek: number;
  startTime: string;
  durationMinutes: number;
  capacity: number;
  isActive?: boolean;
}

export interface Holiday {
  id: string;
  branchId: string;
  date: string;
  name: string;
}

export interface LeadContact {
  name: string;
  phone: string | null;
  email: string | null;
  preferredMethod: number;
}

export interface Appointment {
  id: string;
  leadId: string;
  reference: string;
  bankId: string;
  bankName: string;
  branchId: string;
  branchName: string;
  branchAddress: string | null;
  slotId: string;
  date: string;
  startTime: string;
  endTime: string;
  startUtc: string;
  endUtc: string;
  status: number;
  cancelledBy: number | null;
  cancelReason: string | null;
  purpose: string | null;
  productId: string | null;
  productType: number | null;
  productName: string | null;
  contact: LeadContact | null;
  createdUtc: string;
}

export interface Lead {
  id: string;
  reference: string;
  kind: number;
  status: number;
  statusChangedUtc: string | null;
  productId: string | null;
  productType: number | null;
  productName: string | null;
  branchId: string | null;
  branchName: string | null;
  answers: { key: string; label: string; value: string }[];
  message: string | null;
  contact: LeadContact | null;
  consent: { version: string; text: string; acceptedUtc: string } | null;
  appointment: Appointment | null;
  closedReason: string | null;
  withdrawnUtc: string | null;
  noteCount: number;
  createdUtc: string;
  updatedUtc: string;
}

export interface LeadNote {
  id: string;
  leadId: string;
  authorAccountId: string;
  text: string;
  createdUtc: string;
}

export interface AvailabilitySlot {
  slotId: string;
  startTime: string;
  endTime: string;
  startUtc: string;
  capacity: number;
  remaining: number;
  /** 1 Available, 2 Full, 3 Past, 4 Closed */
  status: number;
}

export interface Availability {
  branchId: string;
  from: string;
  days: { date: string; closed: boolean; closedReason: string | null; slots: AvailabilitySlot[] }[];
}

export interface BankVendorProfile {
  vendorAccountId: string;
  businessName: string;
  serviceCategory: number;
  licenceNumber: string | null;
  isApproved: boolean;
  counts: { products: number; publishedProducts: number; branches: number; newLeads: number; upcomingAppointments: number };
}

export type LeadFilter = {
  status?: number;
  kind?: number;
  productType?: number;
  branchId?: string;
  search?: string;
};

const base = '/v1/vendor/bank';
const enc = encodeURIComponent;

export const bankApi = {
  profile: () => api.get<BankVendorProfile>(`${base}/profile`),

  products: (status?: number) => api.get<BankProduct[]>(`${base}/products`, { status }),
  product: (id: string) => api.get<BankProduct>(`${base}/products/${enc(id)}`),
  createProduct: (body: BankProductWrite) => api.post<BankProduct>(`${base}/products`, body),
  updateProduct: (id: string, body: BankProductWrite) => api.put<BankProduct>(`${base}/products/${enc(id)}`, body),
  publishProduct: (id: string) => api.post<BankProduct>(`${base}/products/${enc(id)}/publish`),
  unpublishProduct: (id: string) => api.post<BankProduct>(`${base}/products/${enc(id)}/unpublish`),
  archiveProduct: (id: string) => api.post<BankProduct>(`${base}/products/${enc(id)}/archive`),

  branches: () => api.get<Branch[]>(`${base}/branches`),
  createBranch: (body: BranchWrite) => api.post<Branch>(`${base}/branches`, body),
  updateBranch: (id: string, body: BranchWrite) => api.put<Branch>(`${base}/branches/${enc(id)}`, body),

  slots: (branchId: string) => api.get<Slot[]>(`${base}/branches/${enc(branchId)}/slots`),
  createSlot: (branchId: string, body: SlotWrite) => api.post<Slot>(`${base}/branches/${enc(branchId)}/slots`, body),
  updateSlot: (slotId: string, body: SlotWrite & { isActive: boolean }) => api.put<Slot>(`${base}/slots/${enc(slotId)}`, body),
  deleteSlot: (slotId: string) => api.del<void>(`${base}/slots/${enc(slotId)}`),

  holidays: (branchId: string, from?: string) => api.get<Holiday[]>(`${base}/branches/${enc(branchId)}/holidays`, { from }),
  addHoliday: (branchId: string, body: { date: string; name: string }) => api.post<Holiday>(`${base}/branches/${enc(branchId)}/holidays`, body),
  deleteHoliday: (holidayId: string) => api.del<void>(`${base}/holidays/${enc(holidayId)}`),

  leads: (f: LeadFilter, cursor: string | null) =>
    api.get<PagedResult<Lead>>(`${base}/leads`, { ...f, search: f.search || undefined, cursor: cursor ?? undefined, pageSize: 20 }),
  lead: (id: string) => api.get<Lead>(`${base}/leads/${enc(id)}`),
  setLeadStatus: (id: string, status: number, reason?: string | null) =>
    api.post<Lead>(`${base}/leads/${enc(id)}/status`, { status, reason: reason || undefined }),
  notes: (id: string) => api.get<LeadNote[]>(`${base}/leads/${enc(id)}/notes`),
  addNote: (id: string, text: string) => api.post<LeadNote>(`${base}/leads/${enc(id)}/notes`, { text }),

  availability: (branchId: string, from: string, days = 14) =>
    api.get<Availability>(`${base}/branches/${enc(branchId)}/availability`, { from, days }),

  appointments: (f: { branchId?: string; from?: string; to?: string; status?: number }, cursor: string | null) =>
    api.get<PagedResult<Appointment>>(`${base}/appointments`, { ...f, cursor: cursor ?? undefined, pageSize: 50 }),
  cancelAppointment: (id: string, reason: string) => api.post<Appointment>(`${base}/appointments/${enc(id)}/cancel`, { reason }),
  completeAppointment: (id: string) => api.post<Appointment>(`${base}/appointments/${enc(id)}/complete`),
  noShowAppointment: (id: string) => api.post<Appointment>(`${base}/appointments/${enc(id)}/no-show`),
};

export const BANK_KEY = ['bank'] as const;
