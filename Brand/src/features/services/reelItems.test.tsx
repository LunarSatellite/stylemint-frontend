import { useState } from 'react';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi, renderWithProviders } from '../../test/utils';
import type { BankProduct } from './bank/api';
import BankProductsPage from './bank/BankProductsPage';
import ListingsPage from './listings/ListingsPage';
import { priceLabel, type TaggableItem } from './reelItems';
import { FeaturedItemsField } from './ReelItemPicker';
import { page, profileRoute, signInVendor, stayListing } from './testkit';

vi.mock('../../lib/useIsPhone', () => ({ useIsPhone: () => false }));

beforeEach(async () => {
  await signInVendor();
});

function item(patch: Partial<TaggableItem> = {}): TaggableItem {
  return {
    productId: 'lst-1',
    name: 'Hotel Yak & Yeti',
    primaryImageUrl: null,
    vendorAccountId: 'v-1',
    vendorDisplayName: 'Yak & Yeti',
    isService: true,
    serviceType: 1,
    serviceListingId: 'lst-1',
    displayPrice: { amount: 4500, currency: 'NPR', unit: 'night', isFrom: true, label: 'from Rs 4,500/night' },
    addableToCart: true,
    defaultVariantId: 'var-lst-1',
    createdUtc: '2026-10-19T00:00:00Z',
    ...patch,
  };
}

function bankProduct(patch: Partial<BankProduct> = {}): BankProduct {
  return {
    id: 'bp-1',
    bankId: 'bank-1',
    bankName: 'Himalayan Bank',
    type: 4,
    name: 'Home Loan',
    summary: null,
    description: null,
    interestRateMinPercent: 9.5,
    interestRateMaxPercent: 11.25,
    rateNote: null,
    feesText: null,
    eligibilityText: null,
    documentsRequired: [],
    photoUrls: [],
    minAmount: null,
    maxAmount: null,
    minTenureMonths: null,
    maxTenureMonths: null,
    currency: 'NPR',
    status: 2,
    publishedUtc: '2026-10-18T00:00:00Z',
    createdUtc: '2026-10-18T00:00:00Z',
    updatedUtc: '2026-10-18T00:00:00Z',
    ...patch,
  };
}

describe('price label on a reel tag', () => {
  it('uses the server label, else builds one per unit', () => {
    expect(priceLabel(item())).toBe('from Rs 4,500/night');
    expect(priceLabel(item({ serviceType: 2, displayPrice: { amount: 45000, currency: 'NPR', unit: 'person', isFrom: false, label: null } }))).toMatch(/^Rs 45,000 per person$/);
    expect(priceLabel(item({ serviceType: 2, displayPrice: { amount: null, currency: 'NPR', unit: 'person', isFrom: false, label: null } }))).toBe('Dates coming soon');
    expect(priceLabel(item({ serviceType: 3, addableToCart: false, displayPrice: { amount: null, currency: 'NPR', unit: null, isFrom: false, label: null } }))).toBe('Enquiry only');
  });
});

describe('listings — visible in reels', () => {
  const routes = () => ({
    ...profileRoute(1),
    'GET /v1/vendor/services/listings': {
      body: [
        stayListing({ listingId: 'lst-1', status: 2 }),
        stayListing({ listingId: 'lst-2', status: 2, title: 'Annex' }),
        stayListing({ listingId: 'lst-3', status: 1, title: 'New wing' }),
      ],
    },
  });

  it('marks each listing: visible as an item, not yet in reels, hidden (draft)', async () => {
    const calls = mockApi({ ...routes(), 'GET /v1/tag-picker/items': { body: page([item()]) } });
    renderWithProviders(
      <Routes>
        <Route path="/services/listings" element={<ListingsPage />} />
      </Routes>,
      { route: '/services/listings' },
    );
    const card1 = await screen.findByTestId('listing-lst-1');
    await waitFor(() => expect(within(card1).getByTestId('reel-visibility')).toHaveTextContent('Visible in reels as an item'));
    expect(within(screen.getByTestId('listing-lst-2')).getByTestId('reel-visibility')).toHaveTextContent('Not in reels yet');
    expect(within(screen.getByTestId('listing-lst-3')).getByTestId('reel-visibility')).toHaveTextContent('Hidden from reels');
    const picker = calls.find((c) => c.path === '/v1/tag-picker/items')!;
    expect(picker.search).toContain('scope=mine');
    expect(picker.search).toContain('kind=service');
  });

  it('shows no reel badge while the picker is not deployed (404 without errorCode)', async () => {
    mockApi(routes());
    renderWithProviders(
      <Routes>
        <Route path="/services/listings" element={<ListingsPage />} />
      </Routes>,
      { route: '/services/listings' },
    );
    await screen.findByTestId('listing-lst-1');
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByTestId('reel-visibility')).not.toBeInTheDocument();
  });
});

describe('bank products — visible in reels', () => {
  it('marks a published bank product that is a reel item', async () => {
    mockApi({
      ...profileRoute(3),
      'GET /v1/vendor/bank/products': { body: [bankProduct(), bankProduct({ id: 'bp-2', name: 'Savings Plus', status: 1 })] },
      'GET /v1/tag-picker/items': { body: page([item({ productId: 'bp-1', serviceType: 3, serviceListingId: 'bp-1', name: 'Home Loan' })]) },
    });
    renderWithProviders(
      <Routes>
        <Route path="/bank/products" element={<BankProductsPage />} />
      </Routes>,
      { route: '/bank/products' },
    );
    const row = await screen.findByTestId('bank-product-bp-1');
    await waitFor(() => expect(within(row).getByTestId('reel-visibility')).toHaveTextContent('Visible in reels as an item'));
    expect(within(screen.getByTestId('bank-product-bp-2')).getByTestId('reel-visibility')).toHaveTextContent('Hidden from reels');
  });
});

describe('featured items for a campaign brief', () => {
  function Harness({ initial = [] as string[], onChange }: { initial?: string[]; onChange: (v: string[]) => void }) {
    const [value, setValue] = useState(initial);
    return (
      <FeaturedItemsField
        value={value}
        onChange={(v) => {
          setValue(v);
          onChange(v);
        }}
      />
    );
  }

  it('lists the seller’s products and service items with their price labels and adds a service item', async () => {
    const calls = mockApi({
      'GET /v1/tag-picker/items': {
        body: page([
          item(),
          item({ productId: 'pkg-1', name: 'Annapurna Base Camp', serviceType: 2, defaultVariantId: 'var-pkg-1', displayPrice: { amount: 45000, currency: 'NPR', unit: 'person', isFrom: false, label: 'Rs 45,000 per person' } }),
          item({ productId: 'p-1', name: 'Pashmina shawl', isService: false, serviceType: null, serviceListingId: null, defaultVariantId: 'var-p-1', displayPrice: { amount: 1250, currency: 'NPR', unit: null, isFrom: false, label: 'Rs 1,250' } }),
        ]),
      },
    });
    const onChange = vi.fn();
    renderWithProviders(<Harness onChange={onChange} />);
    const hotel = await screen.findByTestId('pick-lst-1');
    expect(hotel).toHaveTextContent('from Rs 4,500/night');
    expect(hotel).toHaveTextContent('Hotel stay');
    expect(screen.getByTestId('pick-pkg-1')).toHaveTextContent('Rs 45,000 per person');
    expect(screen.getByTestId('pick-pkg-1')).toHaveTextContent('Travel package');
    expect(screen.getByTestId('pick-p-1')).not.toHaveTextContent('Hotel stay');
    expect(calls[0].search).toContain('scope=mine');

    const user = userEvent.setup();
    await user.click(within(hotel).getByRole('button', { name: 'Add Hotel Yak & Yeti' }));
    expect(onChange).toHaveBeenLastCalledWith(['var-lst-1']);
    expect(within(hotel).getByRole('button', { name: 'Remove Hotel Yak & Yeti' })).toHaveTextContent('Added');
  });

  it('says "being set up" when the picker endpoint is missing', async () => {
    mockApi({});
    renderWithProviders(<Harness onChange={vi.fn()} />);
    expect(await screen.findByText(/being set up/i)).toBeInTheDocument();
  });
});
