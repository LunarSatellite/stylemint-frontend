import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/utils';
import { PaymentMethod, SubOrderState, type OrderPaymentPlan, type SubOrderDetail, type SubOrderListItem } from './api';
import { OrderCard } from './components';
import { PaymentCard, planSummary } from './PaymentCard';

const plan = (patch: Partial<OrderPaymentPlan> = {}): OrderPaymentPlan => ({
  agreementId: '8849f7d8-9f0f-429e-9ccb-0181ab4299e0',
  kind: 'Instalment',
  priceAmount: 100000,
  downPaymentAmount: 30000,
  financedAmount: 70000,
  tenureMonths: 3,
  monthlyInstalmentAmount: 23334,
  currency: 'NPR',
  downPaymentOnDelivery: true,
  downPaymentPaid: false,
  ...patch,
});

const detail = (patch: Partial<SubOrderDetail> = {}): SubOrderDetail => ({
  id: 'so-28',
  orderId: 'o-28',
  orderNumber: 'NK2026-00028',
  state: SubOrderState.Packed,
  placedUtc: '2026-10-16T05:00:00Z',
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
  shippingFeeAmount: 0,
  shippingFeeCurrency: 'NPR',
  carrier: null,
  trackingNumber: null,
  acceptedUtc: null,
  packedUtc: null,
  handedOverUtc: null,
  shippedUtc: null,
  inTransitUtc: null,
  outForDeliveryUtc: null,
  deliveredUtc: null,
  fulfillmentChannel: 'Delivery',
  collectedUtc: null,
  cancelledUtc: null,
  cancellationReasonCode: null,
  cancellationNote: null,
  lineSubtotalAmount: 100000,
  lineSubtotalCurrency: 'NPR',
  subtotalAmount: 100000,
  subtotalCurrency: 'NPR',
  itemCount: 1,
  lines: [],
  delivery: null,
  ...patch,
});

describe('an EMI order on the seller screens', () => {
  it('shows the down payment, the instalments and only the down payment as cash to collect', () => {
    renderWithProviders(
      <PaymentCard
        order={detail({
          paymentMethod: PaymentMethod.CashOnDelivery,
          paymentPlan: plan(),
          cashToCollectAmount: 30000,
          cashToCollectCurrency: 'NPR',
        })}
      />,
    );
    expect(screen.getByText('Payment · EMI')).toBeInTheDocument();
    expect(screen.getByText('Rs 100,000')).toBeInTheDocument();
    expect(screen.getByTestId('plan-down-payment')).toHaveTextContent('Rs 30,000 · collect in cash on delivery');
    expect(screen.getByTestId('plan-instalments')).toHaveTextContent('Rs 70,000 over 3 months (Rs 23,334/month)');
    expect(screen.getByTestId('cash-to-collect')).toHaveTextContent('Rs 30,000');
    expect(screen.getByTestId('cash-to-collect')).not.toHaveTextContent('100,000');
  });

  it('a down payment paid online leaves nothing for the rider', () => {
    renderWithProviders(
      <PaymentCard
        order={detail({
          paymentMethod: PaymentMethod.Esewa,
          paymentPlan: plan({ downPaymentOnDelivery: false, downPaymentPaid: true }),
          cashToCollectAmount: null,
        })}
      />,
    );
    expect(screen.getByTestId('plan-down-payment')).toHaveTextContent('paid online');
    expect(screen.getByTestId('cash-to-collect')).toHaveTextContent('Nothing');
  });

  it('an ordinary prepaid order shows no payment card', () => {
    renderWithProviders(<PaymentCard order={detail({ paymentMethod: PaymentMethod.Esewa })} />);
    expect(screen.queryByText(/^Payment/)).toBeNull();
    expect(screen.queryByTestId('cash-to-collect')).toBeNull();
  });

  it('the order row marks an EMI order with its cash down payment', () => {
    const row: SubOrderListItem = {
      id: 'so-28',
      orderId: 'o-28',
      orderNumber: 'NK2026-00028',
      receiverName: 'Sita Sharma',
      state: SubOrderState.Packed,
      shippingFeeAmount: 0,
      shippingFeeCurrency: 'NPR',
      subtotalAmount: 100000,
      subtotalCurrency: 'NPR',
      itemCount: 1,
      carrier: null,
      trackingNumber: null,
      placedUtc: '2026-10-16T05:00:00Z',
      shippedUtc: null,
      deliveredUtc: null,
      fulfillmentChannel: 'Delivery',
      collectedUtc: null,
      paymentMethod: PaymentMethod.CashOnDelivery,
      paymentPlan: plan(),
    };
    renderWithProviders(<OrderCard order={row} />);
    expect(screen.getByText('EMI · cash down payment')).toBeInTheDocument();
    expect(planSummary(plan())).toBe('EMI · Rs 30,000 down payment — collect in cash on delivery');
  });
});
