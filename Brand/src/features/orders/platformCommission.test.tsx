import { screen, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { formatMoney } from '../../lib/format';
import { mockApi, renderWithProviders } from '../../test/utils';
import { platformCommissionText } from '../payouts/api';
import { signInVendor } from '../services/testkit';
import { commissionBreakdown, commissionLabel, PaymentMethod, SubOrderState, type SubOrderDetail, type SubOrderLine } from './api';
import OrderDetailPage from './OrderDetailPage';

const line = (patch: Partial<SubOrderLine> = {}): SubOrderLine => ({
  id: 'line-1',
  productVariantId: 'var-1',
  quantity: 2,
  unitPriceAmount: 1250,
  unitPriceCurrency: 'NPR',
  productTitleSnapshot: 'Linen kurta',
  variantLabelSnapshot: 'M · Blue',
  optionLabel: null,
  thumbnailUrlSnapshot: null,
  lineSubtotalAmount: 2500,
  lineSubtotalCurrency: 'NPR',
  ...patch,
});

const detail = (patch: Partial<SubOrderDetail> = {}): SubOrderDetail => ({
  id: 'so-41',
  orderId: 'o-41',
  orderNumber: 'SM-4100',
  state: SubOrderState.Delivered,
  placedUtc: '2026-10-28T05:00:00Z',
  shipTo: {
    receiverName: 'Sita Sharma',
    receiverPhone: '',
    addressLine1: 'Jhamsikhel',
    landmark: null,
    country: 'NP',
    state: 'Bagmati',
    city: 'Lalitpur',
    zipCode: '44600',
    latitude: null,
    longitude: null,
    locationNote: null,
    mapsLink: null,
  },
  shippingFeeAmount: 100,
  shippingFeeCurrency: 'NPR',
  carrier: null,
  trackingNumber: null,
  acceptedUtc: '2026-10-28T05:10:00Z',
  packedUtc: '2026-10-28T05:20:00Z',
  handedOverUtc: '2026-10-28T06:00:00Z',
  shippedUtc: null,
  inTransitUtc: null,
  outForDeliveryUtc: null,
  deliveredUtc: '2026-10-28T08:00:00Z',
  fulfillmentChannel: 'Delivery',
  collectedUtc: null,
  cancelledUtc: null,
  cancellationReasonCode: null,
  cancellationNote: null,
  lineSubtotalAmount: 2500,
  lineSubtotalCurrency: 'NPR',
  subtotalAmount: 2600,
  subtotalCurrency: 'NPR',
  itemCount: 2,
  lines: [line()],
  delivery: null,
  paymentMethod: PaymentMethod.Esewa,
  ...patch,
});

function renderDetail(order: SubOrderDetail) {
  mockApi({ [`GET /v1/vendor/sub-orders/${order.id}`]: { body: order } });
  return renderWithProviders(
    <Routes>
      <Route path="/orders/:id" element={<OrderDetailPage />} />
    </Routes>,
    { route: `/orders/${order.id}` },
  );
}

const rs2 = (n: number) => formatMoney({ amount: n, currency: 'NPR' }, { decimals: 2 });

describe('StyleMint commission on the seller order page', () => {
  beforeEach(async () => {
    await signInVendor();
  });

  it('shows the commission and what the seller receives per line and in the totals', async () => {
    renderDetail(
      detail({
        lines: [line({ platformCommissionAmount: 250, platformCommissionRatePercent: 10 })],
        platformCommissionAmount: 250,
        platformCommissionRatePercent: 10,
        vendorNetAmount: 2250,
      }),
    );

    const perLine = await screen.findByTestId('line-commission-line-1');
    expect(within(perLine).getByText('StyleMint commission (10%)')).toBeInTheDocument();
    expect(perLine).toHaveTextContent(`−${rs2(250)}`);
    expect(within(perLine).getByText('You receive')).toBeInTheDocument();
    expect(perLine).toHaveTextContent(rs2(2250));

    const totals = screen.getByTestId('order-commission');
    expect(within(totals).getByText('StyleMint commission (10%)')).toBeInTheDocument();
    expect(within(totals).getByTestId('order-commission-amount')).toHaveTextContent(`−${rs2(250)}`);
    expect(within(totals).getByTestId('order-you-receive')).toHaveTextContent(rs2(2250));
  });

  it('uses the server’s vendor net for "You receive" when it sends one', async () => {
    renderDetail(
      detail({
        lines: [line({ platformCommissionAmount: 250, platformCommissionRatePercent: 10, vendorNetAmount: 2000 })],
        platformCommissionAmount: 250,
        platformCommissionRatePercent: 10,
        vendorNetAmount: 2000,
      }),
    );
    expect(await screen.findByTestId('order-you-receive')).toHaveTextContent(rs2(2000));
    expect(screen.getByTestId('line-commission-line-1')).toHaveTextContent(rs2(2000));
  });

  it('says it is taken from every payment on an EMI order', async () => {
    renderDetail(
      detail({
        paymentPlan: {
          agreementId: 'a-1',
          kind: 'Instalment',
          priceAmount: 2500,
          downPaymentAmount: 750,
          financedAmount: 1750,
          tenureMonths: 3,
          monthlyInstalmentAmount: 583.34,
          currency: 'NPR',
          downPaymentOnDelivery: false,
          downPaymentPaid: true,
        },
        platformCommissionAmount: 250,
        platformCommissionRatePercent: 10,
      }),
    );
    expect(await screen.findByTestId('order-commission')).toHaveTextContent('On EMI orders it is taken from every payment, not at the start.');
  });

  it('hides both lines when the API does not send the commission (older backend)', async () => {
    renderDetail(detail());
    expect(await screen.findByText('Linen kurta')).toBeInTheDocument();
    expect(screen.queryByTestId('line-commission-line-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('order-commission')).not.toBeInTheDocument();
    expect(screen.queryByText('You receive')).not.toBeInTheDocument();
    expect(screen.queryByText(/StyleMint commission/)).not.toBeInTheDocument();
  });
});

describe('commission helpers', () => {
  it('labels with the rate only when there is one', () => {
    expect(commissionLabel(12.5)).toBe('StyleMint commission (12.5%)');
    expect(commissionLabel(10)).toBe('StyleMint commission (10%)');
    expect(commissionLabel(null)).toBe('StyleMint commission');
    expect(commissionLabel(undefined)).toBe('StyleMint commission');
  });

  it('breaks an amount down, or returns null without the field', () => {
    expect(commissionBreakdown(2500, {})).toBeNull();
    expect(commissionBreakdown(2500, { platformCommissionAmount: null })).toBeNull();
    expect(commissionBreakdown(2500, { platformCommissionAmount: 250, platformCommissionRatePercent: 10 })).toEqual({ commission: 250, rate: 10, receive: 2250, computed: true });
    expect(commissionBreakdown(2500, { platformCommissionAmount: 250, vendorNetAmount: 2000 })).toEqual({ commission: 250, rate: null, receive: 2000, computed: false });
    expect(commissionBreakdown(2500, { platformCommissionAmount: 0, platformCommissionRatePercent: 0 })).toEqual({ commission: 0, rate: 0, receive: 2500, computed: true });
  });

  it('describes the commission deducted from an earnings row', () => {
    const fmt = (amount: number, currency: string) => formatMoney({ amount, currency }, { decimals: 2 });
    expect(platformCommissionText({ amountCurrency: 'NPR', platformCommissionAmount: 250, platformCommissionRatePercent: 10 }, fmt)).toBe(`StyleMint commission (10%) deducted: ${rs2(250)}`);
    expect(platformCommissionText({ amountCurrency: 'NPR', platformCommissionAmount: 250 }, fmt)).toBe(`StyleMint commission deducted: ${rs2(250)}`);
    expect(platformCommissionText({ amountCurrency: 'NPR' }, fmt)).toBeNull();
    expect(platformCommissionText({ amountCurrency: 'NPR', platformCommissionAmount: 0 }, fmt)).toBeNull();
  });
});
