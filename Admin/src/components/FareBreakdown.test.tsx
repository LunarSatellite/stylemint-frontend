import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installSession, resetSessionForTests } from '@/auth/session';
import { DeliveryPage } from '@/features/delivery/DeliveryPage';
import { mockFetch, renderWithProviders, signInAs } from '@/test/utils';
import { FareAmount } from './FareBreakdown';

/** Rider-fare contract v1, §2. */
const ROAD = {
  version: 1,
  method: 'road',
  roadKm: 7.42,
  straightLineKm: 5.31,
  roadDurationSeconds: 1080,
  detourFactor: null,
  baseFare: 50,
  perKm: 30,
  distanceAmount: 222.6,
  tier: 'Traveler',
  tierMultiplier: 1,
  tripAmount: 272.6,
  minimumFare: 100,
  minimumApplied: false,
  extras: [
    { code: 'heavy_parcel', label: 'Heavy parcel (over 5 kg)', amount: 50 },
    { code: 'cash_collection', label: 'Cash collection', amount: 20 },
    { code: 'night', label: 'Night pick-up (21:00-06:00)', amount: 30 },
  ],
  extrasAmount: 100,
  roundTo: 5,
  rounding: 2.4,
  total: 375,
  currency: 'NPR',
  computedUtc: '2026-10-18T15:30:00+00:00',
};

const ESTIMATED = { ...ROAD, method: 'estimated', roadKm: 2, straightLineKm: 1.48, detourFactor: 1.35, distanceAmount: 60, tier: 'Neighbor', tierMultiplier: 0.85, tripAmount: 100, minimumApplied: true, extras: [], rounding: 0, total: 100 };

beforeEach(() => {
  installSession();
  resetSessionForTests();
});
afterEach(() => vi.unstubAllGlobals());

describe('FareAmount', () => {
  it('opens the full breakdown: base, road distance, tier, each extra, rounding, total', async () => {
    renderWithProviders(<FareAmount amount={375} currency="NPR" breakdown={ROAD} />);
    expect(screen.queryByText('est.')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /show breakdown/ }));
    const table = await screen.findByTestId('fare-breakdown');
    expect(table).toHaveTextContent('Base fare');
    expect(table).toHaveTextContent('7.4 km by road');
    expect(table).toHaveTextContent('Traveller ×1');
    expect(table).toHaveTextContent('Heavy parcel (over 5 kg)');
    expect(table).toHaveTextContent('Cash collection');
    expect(table).toHaveTextContent('Night pick-up (21:00-06:00)');
    expect(table).toHaveTextContent('Rounded');
    expect(within(table).getByText('Total')).toBeInTheDocument();
    expect(table).not.toHaveTextContent('Estimated');
  });

  it('tags an estimated distance and says why', async () => {
    renderWithProviders(<FareAmount amount={100} currency="NPR" breakdown={ESTIMATED} />);
    expect(screen.getByText('est.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /show breakdown/ }));
    const table = await screen.findByTestId('fare-breakdown');
    expect(table).toHaveTextContent('2.0 km, estimated');
    expect(table).toHaveTextContent('Minimum fare applied');
    expect(table).toHaveTextContent('Neighbour ×0.85');
    expect(table).toHaveTextContent('road distance was not available');
  });

  it('a fare from before breakdowns is the amount alone', () => {
    renderWithProviders(<FareAmount amount={180} currency="NPR" breakdown={null} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText(/180/)).toBeInTheDocument();
  });

  it("reads the payout ledger's line form (contract v2)", async () => {
    const lines = {
      ref: null,
      method: 'estimated',
      distanceKm: 2,
      tier: 'Neighbor',
      lines: [
        { code: 'trip', label: 'Base Rs 50 + 2.00 km × Rs 30', amount: 100 },
        { code: 'night', label: 'Night pick-up', amount: 30 },
      ],
    };
    renderWithProviders(<FareAmount amount={130} currency="NPR" breakdown={lines} />);
    expect(screen.getByText('est.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /show breakdown/ }));
    const table = await screen.findByTestId('fare-lines');
    expect(table).toHaveTextContent('2.0 km, estimated · Neighbour');
    expect(table).toHaveTextContent('Base Rs 50 + 2.00 km × Rs 30');
    expect(table).toHaveTextContent('Night pick-up');
  });

  it('a single legacy "fare" line is the amount alone', () => {
    renderWithProviders(<FareAmount amount={180} currency="NPR" breakdown={{ ref: null, lines: [{ code: 'fare', label: 'Delivery fare', amount: 180 }] }} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('delivery parcel lookup', () => {
  it("shows each leg's rider fare with its breakdown", async () => {
    signInAs(['SupportAgent']);
    mockFetch((req) => {
      if (req.path === '/v1/admin/delivery/packages/awaiting-courier') return { body: [] };
      if (req.path === '/v1/admin/delivery/packages/by-sub-order/so-1')
        return {
          body: {
            id: 'pk-1',
            subOrderId: 'so-1',
            trackingNumber: 'SMD-8F2K1Q',
            state: 4,
            weightGrams: 6200,
            lengthMm: 0,
            widthMm: 0,
            heightMm: 0,
            declaredValueAmount: 5000,
            declaredValueCurrency: 'NPR',
            isFragile: false,
            isTimeSensitive: false,
            deliverByUtc: null,
            originAddressLine: 'Thamel',
            destinationAddressLine: 'Baluwatar',
            hasSeal: true,
            sealedUtc: null,
            dispatchedUtc: null,
            deliveredUtc: null,
            createdUtc: '2026-10-18T08:00:00Z',
            hops: [
              {
                id: 'h1',
                packageId: 'pk-1',
                hopIndex: 0,
                tier: 2,
                courierProfileId: 'c-1',
                state: 5,
                fromGeohash: 'tuutv',
                toGeohash: 'tuutw',
                acceptedUtc: null,
                pickedUpUtc: null,
                handedOffUtc: null,
                courierPayoutAmount: 375,
                courierPayoutCurrency: 'NPR',
                fareBreakdown: ROAD,
                failureCode: null,
                failureNote: null,
              },
            ],
          },
        };
      return undefined;
    });
    renderWithProviders(<DeliveryPage />, { route: '/delivery' });
    await userEvent.type(await screen.findByPlaceholderText('Sub-order ID'), 'so-1');
    await userEvent.click(screen.getByRole('button', { name: 'Find' }));

    const legs = await screen.findByRole('table', { name: 'Legs' });
    expect(legs).toHaveTextContent('Traveller');
    expect(legs).toHaveTextContent('Picked up');
    await userEvent.click(within(legs).getByRole('button', { name: /show breakdown/ }));
    expect(await screen.findByTestId('fare-breakdown')).toHaveTextContent('Heavy parcel (over 5 kg)');
  });
});
