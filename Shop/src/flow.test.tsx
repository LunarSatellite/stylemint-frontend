import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { nav } from './lib/nav';
import { guestCart } from './shop/guestCart';
import {
  authResponse,
  cartLine,
  cartView,
  checkoutSession,
  mockApi,
  PRODUCT_ID,
  product,
  renderApp,
  resetShop,
  routerPath,
  signIn,
  TAG_ID,
  VARIANT_L,
  VENDOR_ID,
} from './test/utils';

const ORDER_NO = 'NK2026-00041';
const ADDRESS_ID = 'ffffffff-0000-4000-8000-000000000001';

function shopApi() {
  let serverLines: unknown[] = [];
  return mockApi({
    [`GET /v1/public/products/${PRODUCT_ID}`]: { body: product() },
    [`POST /v1/public/products/${PRODUCT_ID}/views`]: { status: 202 },
    'POST /v1/auth/login-otp/request': { body: { otpId: 'o1', accountId: 'a', expiresUtc: new Date().toISOString(), devPlaintextCode: null, isNewAccount: true } },
    'POST /v1/auth/login-otp/verify': { body: authResponse({ isNewAccount: true }) },
    'POST /v1/cart/lines': () => {
      serverLines = [cartLine()];
      return { body: cartView(serverLines) };
    },
    'GET /v1/cart': () => ({ body: cartView(serverLines) }),
    'POST /v1/checkout/sessions': { body: checkoutSession() },
    'GET /v1/addresses': {
      body: [{ id: ADDRESS_ID, label: 'Home', receiverName: 'Sita', receiverPhone: '+9779812345678', locationNote: 'Jhamsikhel', mapsLink: null, latitude: 27.68, longitude: 85.31, city: 'Lalitpur', addressLine1: null, isDefault: true }],
    },
    'POST /v1/checkout/sessions/sess-1/address': { body: checkoutSession({ shippingAddressId: ADDRESS_ID }) },
    'POST /v1/checkout/sessions/sess-1/delivery': { body: checkoutSession({ shippingAddressId: ADDRESS_ID }) },
    'GET /v1/checkout/sessions/sess-1/delivery-options': {
      body: { sessionId: 'sess-1', choices: [{ kind: 1, title: 'Home delivery', detail: '2–3 days', readyInDays: 3, sellerAccountId: null, sellerName: null, selected: true, recommended: true }] },
    },
    'POST /v1/checkout/sessions/sess-1/payment-method': { body: checkoutSession({ shippingAddressId: ADDRESS_ID, paymentMethod: 4 }) },
    'POST /v1/checkout/sessions/sess-1/place': { body: checkoutSession({ status: 3, orderNumber: ORDER_NO, orderId: 'ord-1' }) },
    [`GET /v1/orders/${ORDER_NO}`]: {
      body: {
        id: 'ord-1',
        orderNumber: ORDER_NO,
        state: 1,
        paymentMethod: 4,
        grandTotalAmount: 12650,
        grandTotalCurrency: 'NPR',
        shippingTotalAmount: 150,
        subOrders: [
          {
            id: 'so-1',
            vendorAccountId: VENDOR_ID,
            state: 1,
            subtotalAmount: 12500,
            subtotalCurrency: 'NPR',
            lines: [{ id: 'l1', quantity: 1, unitPriceAmount: 12500, unitPriceCurrency: 'NPR', productTitleSnapshot: 'Down jacket', optionLabel: 'L', variantLabelSnapshot: 'L', thumbnailUrlSnapshot: null }],
          },
        ],
      },
    },
    [`GET /v1/public/brands/${VENDOR_ID}`]: { body: { accountId: VENDOR_ID, businessName: 'Peak Gear', logoUrl: null, coverImageUrl: null, tagline: null, description: null, isVerified: true, returnPolicySummary: null } },
  });
}

describe('happy path: product → cart → sign-in → checkout → placed', () => {
  beforeEach(() => resetShop('signedOut'));

  it('buys as a guest from an Instagram link, signs in with a phone code and pays cash on delivery', async () => {
    const calls = shopApi();
    const user = userEvent.setup();
    renderApp(`/p/${PRODUCT_ID}?t=${TAG_ID}&ref=MAYA&utm_source=instagram`);

    // Product: pick size L, Buy now (guest cart, no API call to the cart).
    expect(await screen.findByRole('heading', { name: 'Down jacket' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'L' }));
    await user.click(screen.getByRole('button', { name: 'Buy now' }));
    expect(guestCart.items()).toHaveLength(1);
    expect(calls.some((c) => c.path === '/v1/cart/lines')).toBe(false);

    // Cart: grouped under the shop, checkout asks to sign in.
    expect(await screen.findByRole('heading', { name: 'Your cart' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Peak Gear' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Checkout' }));

    // Sign in with a phone code (no social config deployed → phone only).
    await user.type(await screen.findByLabelText('Mobile number'), '981-234-5678');
    await user.click(screen.getByRole('button', { name: 'Continue with phone number' }));
    const otp = calls.find((c) => c.path === '/v1/auth/login-otp/request');
    expect(otp?.body).toEqual({ identifierType: 2, identifier: '+9779812345678' });
    await user.type(await screen.findByLabelText(/Enter the code/), '12345');
    await user.click(screen.getByRole('button', { name: 'Verify and continue' }));

    // The guest cart is replayed with the attribution and its own Idempotency-Key.
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/v1/cart/lines')).toBe(true));
    const replay = calls.find((c) => c.method === 'POST' && c.path === '/v1/cart/lines')!;
    expect(replay.body).toEqual({ productId: PRODUCT_ID, productVariantId: VARIANT_L, quantity: 1, reelTagContextId: TAG_ID, affiliateCode: 'MAYA' });
    expect(replay.headers['Idempotency-Key']).toBeTruthy();
    expect(replay.headers.Authorization).toMatch(/^Bearer /);

    // Checkout: the default address is chosen, cash on delivery is the default.
    expect(await screen.findByRole('heading', { name: 'Checkout' })).toBeInTheDocument();
    await waitFor(() => expect(calls.some((c) => c.path === '/v1/checkout/sessions/sess-1/address')).toBe(true));
    expect(calls.find((c) => c.method === 'POST' && c.path === '/v1/checkout/sessions')?.body).toEqual({ surface: 'shop' });
    expect(await screen.findByText('Home delivery')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Place order' }));

    // Placed page.
    expect(await screen.findByText('Your order is placed')).toBeInTheDocument();
    expect(routerPath()).toBe(`/orders/${ORDER_NO}/placed`);
    expect(calls.find((c) => c.path === '/v1/checkout/sessions/sess-1/payment-method')?.body).toEqual({ paymentMethod: 4 });
    const place = calls.find((c) => c.path === '/v1/checkout/sessions/sess-1/place');
    expect(place?.headers['Idempotency-Key']).toBeTruthy();
    expect(await screen.findByRole('heading', { name: 'Peak Gear' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open in app' })).toHaveAttribute('href', `/app/orders/${ORDER_NO}`);
    expect(screen.getByRole('link', { name: 'Get it on Google Play' })).toHaveAttribute('href', expect.stringContaining('app.stylemint.stylemint_mobile_frontend'));
    expect(guestCart.items()).toHaveLength(0);
    expect(localStorage.getItem('sm_shop_checkout')).toBeNull();
  });

  it('sends eSewa buyers to the payment redirect and keeps the session id for the return page', async () => {
    signIn();
    const assign = vi.spyOn(nav, 'assign').mockImplementation(() => undefined);
    const calls = mockApi({
      'POST /v1/checkout/sessions': { body: checkoutSession({ shippingAddressId: ADDRESS_ID }) },
      'GET /v1/addresses': { body: [{ id: ADDRESS_ID, label: 'Home', receiverName: 'Sita', receiverPhone: '+9779812345678', locationNote: 'Jhamsikhel', mapsLink: null, latitude: 1, longitude: 1, city: null, addressLine1: null, isDefault: true }] },
      'POST /v1/checkout/sessions/sess-1/address': { body: checkoutSession({ shippingAddressId: ADDRESS_ID }) },
      'POST /v1/checkout/sessions/sess-1/delivery': { body: checkoutSession({ shippingAddressId: ADDRESS_ID }) },
      'POST /v1/checkout/sessions/sess-1/payment-method': { body: checkoutSession({ paymentMethod: 3 }) },
      'POST /v1/checkout/sessions/sess-1/place': { body: checkoutSession({ status: 6, paymentRedirectUrl: '/payments/esewa/checkout?d=abc' }) },
    });
    const user = userEvent.setup();
    renderApp('/checkout');
    await user.click(await screen.findByRole('radio', { name: /eSewa/ }));
    await user.click(screen.getByRole('button', { name: 'Pay with eSewa' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/payments/esewa/checkout?d=abc'));
    expect(calls.find((c) => c.path === '/v1/checkout/sessions/sess-1/payment-method')?.body).toEqual({ paymentMethod: 3 });
    expect(localStorage.getItem('sm_shop_checkout')).toBe('sess-1');
  });

  it('asks for a location or a maps link before saving a first address', async () => {
    signIn();
    const calls = mockApi({
      'POST /v1/checkout/sessions': { body: checkoutSession() },
      'GET /v1/addresses': { body: [] },
      'POST /v1/addresses': { body: { id: ADDRESS_ID, label: 'Home', receiverName: 'Sita', receiverPhone: '+9779812345678', locationNote: 'Jhamsikhel', mapsLink: 'https://maps.app.goo.gl/x', latitude: null, longitude: null, city: null, addressLine1: null, isDefault: true } },
      'POST /v1/checkout/sessions/sess-1/address': { body: checkoutSession({ shippingAddressId: ADDRESS_ID }) },
      'POST /v1/checkout/sessions/sess-1/delivery': { body: checkoutSession({ shippingAddressId: ADDRESS_ID }) },
    });
    const user = userEvent.setup();
    renderApp('/checkout');
    await user.type(await screen.findByLabelText('Receiver’s name'), 'Sita');
    await user.type(screen.getByLabelText('Phone number for the rider'), '9812345678');
    await user.type(screen.getByLabelText('Area, street and landmark'), 'Jhamsikhel');
    await user.click(screen.getByRole('button', { name: 'Save address' }));
    expect(await screen.findByText(/Share your location or paste a Google Maps link/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/paste a Google Maps link/), 'https://maps.app.goo.gl/x');
    await user.click(screen.getByRole('button', { name: 'Save address' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/v1/addresses')).toBe(true));
    expect(calls.find((c) => c.method === 'POST' && c.path === '/v1/addresses')?.body).toMatchObject({
      label: 'Home',
      receiverName: 'Sita',
      receiverPhone: '+9779812345678',
      country: 'NP',
      locationNote: 'Jhamsikhel',
      mapsLink: 'https://maps.app.goo.gl/x',
      makeDefault: true,
    });
  });
});
