import type { CreditAgreement, EmiApplication, Instalment } from './api';
import { kathmanduToday } from './plans';

/** "yyyy-MM-dd" `days` after today in Kathmandu. */
export function dayFromToday(days: number): string {
  const t = kathmanduToday();
  const d = new Date(Date.UTC(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10) + days));
  return d.toISOString().slice(0, 10);
}

export function instalment(number: number, patch: Partial<Instalment> = {}): Instalment {
  return {
    number,
    dueDate: dayFromToday(30 * (number - 1) - 20),
    scheduledAmount: 8000,
    lateFeeDue: 0,
    paid: 0,
    outstanding: 8000,
    state: 1,
    paidUtc: null,
    lateFeeWaived: 0,
    ...patch,
  };
}

/**
 * An active 6-month EMI plan, contract v1 shape: down payment Rs 12,000 paid online, instalment 1
 * paid, instalment 2 due in 10 days.
 */
export function planApp(
  patch: Partial<EmiApplication> = {},
  agreement: Partial<CreditAgreement> = {},
): EmiApplication {
  const instalments = [
    instalment(1, { dueDate: dayFromToday(-20), paid: 8000, outstanding: 0, state: 3, paidUtc: '2026-09-25T04:00:00Z' }),
    instalment(2, { dueDate: dayFromToday(10) }),
    instalment(3, { dueDate: dayFromToday(40) }),
    instalment(4, { dueDate: dayFromToday(70) }),
    instalment(5, { dueDate: dayFromToday(100) }),
    instalment(6, { dueDate: dayFromToday(130) }),
  ];
  return {
    agreement: {
      id: 'ag-1',
      productId: 'p-1',
      variantId: 'v-1',
      kind: 1,
      state: 3,
      stateReasons: [],
      currency: 'NPR',
      price: 60000,
      downPayment: 12000,
      financed: 48000,
      tenureMonths: 6,
      totalPayable: 60000,
      appliedUtc: '2026-08-20T05:00:00Z',
      activatedUtc: '2026-08-26T05:00:00Z',
      outstanding: 40000,
      daysPastDue: 0,
      downPaymentOnDelivery: false,
      instalments,
      paidToDate: 20000,
      instalmentsPaid: 1,
      instalmentsRemaining: 5,
      nextInstalment: instalments[1],
      lateFeesOutstanding: 0,
      ...agreement,
    },
    buyerDisplayName: 'Asha K.',
    productName: 'Pashmina overcoat',
    monthlyInstalment: 8000,
    documents: [],
    riskScore: 640,
    riskBand: 2,
    riskReasons: [],
    orderNumber: 'NK2026-00101',
    vendorSubOrderId: 'so-101',
    downPaymentStatus: 'paid_online',
    ...patch,
  };
}
