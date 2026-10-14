import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { __resetSessionForTests } from '../../auth/session';
import { mockApi, renderWithProviders } from '../../test/utils';
import { SubOrderState, type DeliveryRequest, type SubOrderDetail } from './api';
import { DeliveryPartnerDrawer } from './DeliveryPartner';

const order = {
  id: 'so-1',
  orderNumber: 'SM-1001',
  state: SubOrderState.Packed,
  fulfillmentChannel: 'Delivery',
} as unknown as SubOrderDetail;

const request = (patch: Partial<DeliveryRequest> = {}): DeliveryRequest => ({
  packageId: 'pk-1',
  state: 'RidersInterested',
  notifiedCount: 3,
  openedUtc: new Date().toISOString(),
  expiresUtc: new Date(Date.now() + 600_000).toISOString(),
  radiusKm: 5,
  interested: [
    { offerId: 'of-1', courierId: 'c-1', displayName: 'Ram Thapa', avatarUrl: null, tier: 'Neighbor', rating: 4.8, completedDeliveries: 12, distanceKm: 1.2, vehicle: 'Bike', interestedUtc: new Date().toISOString() },
  ],
  assigned: null,
  ...patch,
});

describe('sealing before choosing a rider', () => {
  beforeEach(() => __resetSessionForTests());

  it('when choosing is refused for a missing seal, seals the parcel and then chooses the same rider', async () => {
    const user = userEvent.setup();
 let sealed = false;
    let assigned = false;
    const done = () => request({ state: 'Assigned', assigned: { courierId: 'c-1', displayName: 'Ram Thapa', avatarUrl: null, phone: null } });
    const calls = mockApi({
      'GET /v1/vendor/sub-orders/so-1/delivery-requests/current': () => ({ body: assigned ? done() : request() }),
      'POST /v1/vendor/sub-orders/so-1/delivery-requests/current/select': () =>
        sealed
          ? ((assigned = true), { body: done() })
          : { status: 422, body: { title: 'Parcel not sealed', status: 422, errorCode: 'delivery_request.parcel_not_sealed' } },
      'POST /v1/vendor/packages/seal-images': { body: { url: 'https://cdn/seal.jpg' } },
      'POST /v1/vendor/sub-orders/so-1/seal': () => {
        sealed = true;
        return { body: true };
      },
    });
    renderWithProviders(<DeliveryPartnerDrawer order={order} opened onClose={() => {}} />);

    await user.click(await screen.findByRole('button', { name: /^choose$/i }));
    await user.click(await screen.findByRole('button', { name: /choose rider/i }));

    const form = await screen.findByTestId('seal-form');
    expect(screen.getByRole('alert')).toHaveTextContent(/no seal yet/i);
    await user.upload(form.querySelector('input[type="file"]') as HTMLInputElement, new File(['x'], 'seal.jpg', { type: 'image/jpeg' }));
    await user.type(within(form).getByLabelText(/seal number/i), 'SM-482913');
    await user.click(within(form).getByRole('button', { name: /seal and choose rider/i }));

    await waitFor(() => expect(calls.filter((c) => c.path.endsWith('/select'))).toHaveLength(2));
    expect(calls.find((c) => c.path.endsWith('/seal'))!.body).toEqual({ sealId: 'SM-482913', sealPhotoUrl: 'https://cdn/seal.jpg' });
    expect(calls.filter((c) => c.path.endsWith('/select')).every((c) => (c.body as { offerId: string }).offerId === 'of-1')).toBe(true);
    expect(await screen.findByText(/your delivery partner/i)).toBeInTheDocument();
  });

  it('offers to add a seal before searching', async () => {
    const user = userEvent.setup();
    mockApi({ 'GET /v1/vendor/sub-orders/so-1/delivery-requests/current': { status: 404, body: { title: 'none', status: 404, errorCode: 'resource.not_found' } } });
    renderWithProviders(<DeliveryPartnerDrawer order={order} opened onClose={() => {}} />);
    await user.click(await screen.findByRole('button', { name: /add seal/i }));
    expect(await screen.findByTestId('seal-form')).toBeInTheDocument();
  });
});
