import { api } from '../../api/client';

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
}

const base = '/v1/credit/vendor';

export const emiApi = {
  applications: (state: number = AgreementState.PendingApproval) =>
    api.get<EmiApplication[]>(`${base}/applications`, { state }),
  documentLink: (agreementId: string, documentId: string) =>
    api.get<{ url: string }>(`${base}/agreements/${agreementId}/documents/${documentId}/link`),
  approve: (agreementId: string) => api.post(`${base}/agreements/${agreementId}/review`, { approve: true }),
  decline: (agreementId: string, note: string) =>
    api.post(`${base}/agreements/${agreementId}/review`, { approve: false, note }),
};
