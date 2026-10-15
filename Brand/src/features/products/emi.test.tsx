import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockApi, renderWithProviders } from '../../test/utils';
import type { Product } from './api';
import { EmiCard } from './EmiCard';

const product = {
  id: 'p1',
  name: 'Pashmina overcoat',
  variants: [{ id: 'v1', priceAmount: 60_000 }],
} as unknown as Product;

const terms = (patch = {}) => ({
  productId: 'p1',
  productName: 'Pashmina overcoat',
  enabled: true,
  minDownPaymentPercent: 30,
  effectiveMinDownPaymentPercent: 30,
  tenures: [3, 6],
  interestRatePercentMonthly: 0,
  approvalMode: 'Manual',
  eligibleVariantCount: 1,
  minimumPrice: { amount: 20000, currency: 'NPR' },
  sampleQuote: null,
  updatedUtc: null,
  ...patch,
});

describe('EMI terms: cash on delivery for the down payment', () => {
  it('is on by default, and turning it off is saved', async () => {
    const calls = mockApi({
      'GET /v1/vendor/products/p1/emi-terms': { body: terms() },
      'PUT /v1/vendor/products/p1/emi-terms': (c) => ({ body: { ...terms(), ...(c.body as object) } }),
    });
    renderWithProviders(<EmiCard product={product} />);
    const user = userEvent.setup();
    const toggle = await screen.findByRole('switch', { name: /allow cash on delivery for the down payment/i });
    expect(toggle).toBeChecked();

    await user.click(toggle);
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    const put = calls.find((c) => c.method === 'PUT')!;
    expect((put.body as { allowCashOnDeliveryDownPayment: boolean }).allowCashOnDeliveryDownPayment).toBe(false);
  });

  it('reads the saved choice', async () => {
    mockApi({ 'GET /v1/vendor/products/p1/emi-terms': { body: terms({ allowCashOnDeliveryDownPayment: false }) } });
    renderWithProviders(<EmiCard product={product} />);
    expect(await screen.findByRole('switch', { name: /allow cash on delivery for the down payment/i })).not.toBeChecked();
  });
});
