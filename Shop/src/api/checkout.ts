import { api } from './client';
import type { CartLine } from './cart';

/** Checkout (contract A5): start → delivery-options → address → delivery → payment-method → place. */

export const PaymentMethod = { Esewa: 3, CashOnDelivery: 4 } as const;
export type PaymentMethodValue = (typeof PaymentMethod)[keyof typeof PaymentMethod];

/** CheckoutSession status: 1 Draft, 2 Placing, 3 Placed, 4 Failed, 5 Expired, 6 AwaitingPayment. */
export const SessionStatus = { Draft: 1, Placing: 2, Placed: 3, Failed: 4, Expired: 5, AwaitingPayment: 6 } as const;

export interface CheckoutSession {
  id: string;
  shippingAddressId: string | null;
  fulfillmentType: number | null;
  paymentMethod: number | null;
  orderId: string | null;
  orderNumber: string | null;
  status: number;
  failureReason: string | null;
  items: CartLine[];
  itemCount: number;
  subtotalAmount: number;
  subtotalCurrency: string;
  shippingAmount: number;
  discountAmount: number;
  totalAmount: number;
  totalCurrency: string;
  failedLines?: { lineId: string; reasonMessage: string | null }[];
  paymentRedirectUrl?: string | null;
  paymentRequiresAction?: boolean;
  requiresShippingAddress?: boolean;
}

export interface DeliveryChoice {
  /** 1 HomeDelivery, 2 PickupFromSeller */
  kind: number;
  title: string;
  detail: string | null;
  readyInDays: number | null;
  sellerAccountId: string | null;
  sellerName: string | null;
  selected: boolean;
  recommended: boolean;
}

export interface DeliveryChoices {
  sessionId: string;
  choices: DeliveryChoice[];
}

export interface ShippingAddress {
  id: string;
  label: string;
  receiverName: string;
  receiverPhone: string;
  locationNote: string | null;
  mapsLink: string | null;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  addressLine1: string | null;
  isDefault: boolean;
}

export interface NewAddress {
  label: string;
  receiverName: string;
  receiverPhone: string;
  country: 'NP';
  locationNote?: string;
  mapsLink?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracyMetres?: number;
  /** 1 DeviceGps */
  locationCapturedFrom?: number;
  city?: string;
  addressLine1?: string;
  makeDefault: boolean;
}

const s = (id: string) => `/v1/checkout/sessions/${id}`;

export const checkoutApi = {
  start: () => api.post<CheckoutSession>('/v1/checkout/sessions', { surface: 'shop' }),
  get: (id: string) => api.get<CheckoutSession>(s(id)),
  deliveryOptions: (id: string) => api.get<DeliveryChoices>(`${s(id)}/delivery-options`),
  setAddress: (id: string, addressId: string) => api.post<CheckoutSession>(`${s(id)}/address`, { addressId }),
  homeDelivery: (id: string) => api.post<CheckoutSession>(`${s(id)}/delivery`),
  setPayment: (id: string, paymentMethod: PaymentMethodValue) => api.post<CheckoutSession>(`${s(id)}/payment-method`, { paymentMethod }),
  place: (id: string, idempotencyKey: string) => api.post<CheckoutSession>(`${s(id)}/place`, undefined, { idempotencyKey }),
  addresses: () => api.get<ShippingAddress[]>('/v1/addresses'),
  createAddress: (body: NewAddress) => api.post<ShippingAddress>('/v1/addresses', body),
};

/** The checkout session id survives the eSewa round trip here (the return URL carries no session id). */
const SESSION_KEY = 'sm_shop_checkout';

export function saveCheckoutSession(id: string | null) {
  try {
    if (id) localStorage.setItem(SESSION_KEY, id);
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function savedCheckoutSession(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}
