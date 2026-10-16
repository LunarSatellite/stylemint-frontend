import { api } from '../../api/client';
import { redactPii } from '../crm/redact';

/**
 * EMI applications on the seller's own products (Credit module, VendorCreditController).
 * Enums are INTEGERS on the wire. The buyer appears by display name only — never phone or email.
 */
export const AgreementState = { PendingApproval: 1, Approved: 2, Declined: 6 } as const;
export const DocumentKind = { Identity: 1, Financial: 2 } as const;

export const riskBandLabel: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C', 4: 'D' };

/** What the risk engine noted, in words a seller can act on. */
export const riskReasonLabel: Record<string, string> = {
  manual_review_required: 'Waiting for your decision',
  kyc_required: 'Not verified by StyleMint — check the identity document',
  band_too_low: 'Little purchase or repayment history',
  buyer_limit_exceeded: 'Above the buyer’s usual credit limit',
};
export const reasonLabel = (code: string) => riskReasonLabel[code] ?? code.replace(/_/g, ' ');

export interface CreditDocument {
  id: string;
  kind: number;
  contentType: string;
  sizeBytes: number;
  uploadedUtc: string;
}

export interface CreditAgreement {
  id: string;
  productId: string;
  variantId: string;
  state: number;
  stateReasons: string[];
  currency: string;
  price: number;
  downPayment: number;
  financed: number;
  tenureMonths: number;
  totalPayable: number;
  appliedUtc: string;
  decisionNote?: string | null;
  documentsSubmittedUtc?: string | null;
  // On every agreement, but optional here: older payloads (and the EMI request tests) leave them out.
  /** 1 EMI, 2 PayLater, 3 Prepay — a number, or its name. */
  kind?: number | string;
  outstanding?: number;
  daysPastDue?: number;
  activatedUtc?: string | null;
  deliveredUtc?: string | null;
  closedUtc?: string | null;
  reversedUtc?: string | null;
  orderId?: string | null;
  downPaymentOnDelivery?: boolean;
  lateFeeAmount?: number;
  lateFeeGraceDays?: number;
  instalments?: Instalment[];
  // NEW in emi-after-contract v1 — absent until the backend is deployed (computed from `instalments` then).
  paidToDate?: number;
  instalmentsPaid?: number;
  instalmentsRemaining?: number;
  nextInstalment?: Instalment | null;
  lateFeesOutstanding?: number;
}

/** One instalment. `dueDate` is a Kathmandu calendar date ("2026-11-14"), null before the plan starts. */
export interface Instalment {
  number: number;
  dueDate: string | null;
  scheduledAmount: number;
  principalDue?: number;
  interestDue?: number;
  lateFeeDue: number;
  paid: number;
  outstanding: number;
  /** 1 Scheduled, 2 PartiallyPaid, 3 Paid, 4 Overdue, 5 Waived — a number, or its name. */
  state: number | string;
  paidUtc: string | null;
  credited?: number;
  lateFeeWaived?: number;
}

export interface EmiApplication {
  agreement: CreditAgreement;
  buyerDisplayName: string;
  productName: string;
  monthlyInstalment: number;
  documents: CreditDocument[];
  riskScore: number | null;
  riskBand: number | null;
  riskReasons: string[];
  // NEW in emi-after-contract v1.
  /** The order the plan pays for; null before checkout. */
  orderNumber?: string | null;
  /** This seller's sub-order on it — the id of the seller's order page. */
  vendorSubOrderId?: string | null;
  /** none | due | collect_on_delivery | paid_online | received_in_cash */
  downPaymentStatus?: string;
}

const base = '/v1/credit/vendor';

export const emiApi = {
  applications: (state: number = AgreementState.PendingApproval) =>
    api.get<EmiApplication[]>(`${base}/applications`, { state }),
  documentLink: (agreementId: string, documentId: string) =>
    api.get<{ url: string }>(`${base}/agreements/${agreementId}/documents/${documentId}/link`),
  approve: (agreementId: string) => api.post(`${base}/agreements/${agreementId}/review`, { approve: true }),
  /**
   * The seller's EMI plans after approval (contract v1: states 2, 3, 4, 5, 9). 404 with no
   * errorCode until the backend is deployed. Buyer contact details never reach the screen.
   */
  plans: async () => redactPii(await api.get<EmiApplication[]>(`${base}/plans`, { limit: 200 })),
  /** One plan with its schedule. 404 with an errorCode = not this seller's; without = not deployed yet. */
  plan: async (agreementId: string) => redactPii(await api.get<EmiApplication>(`${base}/plans/${agreementId}`)),
  decline: (agreementId: string, note: string) =>
    api.post(`${base}/agreements/${agreementId}/review`, { approve: false, note }),
};
