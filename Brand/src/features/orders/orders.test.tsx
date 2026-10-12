import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetSessionForTests } from '../../auth/session';
import { mockApi, renderWithProviders } from '../../test/utils';
import { availableActions, SubOrderState, type SubOrderDetail } from './api';
import { OrderActionBar } from './OrderActions';

const order = (patch: Partial<SubOrderDetail> = {}): SubOrderDetail => ({
  id: 'so-1',
  orderId: 'o-1',
  orderNumber: 'SM-1001',
  state: SubOrderState.AwaitingFulfillment,
  placedUtc: '2026-10-12T05:00:00Z',
  shipTo: {
    receiverName: 'Sita Sharma',
    receiverPhone: '+9779812345678',
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
  lineSubtotalAmount: 2500,
  lineSubtotalCurrency: 'NPR',
  subtotalAmount: 2600,
  subtotalCurrency: 'NPR',
  itemCount: 1,
  lines: [],
  delivery: null,
  ...patch,
});

describe('which actions a seller gets', () => {
  it('follows the sub-order state machine', () => {
    expect(availableActions(SubOrderState.Paid, 'Delivery')).toEqual(['accept', 'reject']);
    expect(availableActions(SubOrderState.AwaitingFulfillment, 'Delivery')).toEqual(['accept', 'reject']);
    expect(availableActions(SubOrderState.Accepted, 'Delivery')).toEqual(['pack']);
    expect(availableActions(SubOrderState.Packed, 'Delivery')).toEqual(['findRider', 'handover']);
    expect(availableActions(SubOrderState.ReadyToShip, 'Delivery')).toEqual(['tracking']);
    expect(availableActions(SubOrderState.Packed, 'StorePickup')).toEqual(['collected', 'readyToShip']);
    expect(availableActions(SubOrderState.Delivered, 'Delivery')).toEqual([]);
    expect(availableActions(SubOrderState.Cancelled, 'Delivery')).toEqual([]);
  });
});

describe('order actions', () => {
  beforeEach(() => __resetSessionForTests());

  it('accepts a new order after confirmation', async () => {
    const calls = mockApi({ 'POST /v1/vendor/sub-orders/so-1/accept': { body: { id: 'so-1', state: 12 } } });
    renderWithProviders(<OrderActionBar order={order()} onFindRider={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /accept order/i }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/accept this order/i)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: /accept order/i }));
    await waitFor(() => expect(calls.some((c) => c.path === '/v1/vendor/sub-orders/so-1/accept' && c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.path.endsWith('/accept'))!.headers['Idempotency-Key']).toBeTruthy();
  });

  it('does not accept when the seller cancels the confirmation', async () => {
    const calls = mockApi({});
    renderWithProviders(<OrderActionBar order={order()} onFindRider={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /accept order/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);
  });

  it('rejecting with "Other" needs a note for the customer', async () => {
    const calls = mockApi({ 'POST /v1/vendor/sub-orders/so-1/reject': { body: { id: 'so-1', state: 8 } } });
    renderWithProviders(<OrderActionBar order={order()} onFindRider={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^reject$/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('textbox', { name: /reason/i }));
    await user.click(await screen.findByRole('option', { name: /other reason/i }));
    await user.click(within(dialog).getByRole('button', { name: /reject order/i }));
    expect(await within(dialog).findByText(/tell the customer why/i)).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(0);

    await user.type(within(dialog).getByRole('textbox', { name: /note to the customer/i }), 'Supplier closed for Dashain');
    await user.click(within(dialog).getByRole('button', { name: /reject order/i }));
    await waitFor(() => expect(calls.some((c) => c.path.endsWith('/reject'))).toBe(true));
    expect(calls.find((c) => c.path.endsWith('/reject'))!.body).toEqual({ reasonCode: 6, note: 'Supplier closed for Dashain' });
  });

  it('packs a store-pickup order without a seal', async () => {
    const calls = mockApi({ 'POST /v1/vendor/sub-orders/so-1/packed': { body: { id: 'so-1', state: 13 } } });
    renderWithProviders(<OrderActionBar order={order({ state: SubOrderState.Accepted, fulfillmentChannel: 'StorePickup' })} onFindRider={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /^mark packed$/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /^mark packed$/i }));
    await waitFor(() => expect(calls.some((c) => c.path.endsWith('/packed'))).toBe(true));
    expect(calls.some((c) => c.path.endsWith('/seal'))).toBe(false);
  });

  it('a delivery parcel must be sealed (photo + number) before packing', async () => {
    const calls = mockApi({});
    renderWithProviders(<OrderActionBar order={order({ state: SubOrderState.Accepted })} onFindRider={vi.fn()} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /seal & mark packed/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /seal & mark packed/i }));
    expect(await within(dialog).findByText(/photo of the sealed parcel\./i)).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('offers "Find a delivery partner" for a packed delivery order', async () => {
    mockApi({});
    const onFindRider = vi.fn();
    renderWithProviders(<OrderActionBar order={order({ state: SubOrderState.Packed })} onFindRider={onFindRider} />);
    await userEvent.setup().click(screen.getByRole('button', { name: /find a delivery partner/i }));
    expect(onFindRider).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /use my own courier/i })).toBeInTheDocument();
  });
});
