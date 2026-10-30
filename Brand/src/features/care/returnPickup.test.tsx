import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { notifications } from '@mantine/notifications';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetSessionForTests } from '../../auth/session';
import { mockApi, renderWithProviders } from '../../test/utils';
import type { DeliveryRequest } from '../orders/api';
import type { ReturnItem } from './api';
import CarePage from './CarePage';
import { isReceiptPending, labelOfStage, type ReturnPickup } from './returnPickup';

const LIST = 'GET /v1/vendor/returns';
const PICKUP = 'GET /v1/vendor/returns/rr-1/pickup';
const OPEN = 'POST /v1/vendor/returns/rr-1/pickup-requests';
const CURRENT = 'GET /v1/vendor/returns/rr-1/pickup-requests/current';
const SELECT = 'POST /v1/vendor/returns/rr-1/pickup-requests/current/select';
const COMPLETE = 'POST /v1/vendor/returns/rr-1/complete';

const item = (patch: Partial<ReturnItem> = {}): ReturnItem => ({
  id: 'rr-1',
  orderId: 'o-1',
  subOrderId: 'so-1',
  orderNumber: 'SM-1001',
  productTitleSnapshot: 'Linen shirt',
  variantLabelSnapshot: 'M',
  thumbnailUrlSnapshot: null,
  quantity: 1,
  reason: 'Torn at the seam',
  state: 2,
  submittedUtc: new Date().toISOString(),
  resolvedUtc: null,
  rejectionNote: null,
  reasonCategory: 'Damaged',
  pickupFarePayer: 'Seller',
  pickupStage: 'SearchingRider',
  refundBreakdown: null,
  resolution: 1,
  evidence: null,
  ...patch,
});

const page = (items: ReturnItem[]) => ({ body: { items, totalCount: items.length, nextCursor: null, hasMore: false } });

const pickup = (patch: Partial<ReturnPickup> = {}): ReturnPickup => ({
  id: 'rp-1',
  returnRequestId: 'rr-1',
  orderId: 'o-1',
  subOrderId: 'so-1',
  trackingNumber: 'SM-R-00000042',
  state: 1,
  stage: 'RidersInterested',
  mode: 'Rider',
  packageId: 'pk-9',
  requestedUtc: new Date().toISOString(),
  pickedUpUtc: null,
  receivedUtc: null,
  requestExpiresUtc: new Date(Date.now() + 600_000).toISOString(),
  rider: null,
  attempts: { failed: 0, max: 3, lastFailureCode: null },
  collectionPhotoUrls: [],
  fare: { payer: 'Seller', amount: null, upTo: { amount: 185, currency: 'NPR' }, isFinal: false },
  canCancel: true,
  canRetry: false,
  ...patch,
});

const request = (patch: Partial<DeliveryRequest> = {}): DeliveryRequest => ({
  packageId: 'pk-9',
  kind: 'Return',
  returnRequestId: 'rr-1',
  state: 'RidersInterested',
  notifiedCount: 4,
  openedUtc: new Date().toISOString(),
  expiresUtc: new Date(Date.now() + 600_000).toISOString(),
  radiusKm: 5,
  interested: [
    {
      offerId: 'of-7',
      courierId: 'c-7',
      displayName: 'Ramesh K.',
      avatarUrl: null,
      tier: 'Traveler',
      rating: 4.8,
      completedDeliveries: 31,
      distanceKm: 1.4,
      vehicle: 'Bike',
      interestedUtc: new Date().toISOString(),
      fare: { amount: 150, currency: 'NPR' },
    },
  ],
  assigned: null,
  ...patch,
});

const notFound = { status: 404, body: { title: 'Not found', status: 404, errorCode: 'resource.not_found' } };

describe('return pickup by rider (Seller Center)', () => {
  beforeEach(() => __resetSessionForTests());

  it('shows interested riders with the fare and chooses one with an Idempotency-Key', async () => {
    const user = userEvent.setup();
    let assigned = false;
    const calls = mockApi({
      [LIST]: page([item({ pickupStage: 'RidersInterested' })]),
      [PICKUP]: () => ({
        body: assigned
          ? pickup({ stage: 'RiderAssigned', state: 2, rider: { displayName: 'Ramesh K.', avatarUrl: null, rating: 4.8, vehicle: 'Bike' } })
          : pickup(),
      }),
      [CURRENT]: () => ({ body: assigned ? request({ state: 'Assigned', assigned: { courierId: 'c-7', displayName: 'Ramesh K.', avatarUrl: null, phone: null } }) : request() }),
      [SELECT]: () => {
        assigned = true;
        return { body: request({ state: 'Assigned', assigned: { courierId: 'c-7', displayName: 'Ramesh K.', avatarUrl: null, phone: null } }) };
      },
    });
    renderWithProviders(<CarePage />);

    const panel = await screen.findByTestId('return-pickup');
    expect(await within(panel).findByText('Ramesh K.')).toBeInTheDocument();
    expect(within(panel).getByText('Fare Rs 150')).toBeInTheDocument();
    expect(screen.getByTestId('reason-category')).toHaveTextContent('Arrived damaged');
    expect(screen.getByTestId('pickup-fare')).toHaveTextContent(/you pay the pickup fee \(up to rs 185\)/i);
    // Receipt not confirmed yet: "Item received" is disabled with a hint.
    expect(screen.getByTestId('mark-received-hint')).toBeInTheDocument();

    await user.click(within(panel).getByRole('button', { name: /^choose$/i }));
    await user.click(await screen.findByRole('button', { name: /choose rider/i }));

    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/current/select'))).toBe(true));
    const select = calls.find((c) => c.method === 'POST' && c.path.endsWith('/current/select'))!;
    expect(select.body).toEqual({ offerId: 'of-7' });
    expect(select.headers['Idempotency-Key']).toBeTruthy();
    expect(await screen.findByTestId('pickup-stage')).toHaveTextContent(/rider on the way to the buyer/i);
  });

  it('offers Try again when no rider was found, and re-opens the request', async () => {
    const user = userEvent.setup();
    let reopened = false;
    const calls = mockApi({
      [LIST]: page([item({ pickupStage: 'NoRiders' })]),
      [PICKUP]: () => ({ body: pickup({ stage: reopened ? 'SearchingRider' : 'NoRiders', state: reopened ? 1 : 5 }) }),
      [CURRENT]: () => ({ body: request(reopened ? { state: 'Searching', interested: [], notifiedCount: 6 } : { state: 'NoRiders', interested: [] }) }),
      [OPEN]: () => {
        reopened = true;
        return { body: request({ state: 'Searching', interested: [], notifiedCount: 6 }) };
      },
    });
    renderWithProviders(<CarePage />);

    expect(await screen.findByText(/no rider yet\. try again/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => expect(calls.filter((c) => c.method === 'POST' && c.path === '/v1/vendor/returns/rr-1/pickup-requests')).toHaveLength(1));
    expect(calls.find((c) => c.method === 'POST' && c.path.endsWith('/pickup-requests'))!.headers['Idempotency-Key']).toBeTruthy();
    expect(await screen.findByText(/riders notified \(6\)/i)).toBeInTheDocument();
  });

  it('keeps Item received disabled until the seller confirms the rider’s code', async () => {
    const user = userEvent.setup();
    let received = false;
    const calls = mockApi({
      [LIST]: page([item({ pickupStage: 'AwaitingSellerConfirmation' })]),
      [PICKUP]: () => ({
        body: received
          ? pickup({ stage: 'ReceivedBySeller', state: 4, receivedUtc: new Date().toISOString(), pickedUpUtc: new Date().toISOString() })
          : pickup({ stage: 'AwaitingSellerConfirmation', state: 3, pickedUpUtc: new Date().toISOString(), rider: { displayName: 'Ramesh K.', avatarUrl: null, rating: null, vehicle: null } }),
      }),
      'POST /v1/customer/deliveries/confirm': () => {
        received = true;
        return { body: { purpose: 'ReturnPickup', returnRequestId: 'rr-1', packageNumber: 'SM-R-00000042', status: 'ReceivedBySeller' } };
      },
    });
    renderWithProviders(<CarePage />);

    const hint = await screen.findByTestId('mark-received-hint');
    expect(hint).toBeInTheDocument();
    const disabled = screen.getByRole('button', { name: /item received/i });
    expect(disabled).toBeDisabled();

    const form = screen.getByTestId('confirm-by-code');
    expect(within(form).getByLabelText(/parcel number/i)).toHaveValue('SM-R-00000042');
    await user.type(within(form).getByLabelText(/rider’s code/i), '482913');
    await user.click(within(form).getByRole('button', { name: /confirm receipt/i }));

    await waitFor(() => expect(screen.queryByTestId('mark-received-hint')).not.toBeInTheDocument());
    const confirm = calls.find((c) => c.path === '/v1/customer/deliveries/confirm')!;
    expect(confirm.body).toEqual({ packageNumber: 'SM-R-00000042', code: '482913' });
    expect(screen.getByRole('button', { name: /item received/i })).toBeEnabled();
  });

  it('handles 409 return.pickup_not_received: says why and gates the button', async () => {
    const user = userEvent.setup();
    const show = vi.spyOn(notifications, 'show');
    let pickupReads = 0;
    mockApi({
      [LIST]: page([item({ pickupStage: 'Collected' })]),
      // First read fails (so nothing gates the button); after the 409 the fresh read says the rider still has it.
      [PICKUP]: () => {
        pickupReads += 1;
        return pickupReads === 1
          ? { status: 500, body: { title: 'Server error', status: 500 } }
          : { body: pickup({ stage: 'Collected', state: 3, pickedUpUtc: new Date().toISOString() }) };
      },
      [COMPLETE]: { status: 409, body: { title: 'Conflict', status: 409, errorCode: 'return.pickup_not_received' } },
    });
    renderWithProviders(<CarePage />);

    await screen.findByText(/could not load the return pickup/i);
    await user.click(screen.getByRole('button', { name: /item received/i }));
    await user.click(await screen.findByRole('button', { name: /yes, received/i }));

    await waitFor(() =>
      expect(show).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringMatching(/hasn’t handed this return to you yet/i) })),
    );
    expect(await screen.findByTestId('mark-received-hint')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /item received/i })).toBeDisabled();
  });

  it('a legacy return shows Find a rider, which opens a request', async () => {
    const user = userEvent.setup();
    let opened = false;
    const calls = mockApi({
      [LIST]: page([item({ pickupStage: null, reasonCategory: 'Unspecified', pickupFarePayer: null })]),
      [PICKUP]: () => (opened ? { body: pickup({ stage: 'SearchingRider' }) } : { body: pickup({ mode: 'Legacy', stage: null, packageId: null, fare: null }) }),
      [CURRENT]: () => (opened ? { body: request({ state: 'Searching', interested: [] }) } : notFound),
      [OPEN]: () => {
        opened = true;
        return { body: request({ state: 'Searching', interested: [] }) };
      },
    });
    renderWithProviders(<CarePage />);

    const find = await screen.findByRole('button', { name: /find a rider/i });
    // Legacy returns are not gated.
    expect(screen.queryByTestId('mark-received-hint')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /item received/i })).toBeEnabled();
    expect(screen.getByTestId('reason-category')).toHaveTextContent('No reason type');

    await user.click(find);
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/v1/vendor/returns/rr-1/pickup-requests')).toBe(true));
    expect(await screen.findByText(/riders notified \(4\)/i)).toBeInTheDocument();
  });

  it('a return with no pickup on a server that has the feature also offers Find a rider', async () => {
    mockApi({ [LIST]: page([item({ pickupStage: null })]), [PICKUP]: notFound });
    renderWithProviders(<CarePage />);
    expect(await screen.findByRole('button', { name: /find a rider/i })).toBeInTheDocument();
  });

  it('shows nothing extra on an older server', async () => {
    const old = item();
    delete old.pickupStage;
    delete old.reasonCategory;
    delete old.pickupFarePayer;
    delete old.refundBreakdown;
    mockApi({ [LIST]: page([old]) });
    renderWithProviders(<CarePage />);
    expect(await screen.findByRole('button', { name: /item received/i })).toBeEnabled();
    await waitFor(() => expect(screen.queryByText(/checking the return pickup/i)).not.toBeInTheDocument());
    expect(screen.queryByTestId('return-pickup')).not.toBeInTheDocument();
  });

  describe('high-value return with no Pro rider', () => {
    const noPro = () =>
      request({ state: 'NoRiders', interested: [], noRidersReason: 'delivery.no_pro_rider_high_value', canUseVerifiedRider: true });
    const searchingWithConsent = () =>
      request({
        state: 'Searching',
        interested: [],
        notifiedCount: 3,
        verifiedRiderConsent: { consentedByAccountId: 'v-1', consentedUtc: new Date().toISOString() },
      });
    const confirmButton = async () =>
      within(await screen.findByRole('dialog', { name: /use a verified rider instead/i })).getByRole('button', {
        name: /^use a verified rider$/i,
      });
    const posts = (calls: ReturnType<typeof mockApi>) =>
      calls.filter((c) => c.method === 'POST' && c.path === '/v1/vendor/returns/rr-1/pickup-requests');

    it('a stuck NoRiders return offers a verified rider and re-opens with allowVerifiedNonPro only after yes', async () => {
      const user = userEvent.setup();
      let consented = false;
      const calls = mockApi({
        [LIST]: page([item({ pickupStage: 'NoRiders' })]),
        [PICKUP]: () => ({ body: pickup({ stage: consented ? 'SearchingRider' : 'NoRiders' }) }),
        [CURRENT]: () => ({ body: consented ? searchingWithConsent() : noPro() }),
        [OPEN]: (c) => {
          consented = !!(c.body as { allowVerifiedNonPro?: boolean }).allowVerifiedNonPro;
          return { body: consented ? searchingWithConsent() : noPro() };
        },
      });
      renderWithProviders(<CarePage />);

      expect(await screen.findByTestId('no-pro-rider')).toHaveTextContent(/no pro rider is available for this high-value return/i);
      await user.click(screen.getByRole('button', { name: /^use a verified rider$/i }));
      expect(await screen.findByText(/identity checked by stylemint but is not a pro rider/i)).toBeInTheDocument();
      await user.click(await confirmButton());

      await waitFor(() => expect(posts(calls)).toHaveLength(1));
      expect(posts(calls)[0].body).toEqual({ allowVerifiedNonPro: true });
      expect(posts(calls)[0].headers['Idempotency-Key']).toBeTruthy();
      expect(await screen.findByTestId('verified-rider-consent')).toHaveTextContent(/you agreed to a verified rider/i);
    });

    it('Try again that comes back with no Pro rider asks at once; "Not now" keeps it Pro-only', async () => {
      const user = userEvent.setup();
      const calls = mockApi({
        [LIST]: page([item({ pickupStage: 'NoRiders' })]),
        [PICKUP]: () => ({ body: pickup({ stage: 'NoRiders' }) }),
        [CURRENT]: () => ({ body: request({ state: 'NoRiders', interested: [] }) }),
        [OPEN]: () => ({ body: noPro() }),
      });
      renderWithProviders(<CarePage />);

      await user.click(await screen.findByRole('button', { name: /try again/i }));
      expect(await screen.findByRole('dialog', { name: /use a verified rider instead/i })).toBeInTheDocument();
      expect(posts(calls)).toHaveLength(1);
      expect(posts(calls)[0].body).toEqual({});

      await user.click(screen.getByRole('button', { name: /not now/i }));
      await waitFor(() => expect(screen.queryByRole('dialog', { name: /use a verified rider instead/i })).not.toBeInTheDocument());
      expect(posts(calls)).toHaveLength(1);
      expect(await screen.findByTestId('no-pro-rider')).toBeInTheDocument();
    });

    it('without canUseVerifiedRider, or after consent with nobody nearby, never offers the choice', async () => {
      mockApi({
        [LIST]: page([item({ pickupStage: 'NoRiders' })]),
        [PICKUP]: () => ({ body: pickup({ stage: 'NoRiders' }) }),
        [CURRENT]: () => ({
          body: request({ state: 'NoRiders', interested: [], noRidersReason: 'delivery.no_verified_rider_high_value', canUseVerifiedRider: false }),
        }),
      });
      renderWithProviders(<CarePage />);

      expect(await screen.findByTestId('no-verified-rider')).toHaveTextContent(/none is nearby right now/i);
      expect(screen.queryByRole('button', { name: /^use a verified rider$/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  it('labels unknown stages and modes without breaking', () => {
    expect(labelOfStage('RiderAtTheMoon')).toBe('Rider at the moon');
    expect(isReceiptPending({ status: 'ok', pickup: pickup({ mode: 'Drone', stage: 'Collected' }) })).toBe(false);
    expect(isReceiptPending({ status: 'ok', pickup: pickup({ mode: 'Rider', stage: 'SomethingNew' }) })).toBe(false);
    expect(isReceiptPending({ status: 'ok', pickup: pickup({ mode: 'Rider', stage: 'Collected' }) })).toBe(true);
  });
});
