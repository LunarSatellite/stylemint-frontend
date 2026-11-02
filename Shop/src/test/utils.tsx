import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import { AppRoutes, createQueryClient, Providers } from '../App';
import { __resetSessionForTests, establish, type AuthStatus } from '../auth/session';
import { guestCart } from '../shop/guestCart';

const b64url = (obj: unknown) => btoa(JSON.stringify(obj)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

export function fakeJwt(claims: Record<string, unknown>): string {
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ exp: Math.floor(Date.now() / 1000) + 900, ...claims })}.sig`;
}

export const ACCOUNT_ID = '11111111-2222-3333-4444-555555555555';
export const SESSION_ID = '99999999-8888-7777-6666-555555555555';

export function authResponse(extra: Record<string, unknown> = {}) {
  return {
    accountId: ACCOUNT_ID,
    sessionId: SESSION_ID,
    accessToken: fakeJwt({ sub: ACCOUNT_ID, session_id: SESSION_ID, roles: ['Customer'] }),
    accessExpiresUtc: new Date(Date.now() + 15 * 60_000).toISOString(),
    refreshToken: 'refresh-1',
    refreshExpiresUtc: new Date(Date.now() + 30 * 86400_000).toISOString(),
    tokenType: 'Bearer',
    isNewAccount: false,
    displayNameConfirmed: true,
    ...extra,
  };
}

/** Fresh session + guest cart for a test. */
export function resetShop(status: AuthStatus = 'signedOut') {
  localStorage.clear();
  guestCart.__reload();
  __resetSessionForTests(status);
}

export function signIn() {
  establish(authResponse(), 'phone');
}

let currentPath = '';
function LocationProbe() {
  const l = useLocation();
  currentPath = l.pathname + l.search;
  return null;
}
/** The router path the app is on (without the /shop basename). */
export const routerPath = () => currentPath;

export function renderApp(route: string) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false, staleTime: 0 }, mutations: { retry: false } });
  return {
    client,
    ...render(
      <Providers client={client}>
        <MemoryRouter initialEntries={[route]}>
          <LocationProbe />
          <AppRoutes />
        </MemoryRouter>
      </Providers>,
    ),
  };
}

export interface RecordedCall {
  method: string;
  path: string;
  search: string;
  body: unknown;
  headers: Record<string, string>;
}

type Reply = { status?: number; body?: unknown } | undefined;
type Handler = (call: RecordedCall) => Reply;

/**
 * Stubs global fetch with a route table: `"POST /v1/cart/lines": handler`. Unmatched calls answer 404 with an
 * empty body (like an undeployed route). Returns the list of calls made.
 */
export function mockApi(routes: Record<string, Handler | Reply>) {
  const calls: RecordedCall[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input.toString(), 'http://localhost');
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = (init?.headers ?? {}) as Record<string, string>;
    let body: unknown = undefined;
    if (typeof init?.body === 'string') body = JSON.parse(init.body);
    const call: RecordedCall = { method, path: url.pathname, search: url.search, body, headers };
    calls.push(call);
    const route = routes[`${method} ${url.pathname}`];
    const res = typeof route === 'function' ? route(call) : route;
    if (!res) return new Response('', { status: 404 });
    const status = res.status ?? 200;
    if (status === 204 || res.body === undefined) return new Response(null, { status: status === 200 ? 204 : status });
    return new Response(JSON.stringify(res.body), { status, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

// ---------------------------------------------------------------- fixtures

export const PRODUCT_ID = 'aaaaaaaa-0000-4000-8000-000000000001';
export const VARIANT_M = 'bbbbbbbb-0000-4000-8000-000000000001';
export const VARIANT_L = 'bbbbbbbb-0000-4000-8000-000000000002';
export const VENDOR_ID = 'cccccccc-0000-4000-8000-000000000001';
export const TAG_ID = 'dddddddd-0000-4000-8000-000000000001';

export function product(overrides: Record<string, unknown> = {}) {
  return {
    id: PRODUCT_ID,
    vendorAccountId: VENDOR_ID,
    vendorDisplayName: 'Peak Gear',
    name: 'Down jacket',
    shortDescription: 'Warm.',
    state: 2,
    variants: [
      { id: VARIANT_M, isDefault: true, priceAmount: 12000, priceCurrency: 'NPR', trackInventory: true, allowOverselling: false, quantityOnHand: 4, optionLabel: 'M' },
      { id: VARIANT_L, isDefault: false, priceAmount: 12500, priceCurrency: 'NPR', trackInventory: true, allowOverselling: false, quantityOnHand: 2, optionLabel: 'L' },
    ],
    images: [{ id: 'i1', cdnUrl: 'https://cdn.example/j.jpg', sortOrder: 0, isPrimary: true }],
    defaultVariantId: VARIANT_M,
    isInStock: true,
    ...overrides,
  };
}

export function cartLine(overrides: Record<string, unknown> = {}) {
  return {
    lineId: 'line-1',
    productId: PRODUCT_ID,
    productVariantId: VARIANT_L,
    quantity: 1,
    unitPriceAmount: 12500,
    unitPriceCurrency: 'NPR',
    lineSubtotalAmount: 12500,
    productTitleSnapshot: 'Down jacket',
    variantLabelSnapshot: 'L',
    optionLabel: 'L',
    thumbnailUrlSnapshot: null,
    ...overrides,
  };
}

export function cartView(lines: unknown[], extra: Record<string, unknown> = {}) {
  return {
    lines,
    itemCount: lines.length,
    subtotalAmount: 12500,
    subtotalCurrency: 'NPR',
    shippingAmount: 0,
    discountAmount: 0,
    grandTotalAmount: 12500,
    grandTotalCurrency: 'NPR',
    notices: [],
    ...extra,
  };
}

export function checkoutSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sess-1',
    shippingAddressId: null,
    fulfillmentType: 1,
    paymentMethod: null,
    orderId: null,
    orderNumber: null,
    status: 1,
    failureReason: null,
    items: [cartLine()],
    itemCount: 1,
    subtotalAmount: 12500,
    subtotalCurrency: 'NPR',
    shippingAmount: 150,
    discountAmount: 0,
    totalAmount: 12650,
    totalCurrency: 'NPR',
    failedLines: [],
    paymentRedirectUrl: null,
    ...overrides,
  };
}
