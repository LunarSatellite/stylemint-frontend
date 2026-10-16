import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { __resetSessionForTests } from '../../auth/session';
import { mockApi, renderWithProviders } from '../../test/utils';
import { SubOrderState, type DeliveryRequest, type SubOrderDetail } from './api';
import { DeliveryPartnerDrawer } from './DeliveryPartner';

const order = {
  id: 'so-1',
  orderNumber: 'NK2026-00028',
  state: SubOrderState.Packed,
  fulfillmentChannel: 'Delivery',
} as unknown as SubOrderDetail;

const request = (patch: Partial<DeliveryRequest> = {}): DeliveryRequest => ({
  packageId: 'pk-1',
  state: 'NoRiders',
  notifiedCount: 0,
  openedUtc: new Date().toISOString(),
  expiresUtc: new Date(Date.now() + 600_000).toISOString(),
  radiusKm: 5,
  interested: [],
  assigned: null,
  noRidersReason: null,
  canUseVerifiedRider: false,
  verifiedRiderConsent: null,
  ...patch,
});

const noPro = () => request({ noRidersReason: 'delivery.no_pro_rider_high_value', canUseVerifiedRider: true });
const searchingWithConsent = () =>
  request({
    state: 'Searching',
    notifiedCount: 1,
    verifiedRiderConsent: { consentedByAccountId: 'v-1', consentedUtc: new Date().toISOString() },
  });

const OPEN = 'POST /v1/vendor/sub-orders/so-1/delivery-requests';
const CURRENT = 'GET /v1/vendor/sub-orders/so-1/delivery-requests/current';
const notFound = { status: 404, body: { title: 'none', status: 404, errorCode: 'resource.not_found' } };

describe('high-value parcel with no Pro rider', () => {
  beforeEach(() => __resetSessionForTests());

  it('says no Pro rider is available, asks, and retries with allowVerifiedNonPro only after yes', async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      [CURRENT]: notFound,
      [OPEN]: (c) => ({ body: (c.body as { allowVerifiedNonPro?: boolean }).allowVerifiedNonPro ? searchingWithConsent() : noPro() }),
    });
    renderWithProviders(<DeliveryPartnerDrawer order={order} opened onClose={() => {}} />);

    await user.click(await screen.findByRole('button', { name: /find a delivery partner/i }));

    expect(await screen.findByText(/no pro rider is available for this high-value parcel/i)).toBeInTheDocument();
    expect(await screen.findByText(/use a verified rider instead\?/i)).toBeInTheDocument();
    expect(screen.getByText(/identity checked by stylemint but is not a pro rider/i)).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({});

    // The alert's button and the dialog's confirm share a label; the dialog renders last.
    const buttons = screen.getAllByRole('button', { name: /^use a verified rider$/i });
    await user.click(buttons[buttons.length - 1]);

    await waitFor(() => expect(calls.filter((c) => c.method === 'POST')).toHaveLength(2));
    const [first, second] = calls.filter((c) => c.method === 'POST');
    expect(second.body).toEqual({ allowVerifiedNonPro: true });
    expect(second.headers['Idempotency-Key']).toBeTruthy();
    expect(second.headers['Idempotency-Key']).not.toEqual(first.headers['Idempotency-Key']);
    expect(await screen.findByTestId('verified-rider-consent')).toHaveTextContent(/you agreed to a verified rider/i);
  });

  it('declining keeps the parcel Pro-only and leaves the choice on screen', async () => {
    const user = userEvent.setup();
    const calls = mockApi({ [CURRENT]: notFound, [OPEN]: () => ({ body: noPro() }) });
    renderWithProviders(<DeliveryPartnerDrawer order={order} opened onClose={() => {}} />);

    await user.click(await screen.findByRole('button', { name: /find a delivery partner/i }));
    await user.click(await screen.findByRole('button', { name: /not now/i }));

    await waitFor(() => expect(screen.queryByText(/use a verified rider instead\?/i)).not.toBeInTheDocument());
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
    expect(screen.getByTestId('no-pro-rider')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^use a verified rider$/i })).toBeInTheDocument();
  });

  it('a request reloaded in the no-Pro state offers the choice from its button', async () => {
    const user = userEvent.setup();
    const calls = mockApi({
      [CURRENT]: () => ({ body: noPro() }),
      [OPEN]: () => ({ body: searchingWithConsent() }),
    });
    renderWithProviders(<DeliveryPartnerDrawer order={order} opened onClose={() => {}} />);

    await user.click(await screen.findByRole('button', { name: /^use a verified rider$/i }));
    const dialogButtons = await screen.findAllByRole('button', { name: /^use a verified rider$/i });
    await user.click(dialogButtons[dialogButtons.length - 1]);

    await waitFor(() => expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1));
    expect(calls.find((c) => c.method === 'POST')!.body).toEqual({ allowVerifiedNonPro: true });
  });

  it('after consent with nobody verified nearby, says so and does not ask again', async () => {
    mockApi({
      [CURRENT]: () => ({ body: request({ noRidersReason: 'delivery.no_verified_rider_high_value', canUseVerifiedRider: false }) }),
    });
    renderWithProviders(<DeliveryPartnerDrawer order={order} opened onClose={() => {}} />);

    expect(await screen.findByText(/no verified rider is available nearby either/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^use a verified rider$/i })).not.toBeInTheDocument();
  });

  it('an ordinary no-riders answer shows the ordinary message and never asks', async () => {
    const user = userEvent.setup();
    const calls = mockApi({ [CURRENT]: notFound, [OPEN]: () => ({ body: request() }) });
    renderWithProviders(<DeliveryPartnerDrawer order={order} opened onClose={() => {}} />);

    await user.click(await screen.findByRole('button', { name: /find a delivery partner/i }));

    expect(await screen.findByText(/no riders were available nearby/i)).toBeInTheDocument();
    expect(screen.queryByText(/use a verified rider instead\?/i)).not.toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(1);
  });
});
